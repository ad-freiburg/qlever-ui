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

class PrefixAdmin(admin.ModelAdmin):
    list_display = ['name', 'prefix', 'backend', 'occurrences']


class ExampleAdmin(admin.ModelAdmin):
    list_display = ['backend', 'name']

admin.site.unregister(Group)

admin.site.register(Backend, BackendAdmin)
admin.site.register(Prefix, PrefixAdmin)
admin.site.register(Example, ExampleAdmin)
