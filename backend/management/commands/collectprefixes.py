from django.core.management.base import BaseCommand, CommandError
from backend.models import Backend
from backend.views import collectPrefixes
import sys


class Command(BaseCommand):
    help = 'Collects prefixes for the specified Backend'

    def add_arguments(self, parser):
        parser.add_argument('--name', '-n', help='Name of a Backend')
        parser.add_argument('--id', '-i', help='ID of a Backend')

    def handle(self, *args, **options):
        if options['id']:
            id = options['id']
            try:
                backend = Backend.objects.get(pk=id)
            except Backend.DoesNotExist:
                raise CommandError('Backend with id "%d" does not exist' % id)
        elif options['name']:
            name = options['name']
            try:
                backend = Backend.objects.get(name=name)
            except Backend.DoesNotExist:
                raise CommandError('Backend "%s" does not exist' % name)
        else:
            raise CommandError(
                "Please specify a Backend by providing it's name or ID"
            )
        try:
            collectPrefixes(backend, self.stdout.write)
        except Exception as e:
            raise CommandError(str(e))
        except KeyboardInterrupt:
            backend.isImporting = False
            backend.save()
            sys.exit(0)

        self.stdout.write(self.style.SUCCESS('Successfully collected indexes'))
