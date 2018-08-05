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
	
	try:		
		# if a backend is given try to activate it
		if request.GET.get('backend',False) and int(request.GET['backend']) >= 0:
			backend = Backend.objects.filter(pk=request.GET['backend']).first()
		else:
			backend = Backend.objects.filter(isDefault=1).first()
	
	except:
		pass
	
	if backend:
		request.session['backend'] = backend.pk
		request.session['backendUrl'] = backend.baseUrl
		request.session['backendName'] = backend.name
		request.session['backendSuggestions'] = backend.dynamicSuggestions
	
	backend = request.session.get('backend',False)
	if backend:
		examples = Example.objects.filter(backend=backend)
	
	return render(request, 'index.html', {
		'backends': Backend.objects.all(),
		'examples': examples
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
		if parameter == 'has-relation':
			
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
		prefixes = list(Prefix.objects.filter(backend__pk=request.session.get('backend')).order_by('-occurrences').values_list('prefix', flat=True))
		t2 = time.time()
		
		log('%fms'%((t2-t1)*1000))
		
		for i, prefix in enumerate(prefixes):
			suggestions.append('PREFIX p%d: <%s>\n'%(i+1, prefix))

	return HttpResponse(json.dumps({'suggestions': suggestions, 'found': found}))


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

				fileDir = '/'.join(backend.ntFilePath.split('/')[:-1])
				tempPath = fileDir+'/f1_2_sorted.temp'
				
				# TODO: @julian Check if sorting is still required or usefull?
				subprocess.call("""export LC_ALL=C ; cut -f1,2 %s | sort -u > %s""" % (backend.ntFilePath, tempPath), shell=True)
				
				Prefix.objects.filter(backend=backend).delete()
				
				log("creating prefixes from subjects")
				output = subprocess.check_output("""export LC_ALL=C ; cut -f1 %s | perl -ne '/(http:(.*)\/)/ and print "$1\n";' | sort | uniq -c | sort -k1,1nr""" % tempPath, shell=True).decode('utf-8').split('\n')[:3]
				for prefix in output:
					if prefix:
						prefix = prefix.strip().split(' ')
						Prefix.objects.get_or_create(backend=backend, prefix=prefix[1], occurrences=prefix[0])

				log("creating prefixes from predicates")
				output = subprocess.check_output("""export LC_ALL=C ; cut -f2 %s | perl -ne '/(http:(.*)\/)/ and print "$1\n";' | sort | uniq -c | sort -k1,1nr""" % tempPath, shell=True).decode('utf-8').split('\n')[:3]
				for prefix in output:
					if prefix:
						prefix = prefix.strip().split(' ')
						Prefix.objects.get_or_create(backend=backend, prefix=prefix[1], occurrences=prefix[0])

				# TODO: @julian Check if this is still used for anything				
				'''
				if not backend.getPatternsFromQLever:
					log("Deleting subjects from database.")
					Subject.objects.filter(backend=backend).delete()

					log("Cutting subjects from nt.")
					subjects = subprocess.check_output("""export LC_ALL=C ; cut -f1 %s | sort -u""" % tempPath, shell=True).decode('utf-8').split('\n')


					log("Creating subjects in database.")
					subjects = subprocess.check_output("""export LC_ALL=C ; grep "%s" %s | cut -f1,3 """
						% ((backend.subjectOrderRelation, backend.ntFilePath) if backend.subjectOrderRelation else ('<occurrences_in_kb>', fileDir+'/qlui_data.nt')), shell=True).decode('utf-8').split('\n')
					i = 0
					j = 0
					import re
					numberRX = re.compile('[0-9\.]+')
					with connection.cursor() as cursor:
						with transaction.atomic():
							while subjects:
								i += 1
								values = []
								successfulLines = 0
								for line in subjects[:500]:
									try:
										subject, score = line.split('\t')
									except:
										continue
									match = numberRX.search(score)
									if match:
										score = match.group()
									else:
										continue
									successfulLines += 1
									values += [subject, score]

								if successfulLines:
									cursor.execute('INSERT INTO backend_subject (backend_id, internalId, score) VALUES ' + (('('+backendId+',%s,%s),') * successfulLines)[:-1], values)

								del subjects[:500]
								if i == 20000:
									i = 0
									j += 1
									log("- wrote %d rows. %d left." % (10000000*j, len(subjects)))
						cursor.execute("CREATE INDEX IF NOT EXISTS subject_index ON backend_subject (score, backend_id, internalId COLLATE NOCASE)")
					del subjects

					log("Deleting predicates from database.")
					# Predicate.objects.filter(backend=backend).delete()
					Predicate.objects.filter(backend=backend).delete()

					log("Cutting predicates from nt.")
					predicateIds = {}
					predicates = subprocess.check_output("""export LC_ALL=C ; cut -f2 %s | sort | uniq -c | sort -k1,1nr | cut -f2 """ % tempPath, shell=True).decode('utf-8').split('\n')
					# for i, predicate in enumerate(predicates):
					# 	predicate = predicate.strip()
					# 	predicateIds[predicate] = i
					# subprocess.call('rm %s' % tempPath, shell=True)

					log("Creating predicates in database.")
					startIndex = Predicate.objects.all().aggregate(Max('pk'))['pk__max']
					if startIndex is None:
						startIndex = 0
					startIndex += 1
					with connection.cursor() as cursor:
						with transaction.atomic():
							with codecs.open(fileDir+'/qlui_data.nt', 'a', 'utf-8') as f:
								for i, line in enumerate(predicates):
									currId = startIndex + i
									if not line:
										continue
									predicate = line.strip().split()[1]
									predicateIds[predicate] = currId
									cursor.execute('INSERT INTO backend_predicate (id, backend_id, internalId, name) VALUES (%s,%s,%s,"")', [currId, backendId, predicate])
									f.write('<qlui_predicate_id_%s>\t<predicate-for-id>\t%s\t.\n' % (currId, predicate))
						cursor.execute("CREATE INDEX IF NOT EXISTS predicate_index ON backend_predicate (internalId COLLATE NOCASE, backend_id)")
					del predicates
				'''
				
				# TODO: @julian Check if this is still used for anything				
				'''
				log("Deleting patterns from database.")
				Pattern.objects.filter(backend=backend).delete()
				if backend.getPatternsFromQLever:
					log("Retrieving patterns from QLever")
					query = "SELECT ?pattern ?predicate WHERE { ?pattern <pattern-has-predicate> ?predicate } ORDER BY ASC(?pattern)"
					response = requests.get(backend.baseUrl, params={'query': query}).json()['res']
					log("Writing patterns to DB")
					currPattern = response[0][0]
					pattern = []
					i = 0
					with connection.cursor() as cursor:
						with transaction.atomic():
							for line in response:
								if currPattern != line[0]:
									i += 1
									if i % 10000 == 0:
										log("%s Predicates done."%i)
									currId = currPattern[19:-1]
									cursor.execute('INSERT INTO backend_pattern (internalId, backend_id, predicates) VALUES (%s,%s,%s)', [currId, backendId, ','.join(pattern)])
									pattern = []
									currPattern = line[0]
								pattern.append(line[1])
							currId = currPattern[19:-1]
							cursor.execute('INSERT INTO backend_pattern (internalId, backend_id, predicates) VALUES (%s,%s,%s)', [currId, backendId, ','.join(pattern)])
				else:
					log("Finding predicate patterns")
					curSubject = ''
					curPattern = ''
					patternDict = {}
					#with codecs.open(fileDir+'/patterns.txt', 'w', 'utf-8') as outfile:
					with codecs.open(tempPath, 'r', 'utf-8') as f:
						for i, l in enumerate(f):
							if i % 10000000 == 0:
								log(i)
							s = l.strip().split('\t')
							if curSubject != s[0]:
								try:
									patternDict[curPattern].append(curSubject)
								except:
									patternDict[curPattern] = [curSubject]
								curSubject = s[0]
								#outfile.write(curPattern+'\n'+curSubject+'\t')
								curPattern = ''
							if len(s) == 2:
								curPattern += str(predicateIds[s[1]])+','
						if curPattern:
							#outfile.write(curPattern)
							patternDict[curPattern] = patternDict.get(curPattern, []) + [curSubject]

					log('Sorting patterns')
					patterns_sorted = sorted(patternDict, key=lambda x: len(patternDict[x]), reverse=True)
					top_patterns = patterns_sorted[:2**16]
					#top_patterns = subprocess.check_output("""export LC_ALL=C ; cut -f2 %s/patterns.txt | sort | uniq -c | sort -k1,1nr 2>/dev/null | head -n %d""" % (fileDir, 2**16), shell=True).strip().split('\n')

					topDict = {}
					for pattern in top_patterns:
						if not pattern:
							continue
						topDict[pattern] = True

					log('Creating <has-predicate-pattern> triples.')
					startIndex = Pattern.objects.all().aggregate(Max('pk'))['pk__max']
					if startIndex is None:
						startIndex = 0
					startIndex += 1
					with connection.cursor() as cursor:
						with transaction.atomic():
							for i, pattern in enumerate(top_patterns):
								if i % 10000 == 0:
									log(i)
								if not pattern:
									continue
								currId = startIndex + i
								cursor.execute('INSERT INTO backend_pattern (id, internalId, backend_id, predicates) VALUES (%s,%s,%s,%s)', [currId, currId, backendId, pattern])
								with codecs.open(fileDir+'/qlui_data.nt', 'a', 'utf-8') as f:
									for subject in patternDict.get(pattern, []):
										f.write('%s\t<has-predicate-pattern>\t<qlui_pattern_%d>\t.\n' % (subject, currId))
									for predicate in pattern.split(','):
										if predicate:
											f.write('<qlui_pattern_%d>\t<pattern-has-predicate>\t<qlui_predicate_id_%s>\t.\n' % (currId, predicate))
					log("Adding <has-predicate> triples.")
					#with codecs.open(fileDir+'/patterns.txt', 'r', 'utf-8') as patterns:
					with codecs.open(fileDir+'/qlui_data.nt', 'a', 'utf-8') as f:
						for pattern in patterns_sorted[2**16:]:
							predicates = [p for p in pattern.split(',') if p]
							for subject in patternDict[pattern]:
								for predicate in predicates:
									f.write('%s\t<has-predicate>\t<qlui_predicate_id_%s>\t.\n' % (subject, predicate))
				'''
				
				# TODO: @julian Check if this is still used for anything				
				'''
				with connection.cursor() as cursor:
					cursor.execute("CREATE INDEX IF NOT EXISTS pattern_index on backend_pattern(internalId, backend_id)")
				log("Deleting objects from database.")
				Object.objects.filter(backend=backend).delete()

				if not backend.getPatternsFromQLever:
					log("Cutting objects from nt.")
					objects = subprocess.check_output("""export LC_ALL=C ; cut -f3 %s | sort -u""" % backend.ntFilePath, shell=True).decode('utf-8').split('\n')

					log("Creating objects in database.")
					i = 0
					j = 0
					with connection.cursor() as cursor:
						with transaction.atomic():
							while objects:
								i += 1
								cursor.execute('INSERT INTO backend_object (backend_id, internalId, name) VALUES ' + (('('+backendId+',%s,""),') * min(len(objects), 500))[:-1], objects[:500])
								del objects[:500]
								if i == 20000:
									i = 0
									j += 1
									log("- wrote %d rows. %d left." % (10000000*j, len(objects)))
						cursor.execute("CREATE INDEX IF NOT EXISTS object_index ON backend_object (internalId COLLATE NOCASE, backend_id)")
					del objects

					if backend.getSubjectNamesFromRelation and backend.subjectNameRelation:
						pass #grep "<http://www.julian.de/sparql" scientists.nt.orig | cut -f3
				'''
				
				backend.ntFileLastChange = os.path.getmtime(backend.ntFilePath)
				backend.isImporting = False
				backend.save()
				
				log("Done.")
				return JsonResponse({'status': 'finished'})
				
			except Exception as e:
			
				backend.isImporting = False
				backend.save()
				# TODO: Check what happens here
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
	with open('django.log', 'a') as logfile:
		logfile.write(logMsg+'\n')
