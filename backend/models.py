# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models
import urllib, string


class Backend(models.Model):
    MODES = ((2, '3. SPARQL & context sensitive entities'),
             (1, '2. SPARQL & context insensitive entities'),
             (0, '1. SPARQL syntax & keywords only'))

    name = models.CharField(
        max_length=500,
        help_text=
        "Choose a name for the backend that helps you to distinguish between multiple backends",
        verbose_name="Name",
        unique=True)
    baseUrl = models.CharField(
        max_length=1000,
        help_text=
        "The URL where to find / call the QLever backend (including http://)",
        verbose_name="Base URL")

    ntFilePath = models.CharField(
        max_length=2000,
        default='',
        blank=True,
        help_text=
        "Local (absolute or relative) path to the source .nt file QLever uses",
        verbose_name="Source Path")
    ntFileLastChange = models.CharField(
        max_length=100, default='0', blank=True, editable=False)

    isDefault = models.BooleanField(
        default=0,
        help_text="Check if this should be the default backend for QLever UI",
        verbose_name="Use as default")
    isImporting = models.BooleanField(default=False, editable=False)

    dynamicSuggestions = models.IntegerField(
        default=True,
        choices=MODES,
        help_text=
        "If you want to disable the dynamic suggestions from QLever or QLever UI by default change this option.",
        verbose_name="Default suggestion mode")

    scorePredicate = models.CharField(
        max_length=1000,
        default="ql:num-triples",
        help_text=
        "The predicate used to rank suggestions. Leave blank if no ordering should take place",
        verbose_name="Predicate for ranking",
        blank=True)

    subjectName = models.CharField(
        max_length=100,
        default='',
        blank=True,
        help_text=
        "Relation that tells QLever UI the name of a subject (without prefixes).",
        verbose_name="Subject name relation")
    predicateName = models.TextField(
        default='',
        blank=True,
        help_text=
        "Relation that tells QLever UI the name of a predicate (without prefixes).",
        verbose_name="Predicate name relation")
    objectName = models.CharField(
        max_length=100,
        default='',
        blank=True,
        help_text=
        "Relation that tells QLever UI the name of a object (without prefixes).",
        verbose_name="Object name relation")

    def save(self, *args, **kwargs):

        super(Backend, self).save(*args, **kwargs)

        if self.isDefault == True:
            Backend.objects.exclude(pk=self.pk).update(isDefault=False)

    def __unicode__(self):
        return self.name

    def slugify(self):
        return filter(lambda x: ord(x) in range(40, 123),
                      self.name.replace(' ', '_').replace('/', '-').replace(
                          '*', '-'))
    
    def predicateNameQuery(self):
	    import json
	    return json.dumps(self.predicateName.split("\n"))
    


class Link(models.Model):
    identifier = models.CharField(max_length=256)
    content = models.TextField()


class Prefix(models.Model):
    class Meta:
        verbose_name_plural = "Prefixes"

    name = models.CharField(max_length=30, default="")
    prefix = models.CharField(max_length=200, default="")
    backend = models.ForeignKey(Backend)
    occurrences = models.IntegerField(default=1)


class Example(models.Model):
    backend = models.ForeignKey(Backend)
    name = models.CharField(max_length=100)
    query = models.TextField()

    def __unicode__(self):
        return self.name
