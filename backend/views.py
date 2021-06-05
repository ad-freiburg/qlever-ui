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
            'prefixes': json.dumps(activeBackend.availablePrefixes),
            'backends': Backend.objects.all(),
            'examples': examples,
            'prefill': prefill
        })


@csrf_exempt
def shareLink(request):
    """
        Generate a sharing link
    """

    if request.GET.get('cleanup') != 'true':
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
        if request.user.is_superuser:
            Link.objects.all().delete()
        return redirect('/')

#
# Helpers
#


def log(msg, output=print):
    """
        Helper to log things that happen during the process
    """
    logMsg = datetime.datetime.now().strftime('%d.%m.%Y %H:%M:%S') + ' ' + str(
        msg)
    output(logMsg)
