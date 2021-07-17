from django.conf.urls import url
from django.contrib import admin

from . import views

urlpatterns = [
    url(r'^(?P<backend>[A-Za-z0-9\+@:()%\-_]*)(/(?P<short>[A-Za-z0-9]{6})?)?$',
        views.index,
        name='index'),
    url(r'^api/share$', views.shareLink, name='shareLink'),
    url(r'^api/warmup/(?P<backend>\d+)/(?P<target>[a-zA-Z0-9_-]+)$', views.warmup, name='warmup'),
]
