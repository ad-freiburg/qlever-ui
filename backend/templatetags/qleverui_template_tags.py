from django import template

register = template.Library()


@register.filter()
def split(value, arg='\n'):
    return str(value).split(arg)


@register.filter()
def minimum(value, arg):
    return max(value, arg)
