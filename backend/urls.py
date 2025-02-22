from django.urls import re_path

from . import views

urlpatterns = [
    re_path(
        r"^(?P<backend>[A-Za-z0-9\+@:()%\-_]*)(/(?P<short>[A-Za-z0-9]{6})?)?$",
        views.index,
        name="index",
    ),
    re_path(r"^api/share$", views.shareLink, name="shareLink"),
    re_path(
        r"^api/warmup/(?P<backend>[^/]+)/(?P<target>[a-zA-Z0-9_-]+)$",
        views.warmup,
        name="warmup",
    ),
    re_path(r"^api/examples/(?P<backend>[^/]+)$", views.examples, name="examples"),
    re_path(r"^api/prefixes/(?P<backend>[^/]+)$", views.prefixes, name="prefixes"),
    re_path(r"^api/config/(?P<backend>[^/]+)$", views.config, name="config"),
]
