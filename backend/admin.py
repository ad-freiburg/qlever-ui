# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.contrib import admin
from django.contrib.auth.models import Group
from django.forms import TextInput, Textarea
from django.db import models

from .models import *

class BackendAdmin(admin.ModelAdmin):
	formfield_overrides = {
		models.CharField: {'widget': TextInput(attrs={'size':'140'})},
	}


class SuggestionAdmin(admin.ModelAdmin):
    list_display = ['pk', 'scope', 'firstWord','secondWord', 'count']


class EntityAdmin(admin.ModelAdmin):
    list_display = ['internalId']


class PrefixAdmin(admin.ModelAdmin):
    list_display = ['name', 'prefix', 'backend', 'occurrences']


class ExampleAdmin(admin.ModelAdmin):
    list_display = ['backend', 'name']


admin.site.unregister(Group)

admin.site.register(Backend, BackendAdmin)
#admin.site.register(Suggestion, SuggestionAdmin)
#admin.site.register(Subject, EntityAdmin)
#admin.site.register(Predicate, EntityAdmin)
#admin.site.register(Object, EntityAdmin)
admin.site.register(Prefix, PrefixAdmin)
admin.site.register(Example, ExampleAdmin)
