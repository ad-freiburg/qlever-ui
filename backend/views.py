# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from __future__ import print_function

from django.shortcuts import render
from django.http import HttpResponse, HttpResponseServerError, JsonResponse
from django.shortcuts import render
from django.db import connection, transaction
from django.db.models import Max

from .models import *

import re, json, os, subprocess, requests, codecs, urllib
from collections import Counter
from django.shortcuts import redirect

import datetime, time

def index(request,backend=None):
    """

        Index view - shows the UI with all available backends
        If no preferred backend is set this view choses the default from the database
    
    """

    activeBackend = None
    examples = []

    # if a backend is given try to activate it
    if backend:
        for availableBackend in Backend.objects.all():
            if availableBackend.slugify() == backend:
                activeBackend = availableBackend
                break
    # if no backend is given activate the last one
    else:
        # go to the last active backend if set
        if request.session['backend']:    
            backend = Backend.objects.filter(pk=request.session['backend']).first()
            # and if still available
            if backend:
                return redirect('/'+backend.slugify())
        # find a default backend
        else:
            backend = Backend.objects.order_by('isDefault').first()
            return redirect('/'+backend.slugify())

    if activeBackend:

        request.session['scorePredicate'] = activeBackend.scorePredicate
        request.session['backend'] = activeBackend.pk
        request.session['backendUrl'] = activeBackend.baseUrl
        request.session['backendName'] = activeBackend.name
        request.session['backendSuggestions'] = activeBackend.dynamicSuggestions
        request.session['subjectName'] = activeBackend.subjectName
        request.session['predicateName'] = activeBackend.predicateName
        request.session['objectName'] = activeBackend.objectName

        examples = Example.objects.filter(backend=activeBackend)

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
                for substr in [predicate.lower()] + predicate.lower().split('_') + predicate.lower().split('/'):
                    if substr.startswith(lastWord):
                        if skipped < offset:    # skip #offset suggestions
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

def collectPrefixes(backend, output=print):
    """

        Computes the Indexes from the nt file

    """

    if not backend or not backend.ntFilePath:
        raise StandardError('There was no nt-source specified for this backend.')

    if not os.path.isfile(backend.ntFilePath):
        raise StandardError('Error opening file "%s"' % backend.ntFilePath)

    if backend.isImporting == False:
        try:
            backend.isImporting = True
            backend.save()
            backendId = str(backend.pk)

            prefixes = {}
            prefixRegex = re.compile("<(http://(?:[a-zA-Z0-9_/-]*?)[/|#])")
            with open(backend.ntFilePath, 'r') as ntFile:
                i = 0
                for line in ntFile:
                    for prefix in prefixRegex.findall(line):
                        if prefix in prefixes:
                            prefixes[prefix] += 1
                        else:
                            prefixes[prefix] = 1
                    i += 1
                    if i % 10000000 == 0:
                        log("%d lines processed" % i, output=output)

            log("Found %d prefixes." % len(prefixes))
            if len(prefixes) > 20:
                log("Storing the 20 most common.")
            sortedPrefixList = sorted([(k, prefixes[k]) for k in prefixes], key=lambda x:x[1])[:20]
            for prefix in sortedPrefixList:
                name = "".join([s[0] for s in prefix[0][7:].replace("www.", "").split("/-") if s])
                instance, created = Prefix.objects.get_or_create(backend=backend, prefix=prefix[0])
                if created:
                    instance.name = name
                    instance.occurrences = prefix[1]
                    prefix.save

            backend.ntFileLastChange = os.path.getmtime(backend.ntFilePath)
            backend.isImporting = False
            backend.save()

            log("Done.", output=output)
        except Exception as e:
            backend.isImporting = False
            backend.save()
            raise
    else:
        raise StandardError("Index collection for this backend already running")


def log(msg, output=print):
    """
        Helper to log things that happen during the process
    """
    logMsg = datetime.datetime.now().strftime('%d.%m.%Y %H:%M:%S') + ' ' + str(msg)
    output(logMsg)
