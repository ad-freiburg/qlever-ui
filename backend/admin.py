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

from backend.management.commands import warmup

admin.site.site_header = "QLever UI Administration"
admin.site.site_title = "QLever UI Administration"


class BackendAdmin(ImportExportModelAdmin):
    formfield_overrides = {
        models.CharField: {"widget": TextInput(attrs={"size": "140"})},
        models.TextField: {"widget": Adaptingtextarea()},
    }
    fieldsets = (
        (
            "General",
            {
                "fields": (
                    "name",
                    "slug",
                    "sortKey",
                    "baseUrl",
                    "mapViewBaseURL",
                    "isDefault",
                    "isNoSlugMode",
                    "apiToken",
                )
            },
        ),
        (
            "UI Suggestions",
            {
                "fields": (
                    "maxDefault",
                    "fillPrefixes",
                    "filterEntities",
                    "filteredLanguage",
                    "supportedKeywords",
                    "supportedFunctions",
                    "suggestPrefixnamesForPredicates",
                    "supportedPredicateSuggestions",
                    "suggestedPrefixes",
                ),
            },
        ),
        (
            "Variable Names",
            {
                "fields": (
                    "suggestionEntityVariable",
                    "suggestionNameVariable",
                    "suggestionAltNameVariable",
                    "suggestionReversedVariable",
                ),
                "description": "Define the variable names that are used in the warmup and autocomplete queries below.",
            },
        ),
        (
            "Frequent Predicates",
            {
                "fields": ("frequentPredicates", "frequentPatternsWithoutOrder"),
                "description": 'Frequent predicates that should be pinned to the cache (can be left empty). Separate by space. You can use all the prefixes from "Suggested Prefixes" (e.g. wdt:P31 if "Suggested Prefixes" defines the prefix for wdt), but you can also write full IRIs.',
            },
        ),
        (
            "Warmup Query Patterns",
            {
                "fields": (
                    "entityNameAndAliasPattern",
                    "entityScorePattern",
                    "predicateNameAndAliasPatternWithoutContext",
                    "predicateNameAndAliasPatternWithContext",
                    "entityNameAndAliasPatternDefault",
                    "predicateNameAndAliasPatternWithoutContextDefault",
                    "predicateNameAndAliasPatternWithContextDefault",
                ),
                "description": 'The patterns used in the warmup queries below. The idea is that you only have to adapt a few and then the warmup queries and the AC queries just work out of the box.<br><br>The "Name and Alias" patterns are typically defined with KB-specific predicates such as rdfs:label or fb:type.object.name. However usually not all entities in a knowledge base have such names. As a fallback, therefore also names according to the patterns labelled as "... (default)" are used.',
            },
        ),
        (
            "Warmup Queries",
            {
                "fields": (
                    "warmupQuery1",
                    "warmupQuery2",
                    "warmupQuery3",
                    "warmupQuery4",
                    "warmupQuery5",
                ),
                "description": "The warmup queries. These warmup queries are written in such a way that for almost all knowledge bases, you have to adapat only the patterns, not these warmup query templates.",
            },
        ),
        (
            "Autocomplete Settings",
            {
                "fields": (
                    "dynamicSuggestions",
                    "defaultModeTimeout",
                    "mixedModeTimeout",
                    "replacePredicates",
                ),
            },
        ),
        (
            "Autocomplete Queries (context-sensitive)",
            {
                "fields": ("suggestSubjects", "suggestPredicates", "suggestObjects"),
            },
        ),
        (
            "Autocomplete Queries (context-insensitive)",
            {
                "fields": (
                    "suggestSubjectsContextInsensitive",
                    "suggestPredicatesContextInsensitive",
                    "suggestObjectsContextInsensitive",
                ),
            },
        ),
        (
            "Showing names",
            {
                "fields": (
                    "subjectName",
                    "alternativeSubjectName",
                    "predicateName",
                    "alternativePredicateName",
                    "objectName",
                    "alternativeObjectName",
                ),
            },
        ),
    )

    def change_view(self, request, object_id, form_url="", extra_context=None):
        extra_context = extra_context or {}
        extra_context["warmupTargets"] = warmup.Command.Targets.choices
        extra_context["object_id"] = object_id
        return super(BackendAdmin, self).change_view(
            request,
            object_id,
            form_url,
            extra_context=extra_context,
        )

    def get_form(self, request, obj=None, **kwargs):
        t = super().get_form(request, obj, **kwargs)
        obj = obj or BackendDefaults.objects.first()
        if obj:
            obj.useBackendDefaults = False
            for fieldName in t.base_fields:
                if fieldName in BackendDefaults.AVAILABLE_DEFAULTS:
                    t.base_fields[fieldName].widget.attrs["placeholder"] = (
                        obj.__getattribute__(fieldName, forceUseDefault=True)
                    )
        return t

    def get_queryset(self, request):
        qs = super(BackendAdmin, self).get_queryset(request)
        return qs.filter(backenddefaults__isnull=True)


class BackendDefaultsAdmin(ImportExportModelAdmin):
    formfield_overrides = {
        models.CharField: {"widget": TextInput(attrs={"size": "140"})},
        models.TextField: {"widget": Adaptingtextarea()},
    }
    # Uses the following sections of the BackendAdmin fieldsets
    #  - Variable Names
    #  - Frequent Predicates
    #  - Warmup Query Patterns
    #  - Warmup Queries
    #  - Autocomplete Settings
    #  - Autocomplete Queries (context-sensitive)
    #  - Autocomplete Queries (context-insensitive)
    fieldsets = (
        ("General", {"fields": ("apiToken",)}),
        ("UI Suggestions", {"fields": ("supportedKeywords",)}),
    ) + BackendAdmin.fieldsets[2:9]


class ExampleAdmin(ImportExportModelAdmin):
    list_display = ["backend", "name"]


class LinkAdmin(admin.ModelAdmin):
    list_display = ["identifier", "content"]


admin.site.unregister(Group)

admin.site.register(Backend, BackendAdmin)
admin.site.register(Example, ExampleAdmin)
admin.site.register(BackendDefaults, BackendDefaultsAdmin)
# admin.site.register(Link, LinkAdmin)
