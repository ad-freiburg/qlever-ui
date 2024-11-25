from django.core.management.base import BaseCommand
from backend.models import Backend
import re


# Command to get the PREFIX definitions from the given backend.
class Command(BaseCommand):
    help = "Usage: python manage.py examples <argument string>"

    # Call the parent constructor.
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    # Log to the console.
    def log(self, msg=""):
        print(msg)

    # Command line arguments.
    def add_arguments(self, parser):
        parser.add_argument("slug", nargs=1, help="Slug of the backend")

    # This defines what the command does: it should return a string with one
    # PREFIX definition per line.
    def handle(self, *args, returnLog=False, **options):
        # Get the slug from the command line arguments.
        try:
            slug = options["slug"][0]
        except Exception as e:
            self.log(f"Error parsing command line arguments: {e}")
            self.log()
            self.print_help("manage.py", "prefixes")
            return
        try:
            backend = Backend.objects.filter(slug=slug).get()
        except Exception as e:
            self.log(f'Error finding config with slug "{slug}": {e}')
            return
        # Get the contents of the `suggestPrefixes` field. Replace `@prefix` by
        # `PREFIX` at the beginning of each line and remove the `.` in the end
        # if it is there. Also replace all whitespace by a single space and
        # remove leading and trailing whitespace from each line.
        prefix_defs = backend.suggestedPrefixes.split("\n")
        for i, prefix_def in enumerate(prefix_defs):
            prefix_def = re.sub(r"^@prefix", "PREFIX", prefix_def)
            prefix_def = re.sub(r"\s*\.\s*$", "", prefix_def)
            prefix_def = re.sub(r"\s+", " ", prefix_def)
            prefix_def = prefix_def.strip()
            prefix_defs[i] = prefix_def
        return "\n".join(sorted(prefix_defs)) + "\n"
