from django.conf.urls import url
from django.contrib import admin

from . import views

urlpatterns = [
    url(r'^share$', views.shareLink, name='shareLink'),
    url(r'^suggest$', views.getSuggestions, name='getSuggestions'),
    url(r'^(?P<backend>[A-Za-z0-9\+@:%\-_]*)(?P<short>/[A-Za-z0-9]*)?$', views.index, name='index'),
]
