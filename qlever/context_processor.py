from django.conf import settings

def additional_context(request):
    my_dict = {
        'DEBUG': settings.DEBUG,
        'STATIC_VERSION': settings.STATIC_VERSION,
    }

    return my_dict