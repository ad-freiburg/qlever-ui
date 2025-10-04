from django.forms import Widget


class Adaptingtextarea(Widget):
    template_name = "forms/adaptingtextarea.html"

    def __init__(self, attrs=None):
        default_attrs = {"cols": "140", "rows": False}
        if attrs:
            default_attrs.update(attrs)

        super().__init__(default_attrs)
