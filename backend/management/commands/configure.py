from django.core.management.base import BaseCommand, CommandError
from backend.models import Backend

class Command(BaseCommand):
    help = ("Usage: python manage.py configure <backend slug>\n"
            "\n"
            "Make the specified backend the default and all other "
            "backends invisible (but they are still there and can "
            "be activated in the admin panel")

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

    def handle(self, *args, returnLog=False, **options):
        backend_slug = options["backend_slug"][0]

        self.log(f"Make backend {backend_slug} the default ...")
        try:
            backend = Backend.objects.filter(slug=backend_slug).get()
            backend.isDefault = True
            backend.sortKey = 1
            backend.save()
        except Exception as e:
            self.log(f"ERROR: {e}")
            return

        self.log(f"Hide all other backends (set sort key to 0) ...")
        try:
            for other_backend in Backend.objects.exclude(slug=backend_slug):
                other_backend.sortKey = 0
                other_backend.save()
        except Exception as e:
            self.log(f"ERROR: {e}")
            return
