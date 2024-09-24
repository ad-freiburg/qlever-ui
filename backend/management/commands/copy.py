from django.core.management.base import BaseCommand, CommandError
from django.db.models import TextChoices
from backend.models import Backend
from backend.models import Link
from backend.models import Example
from pprint import pprint
import requests
import sys

class Command(BaseCommand):
    help = "Usage: python manage.py configure <argument string>"

    # Copied from warmup.py, is this really needed?
    def __init__(self, *args, **kwargs):
        super().__init__( *args, **kwargs)

    # Custom log function.
    def log(self, msg=""):
        print(msg)

    # Command line arguments.
    def add_arguments(self, parser):
        parser.add_argument("source_slug", nargs=1,
                            help="Slug of the source backend")
        parser.add_argument("dest_spec", nargs=1,
                            help="Slug of the destination backend (must be new)")

    # This defined the actual behavior. See here for how to update the database:
    # https://docs.djangoproject.com/en/5.1/topics/db/queries/
    def handle(self, *args, returnLog=False, **options):
        self.log()
        try:
            source_slug = options["source_slug"][0]
            dest_slug = options["dest_spec"][0]
            # dest_name, dest_slug, dest_url = options["dest_spec"][0].split()
        except Exception as e:
            self.log(f"Error parsing command line arguments: {e}")
            self.log()
            self.print_help("manage.py", "copy")
            return
        self.log(f"Copying config from \"{source_slug}\" to \"{dest_slug}\" ...")
        # self.log(f"Copying config from \"{source_slug}\" to new config "
        #          f"with name \"{dest_name}\", slug \"{dest_slug}\", and "
        #          f"URL \"{dest_url}\" ...")
        # Find the backend config with the given slug.
        try:
            backend = Backend.objects.filter(slug=source_slug).get()
        except Exception as e:
            self.log(f"Error finding config with slug \"{source_slug}\": {e}")
            return
        source_backend_pk = backend.pk
        # self.log()
        # self.log(f"ID of source config is: {source_pk}")
        # self.log()
        # Make a copy and overwrite the name, slug, and URL.
        backend.pk = None
        backend.name = backend.name + " COPY"
        backend.slug = dest_slug
        backend.isDefault = False
        # config.baseUrl = dest_url
        backend.sortKey = 0
        try:
            backend.save()
        except Exception as e:
            self.log(f"Error creating new config: {e}")
            return
        self.log(f"Done, the first few fields are as follows (edit in the QLever UI as you please):")
        self.log()
        self.log(f"Internal ID : {backend.pk}")
        self.log(f"Name        : {backend.name}")
        self.log(f"Slug        : {backend.slug}")
        self.log(f"URL         : {backend.baseUrl}")
        self.log(f"Sort key    : {backend.sortKey}")
        self.log(f"Is default  : {backend.isDefault}")
        self.log()
        # Also copy all the example queries associated with that backend.
        self.log(f"Also copy all the example queries of \"{source_slug}\" ...")
        self.log()
        num_examples_copied = 0
        for example in Example.objects.all():
            if example.backend.pk == source_backend_pk:
                example.pk = None
                example.backend = backend
                example.save()
                num_examples_copied += 1
                # self.log(example.name)
        self.log(f"Done, number of example queries copied: {num_examples_copied}")
        self.log()
