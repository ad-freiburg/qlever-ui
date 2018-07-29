from django.conf.urls import url
from django.contrib import admin

from . import views

urlpatterns = [
    url(r'^$', views.index, name='index'),
    url(r'^ngrams$', views.generateNGrams, name='generateNGrams'),
    url(r'^suggest$', views.getSuggestions, name='getSuggestions'),
    url(r'^reindex$', views.importElements, name='importElements'),
]
