from django.core.management.base import BaseCommand, CommandError
from backend.models import Backend

class Command(BaseCommand):
    help = ("Usage: python manage.py update <backend_slug> <key> <value>\n"
            "\n"
            "Update key/value in database.")

    # Copied from warmup.py, is this really needed?
    def __init__(self, *args, **kwargs):
        super().__init__( *args, **kwargs)

    # Custom log function.
    def log(self, msg=""):
        print(msg)

    # Command line arguments.
    def add_arguments(self, parser):
        parser.add_argument("backend_slug", nargs=1,
                            help="Slug of the selected backend")
        parser.add_argument("key", nargs=1,
                            help="Key to update")
        parser.add_argument("value", nargs=1,
                            help="New value to set")

    def handle(self, *args, returnLog=False, **options):
        backend_slug = options["backend_slug"][0]
        key = options["key"][0]
        value = options["value"][0]

        self.log(f"Update database: set {key} to {value} ...")
        try:
            backend = Backend.objects.filter(slug=backend_slug).get()
            setattr(backend, key, value)
            backend.save()
        except Exception as e:
            self.log(f"ERROR: {e}")
            return
