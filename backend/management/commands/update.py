from django.core.management.base import BaseCommand, CommandError
from backend.models import Backend
from backend.models import Link
from django.contrib.auth.models import User
from django.contrib.sessions.models import Session
from django.db import connection, transaction


class Command(BaseCommand):
    help = (
        "Usage: python manage.py update <backend> <field> <value>\n"
        "\n"
        "Update the specified field of the specified backend to the specified value"
    )

    # Constructor.
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.log_messages = []

    # Custom log function.
    def log(self, msg=""):
        print(msg)
        self.log_messages.append(msg)

    # Command line arguments.
    def add_arguments(self, parser):
        parser.add_argument("backend_slug", help="Slug of the backends to update")
        parser.add_argument("field", help="Field to update")
        parser.add_argument("value", help="Value to set the field to")

    def handle(self, *args, returnLog=False, **options):
        # self.log(f"Updating {connection.settings_dict['NAME']} ...")
        self.log("Handling `update` command ...")
        backend = Backend.objects.filter(slug=options["backend_slug"]).get()
        field = options["field"]
        value = options["value"]

        # Get all available fields of the backend.
        fields = [f.name for f in Backend._meta.get_fields()]
        return f"Available fields: {', '.join(fields)}"



        self.log(f"Fetching value of field `{field}` from backend `{backend.slug}` ...")
        value_before = getattr(backend, field, None)
        if value_before is None:
            return [f"Field `{field}` does not exist in backend `{backend.slug}`"]
        self.log(f"Value of field `{field}` before update: {value_before}")
        return self.log_messages
