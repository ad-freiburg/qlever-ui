# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.contrib import admin
from django.contrib.auth.models import Group
from django.forms import TextInput, Textarea
from django.db import models
from import_export.admin import ImportExportModelAdmin

from .models import *

admin.site.site_header = "QLever UI Administration"
admin.site.site_title = "QLever UI Administration"


class BackendAdmin(ImportExportModelAdmin):
    formfield_overrides = {
        models.CharField: {'widget': TextInput(attrs={'size':'140'})},
    }
    fieldsets = (
        ("General", {
           'fields': ('name', 'baseUrl', 'isDefault')
        }),
        ('Preprocessing', {
            'fields': ('ntFilePath',),
        }),
        ('UI Suggestions', {
            'fields': ('maxDefault','filteredLanguage','dynamicSuggestions','supportedKeywords','supportedFunctions', ),
        }),
        ('Backend Suggestions', {
            'fields': ('suggestSubjects','suggestObjects','dynamicSuggestions', ),
        }),
        ('Showing names', {
            'fields': ('subjectName','predicateName','objectName', ),
        }),
    )

class PrefixAdmin(admin.ModelAdmin):
    list_display = ['name', 'prefix', 'backend', 'occurrences']


class ExampleAdmin(admin.ModelAdmin):
    list_display = ['backend', 'name']

class LinkAdmin(admin.ModelAdmin):
    list_display = ['identifier', 'content']

admin.site.unregister(Group)

admin.site.register(Backend, BackendAdmin)
admin.site.register(Prefix, PrefixAdmin)
admin.site.register(Example, ExampleAdmin)
#admin.site.register(Link, LinkAdmin)
