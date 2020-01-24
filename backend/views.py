from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import render
from django.http import HttpResponse, HttpResponseServerError, JsonResponse
from django.shortcuts import render
from django.db import connection, transaction
from django.db.models import Max

from .models import *

import re
import json
import os
import subprocess
import requests
import codecs
import urllib
import random
import string
from collections import Counter
from django.shortcuts import redirect

import datetime
import time


def index(request, backend=None, short=None):
    """

        Index view - shows the UI with all available backends
        If no preferred backend is set this view choses the default from the database

    """
    activeBackend = None
    examples = []
    prefixes = {}
    prefill = None

    if request.POST.get('whitespaces', False):
        request.session['logParsing'] = request.POST.get('logParsing', False)
        request.session['logRequests'] = request.POST.get('logRequests', False)
        request.session['logSuggestions'] = request.POST.get(
            'logSuggestions', False)
        request.session['logOther'] = request.POST.get('logOther', False)
        request.session['whitespaces'] = request.POST['whitespaces']

    # if a backend is given try to activate it
    if backend:
        for availableBackend in Backend.objects.all():
            if availableBackend.slugify() == backend:
                activeBackend = availableBackend
                break

        if activeBackend == None:
            return redirect('/')

    # if no backend is given activate the last one
    else:
        # go to the last active backend if set
        if request.session.get('backend', False):
            backend = Backend.objects.filter(
                pk=request.session['backend']).first()
            # and if still available
            if backend:
                return redirect('/' + backend.slugify())
        # find a default backend
        else:
            backend = Backend.objects.order_by('isDefault').first()
            if backend:
                return redirect('/' + backend.slugify())

    if activeBackend:

        # safe to session
        request.session['backend'] = activeBackend.pk

        # get examples
        examples = Example.objects.filter(backend=activeBackend)

        # get prefixes
        prefs = list(Prefix.objects.filter(
            backend=activeBackend).order_by('-occurrences'))

        for prefix in prefs:
            prefixes[prefix.name] = prefix.prefix.strip('<>')

    # collect shortlink data
    if short:
        link = Link.objects.filter(identifier=short).first()
        if link:
            prefill = link.content
    elif request.GET.get("query"):
        prefill = request.GET["query"]

    return render(
        request, 'index.html', {
            'backend': activeBackend,
            'prefixes': json.dumps(prefixes),
            'backends': Backend.objects.all(),
            'examples': examples,
            'prefill': prefill
        })


@csrf_exempt
def shareLink(request):
    """
        Generate a sharing link
    """

    if request.GET.get('cleanup', False) == False:
        content = request.POST.get('content')
        link = Link.objects.filter(content=content).first()
        if not link:
            # space for 56.800.235.584 unique queries in history
            # asuming that one query is about 500 Bytes these are ~ 28 TB of history data
            # asuming that one query is about 1000 Bytes these are ~ 56 TB of history data
            identifier = ''.join(
                random.choice(string.ascii_lowercase + string.ascii_uppercase +
                              string.digits) for _ in range(6))
            while Link.objects.filter(identifier=identifier).exists():
                identifier = ''.join(
                    random.choice(string.ascii_lowercase + string.ascii_uppercase +
                                  string.digits) for _ in range(6))

            link = Link.objects.create(
                identifier=identifier, content=content)

        queryString = urllib.parse.urlencode({"query": content})

        return JsonResponse({'link': link.identifier, "queryString": queryString})

    else:

        Link.objects.all().delete()

        return redirect('/')

#
# Helpers
#


def collectPrefixes(backend, output=print):
    """

        Computes the Indexes from the nt file

    """

    if not backend or not backend.ntFilePath:
        raise Exception(
            'There was no nt-source specified for this backend.')

    if not os.path.isfile(backend.ntFilePath):
        raise Exception('Error opening file "%s"' % backend.ntFilePath)

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

            log("Found %d prefixes." % len(prefixes), output=output)
            if len(prefixes) > 20:
                log("Storing the 20 most common.", output=output)
            sortedPrefixList = sorted(
                [(k, prefixes[k]) for k in prefixes], key=lambda x: x[1])[:20]
            for prefix in sortedPrefixList:
                name = "".join([
                    s[0] for s in prefix[0][7:].replace("www.", "").split("/-")
                    if s
                ])
                instance, created = Prefix.objects.get_or_create(
                    backend=backend, prefix=prefix[0])
                instance.occurrences = prefix[1]
                if created:
                    instance.name = name
                    prefix.save()

            backend.ntFileLastChange = os.path.getmtime(backend.ntFilePath)
            backend.isImporting = False
            backend.save()

            log("Done.", output=output)
        except Exception as e:
            backend.isImporting = False
            backend.save()
            raise
    else:
        raise Exception(
            "Index collection for this backend already running")


def log(msg, output=print):
    """
        Helper to log things that happen during the process
    """
    logMsg = datetime.datetime.now().strftime('%d.%m.%Y %H:%M:%S') + ' ' + str(
        msg)
    output(logMsg)
