# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.shortcuts import render
from django.http import HttpResponse, HttpResponseServerError, JsonResponse
from django.shortcuts import render
from django.db import connection, transaction
from django.db.models import Max

from .models import *

import re, json, os, subprocess, requests, codecs
from collections import Counter

import datetime, time

def index(request):
	"""

		Index view - shows the UI with all available backends
		If no preferred backend is set this view choses the default from the database

	"""

	backend = None
	examples = []

	# if a backend is given try to activate it
	if request.GET.get('backend',False) and int(request.GET['backend']) >= 0:
		backend = Backend.objects.filter(pk=request.GET['backend']).first()
	if request.session.get('backend',False) == False:
		backend = Backend.objects.order_by('isDefault').first()


	if backend:
		request.session['scorePredicate'] = backend.scorePredicate
		request.session['backend'] = backend.pk
		request.session['backendUrl'] = backend.baseUrl
		request.session['backendName'] = backend.name
		request.session['backendSuggestions'] = backend.dynamicSuggestions
		request.session['subjectName'] = backend.subjectName
		request.session['predicateName'] = backend.predicateName
		request.session['objectName'] = backend.objectName

	backend = request.session.get('backend',False)
	if backend:
		examples = Example.objects.filter(backend=backend)

	return render(request, 'index.html', {
		'backends': Backend.objects.all(),
		'examples': examples,
	})


def getSuggestions(request):
	"""

		Takes a scope and the word currently typing and returns several suggestions in a list

	"""

	# General information
	backend = Backend.objects.get(pk=request.session.get('backend')) # backend id

	# Context information
	lastWord = request.GET.get('lastWord', '').lower() # current word (prefix)
	scope = request.GET.get('scope')
	mode = request.GET.get('mode')
	parameter = request.GET.get('parameter')
	query = request.GET.get('query')

	# Pagination
	offset = int(request.GET.get('offset', 0)) # offset for results
	size = int(request.GET.get('size', 20)) # amount of expected results

	# no suggestions in variables
	if lastWord is None or lastWord.startswith('?'):
		return HttpResponse(json.dumps({'suggestions': [], 'found': 0}))

	# Using the literals is not required
	if lastWord and not lastWord.startswith('<'):
		startedWord = '<' + lastWord
	else:
		startedWord = lastWord

	suggestions = []
	found = None

	# Redirect queries to QLever
	if query:
		log('Retrieving %s suggestions from QLever.' % parameter)
		if parameter == 'has-predicate':

			t1 = time.time()
			response = requests.get(request.session['backendUrl'], params={'query': query})
			t2 = time.time()

			skipped = 0
			for predicate in response.json().get('res',[]):
				predicate = predicate[0]
				for substr in predicate.lower().split('_') + predicate.lower().split('/'):
					if substr.startswith(lastWord):
						if skipped < offset:	# skip #offset suggestions
							skipped += 1
						else:
							suggestions.append(predicate)
						break
				if len(suggestions) >= size:
					break
						
			t3 = time.time()
			found = response.json().get('resultsize', 0)
			t4 = time.time()

			log('\nQuerying QLever for predicates: %fms\nFiltering for typed word: %fms\nCounting total number of predicates: %fms\nTotal: %fms'%((t2-t1)*1000, (t3-t2)*1000, (t4-t3)*1000, (t4-t1)*1000))

		else:
			t1 = time.time()
			response = requests.get(request.session['backendUrl'], params={'query': query})
			response.raise_for_status()
			t2 = time.time()

			result = []
			suggestions = [x[0] for x in response.json().get('res',[])]
			found = response.json().get('resultsize', 0)
			t3 = time.time()

			log('\nQuerying QLever: %fms\nCounting entities: %fms'%((t2-t1)*1000, (t3-t2)*1000))


	# Use local backend for prefixes
	elif mode == 'prefix':
		log('Retrieving prefixes from local backend')
		t1 = time.time()
		prefixes = list(Prefix.objects.filter(backend__pk=request.session.get('backend')).order_by('-occurrences'))
		t2 = time.time()

		log('%fms'%((t2-t1)*1000))

		for prefix in prefixes:
			suggestions.append('PREFIX %s: <%s>\n'%(prefix.name, prefix.prefix.strip('<>')))

	return HttpResponse(json.dumps({'suggestions': suggestions, 'found': found, 'time': "%.4f"%((t2-t1))}))


#
# Helpers
#

def reindex(request):
	"""

		Do the preprocessing work from QLever UI

	"""

	backend = Backend.objects.filter(pk=request.session.get('backend')).first()

	if not backend or not backend.ntFilePath:
		return JsonResponse({'status': 'error', 'message': 'There was no nt-source specified for this backend.'})

	if not os.path.isfile(backend.ntFilePath):
		return JsonResponse({'status': 'error', 'message': 'Error opening file "%s"' % backend.ntFilePath})

	if str(os.path.getmtime(backend.ntFilePath)) != str(backend.ntFileLastChange):
		if backend.isImporting == False:
			try:
				backend.isImporting = True
				backend.save()
				backendId = str(backend.pk)

				Prefix.objects.filter(backend=backend).delete()

				log("creating prefixes from subjects")
				output = subprocess.check_output("""export LC_ALL=C ; cut -f1 %s | perl -ne '/(http:(.*)\/)/ and print "$1\n";' | sort | uniq -c | sort -k1,1nr""" % backend.ntFilePath, shell=True).decode('utf-8').split('\n')[:3]
				for prefix in output:
					if prefix:
						prefix = prefix.strip().split(' ')
						Prefix.objects.get_or_create(backend=backend, prefix=prefix[1], occurrences=prefix[0])

				log("creating prefixes from predicates")
				output = subprocess.check_output("""export LC_ALL=C ; cut -f2 %s | perl -ne '/(http:(.*)\/)/ and print "$1\n";' | sort | uniq -c | sort -k1,1nr""" % backend.ntFilePath, shell=True).decode('utf-8').split('\n')[:3]
				for prefix in output:
					if prefix:
						prefix = prefix.strip().split(' ')
						Prefix.objects.get_or_create(backend=backend, prefix=prefix[1], occurrences=prefix[0])

				backend.ntFileLastChange = os.path.getmtime(backend.ntFilePath)
				backend.isImporting = False
				backend.save()

				log("Done.")
				return JsonResponse({'status': 'finished'})

			except Exception as e:
				backend.isImporting = False
				backend.save()
				raise
				return JsonResponse({'status': 'error', 'message': str(e)})
		else:

			return JsonResponse({'status': 'running'})

	return JsonResponse({'status': 'noaction'})

def log(msg):
	"""
		Helper to log things that happen during the process
	"""
	logMsg = datetime.datetime.now().strftime('%d.%m.%Y %H:%M:%S') + ' ' + str(msg)
	print logMsg
