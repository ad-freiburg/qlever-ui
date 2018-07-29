# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models

class Backend(models.Model):
	
	MODES = (
		(2,'3. SPARQL & context sensitive entities'),
		(1,'2. SPARQL & context insensitive entities'),
		(0,'1. SPARQL syntax & keywords only')
	)
	
	name = models.CharField(max_length=500,help_text="Choose a name for the backend that helps you to distinguish between multiple backends",verbose_name="Name")
	baseUrl = models.CharField(max_length=1000,help_text="The URL where to find / call the QLever backend (including http://)",verbose_name="Base URL")
	ntFilePath = models.CharField(max_length=2000, default='', blank=True,help_text="Local (absolute or relative) path to the source .nt file QLever uses",verbose_name="Source Path")
	ntFileLastChange = models.CharField(max_length=100, default='0', blank=True, editable=False)
	getPatternsFromQLever = models.BooleanField(default=False,help_text="If you run the QLever Indexer with -u it will do some QLever UI preprocessing directly and you can check this option in order to skip this preprocessing setip in QLever UI",verbose_name="Use QLever Preprocessing")
	isDefault = models.BooleanField(default=0,help_text="Check if this should be the default backend for QLever UI",verbose_name="Use as default")
	isImporting = models.BooleanField(default=False, editable=False)
	getPredicateNamesFromRelation = models.BooleanField(default=False, editable=False)
	predicateNameRelation = models.CharField(default='', max_length=200, blank=True, editable=False)
	getSubjectNamesFromRelation = models.BooleanField(default=False, editable=False)
	subjectNameRelation = models.CharField(default='', max_length=200, blank=True, editable=False)
	subjectOrderRelation = models.CharField(default='', max_length=200, blank=True, editable=False)
	dynamicSuggestions = models.IntegerField(default=True, choices=MODES, help_text="If you want to disable the dynamic suggestions from QLever or QLever UI by default change this option.",verbose_name="Default suggestion mode")

	def __unicode__(self):
		return self.name

class Suggestion(models.Model):
	scope = models.CharField(max_length=200,default="")
	firstWord = models.CharField(max_length=200,default="")
	secondWord = models.CharField(max_length=200,null=True)
	count = models.IntegerField()

class Synonym(models.Model):
	word = models.CharField(max_length=200,default="")
	synonym = models.CharField(max_length=200,default="")

class Subject(models.Model):
	internalId = models.CharField(max_length=200)
	backend = models.ForeignKey(Backend, default=None, null=True)
	score = models.FloatField(default=0)

class Predicate(models.Model):
	internalId = models.CharField(max_length=200)
	backend = models.ForeignKey(Backend, default=None, null=True)
	name = models.CharField(max_length=200,default="")

class Pattern(models.Model):
	backend = models.ForeignKey(Backend, default=None, null=True)
	internalId = models.IntegerField()
	predicates = models.CharField(max_length=500,default="")

class Object(models.Model):
	internalId = models.CharField(max_length=200)
	backend = models.ForeignKey(Backend, default=None, null=True)
	name = models.CharField(max_length=200,default="")

class Prefix(models.Model):
	prefix = models.CharField(max_length=200, default="")
	backend = models.ForeignKey(Backend)
	occurrences = models.IntegerField(default=1)

class Example(models.Model):
	def __unicode__(self):
		return self.name
	backend = models.ForeignKey(Backend)
	name = models.CharField(max_length=100)
	query = models.TextField()
