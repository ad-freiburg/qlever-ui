from django.core.management.base import BaseCommand, CommandError
from backend.models import Backend
from backend.models import Link
from django.contrib.auth.models import User
from django.contrib.sessions.models import Session
from django.db import connection, transaction

class Command(BaseCommand):
    help = ("Usage: python manage.py cleanup <backends to keep>\n"
            "\n"
            "Removes all data from the sqlite3 database, except "
            "the core data needed by data and all data associated "
            "with the specified backends. Also removes all users "
            "and adds a demo user with password \"demo\" and all "
            "rights")

    # Copied from warmup.py, is this really needed?
    def __init__(self, *args, **kwargs):
        super().__init__( *args, **kwargs)

    # Custom log function.
    def log(self, msg=""):
        print(msg)

    # Command line arguments.
    def add_arguments(self, parser):
        parser.add_argument("backend_slugs", nargs="*",
                            help="Slugs of the backends to keep")

    def handle(self, *args, returnLog=False, **options):
        self.log("Cleaning up db/qleverui.sqlite3 ...")
        backend_slugs = options["backend_slugs"]
        # Remove all the backends NOT specified.
        self.log(f"Remove all backends except: {backend_slugs} ...")
        Backend.objects.exclude(slug__in=backend_slugs).exclude(slug__contains="globaldefaults").delete()
        # Remove all links.
        self.log(f"Remove all links ...")
        Link.objects.all().delete()
        # Remove all users and add demo user.
        self.log(f"Remove all users and add demo user ...")
        User.objects.all().delete()
        User.objects.create_user(username="demo", password="demo", is_staff=True, is_superuser=True)
        # Remove all sessions.
        self.log(f"Remove all session info ...")
        Session.objects.all().delete()
        # Vacuum the database.
        self.log(f"Compress the database file after cleaning up (with VACUUM) ...")
        cursor = connection.cursor()
        cursor.execute("VACUUM;")
