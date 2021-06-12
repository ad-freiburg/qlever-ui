# -*- coding: utf-8 -*-
from __future__ import unicode_literals
from django import forms

from django.contrib import admin
from django.contrib.auth.models import Group
from django.forms import TextInput
from django.db import models
from import_export.admin import ImportExportModelAdmin

from .models import *
from .forms import Adaptingtextarea

admin.site.site_header = "QLever UI Administration"
admin.site.site_title = "QLever UI Administration"


class BackendAdmin(ImportExportModelAdmin):
    formfield_overrides = {
        models.CharField: {'widget': TextInput(attrs={'size': '140'})},
        models.TextField: {'widget': Adaptingtextarea()},
    }
    fieldsets = (
        ("General", {
            'fields': ('name', 'slug', 'sortKey', 'baseUrl', 'isDefault')
        }),
        ('UI Suggestions', {
            'fields': ('maxDefault', 'fillPrefixes', 'filterEntities', 'filteredLanguage', 'supportedKeywords', 'supportedFunctions', 'suggestPrefixnamesForPredicates', 'supportedPredicateSuggestions', 'suggestedPrefixes'),
        }),
        ('Backend Suggestions', {
            'fields': ('suggestionEntityVariable', 'suggestionNameVariable', 'suggestionAltNameVariable', 'suggestionReversedVariable', 'suggestSubjects', 'suggestPredicates', 'suggestObjects', 'dynamicSuggestions', 'replacePredicates'),
        }),
        ('Showing names', {
            'fields': ('subjectName', 'alternativeSubjectName', 'predicateName', 'alternativePredicateName', 'objectName', 'alternativeObjectName'),
        }),
    )

    def get_form(self, request, obj=None, **kwargs):
        t = super().get_form(request, obj, **kwargs)
        obj.useBackendDefaults = False
        for fieldName in t.base_fields:
            if fieldName in BackendDefaults.AVAILABLE_DEFAULTS:
                t.base_fields[fieldName].widget.attrs["placeholder"] = obj.__getattribute__(
                    fieldName, forceUseDefault=True)
        return t

    def get_queryset(self, request):
        qs = super(BackendAdmin, self).get_queryset(request)
        return qs.filter(backenddefaults__isnull=True)


class BackendDefaultsAdmin(ImportExportModelAdmin):
    formfield_overrides = {
        models.CharField: {'widget': TextInput(attrs={'size': '140'})},
        models.TextField: {'widget': Adaptingtextarea()},
    }
    # only uses the "Backend Suggestions" part of the BackendAdmin fieldsets
    fieldsets = (BackendAdmin.fieldsets[2], )


class ExampleAdmin(ImportExportModelAdmin):
    list_display = ['backend', 'name']


class LinkAdmin(admin.ModelAdmin):
    list_display = ['identifier', 'content']


admin.site.unregister(Group)

admin.site.register(Backend, BackendAdmin)
admin.site.register(Example, ExampleAdmin)
admin.site.register(BackendDefaults, BackendDefaultsAdmin)
#admin.site.register(Link, LinkAdmin)
