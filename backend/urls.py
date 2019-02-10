from django.conf.urls import url
from django.contrib import admin

from . import views

urlpatterns = [
    url(r'^(?P<backend>[A-Za-z0-9\+@:%\-_]*)(/(?P<short>[A-Za-z0-9]{6})?)?$',
        views.index,
        name='index'),
    url(r'^api/share$', views.shareLink, name='shareLink'),
]
