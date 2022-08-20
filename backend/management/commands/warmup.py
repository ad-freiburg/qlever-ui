from django.core.management.base import BaseCommand, CommandError
from django.db.models import TextChoices
from backend.models import Backend
import requests
import sys


class Command(BaseCommand):
    help = 'Usage: python manage.py warmup <backend name / slug / id> [target]'
    help += '\npossible targets are:'
    help += '\n  - clear_and_pin  (default)'
    help += '\n  - pin'
    help += '\n  - clear'
    help += '\n  - clear-unpinned'
    help += '\n  - show-all-ac-queries'

    def __init__(self, *args, **kwargs):
        self._logs = []
        super().__init__( *args, **kwargs)

    class Targets(TextChoices):
        CLEAR_AND_PIN = "clear_and_pin", "Clear and pin"
        PIN = "pin", "Pin"
        CLEAR = "clear", "Clear"
        CLEAR_UNPINNED = "clear_unpinned", "Clear unpinned"
        SHOW_ALL_AC_QUERIES = "show_all_ac_queries", "Show all autocompletion queries"
    
    PRINT_FORMATS = {
        "red": lambda text: f"\033[31m{text}\033[0m",
        "blue": lambda text: f"\033[34m{text}\033[0m",
        "bold": lambda text: f"\033[1m{text}\033[0m",
        None: lambda text: text,
    }

    HTML_FORMATS = {
        "red": lambda text: f'<span style="color: red">{text}</span>',
        "blue": lambda text: f'<span style="color: blue">{text}</span>',
        "bold": lambda text: f'<strong>{text}</strong>',
        None: lambda text: text,
    }

    def add_arguments(self, parser):
        parser.add_argument('backend', nargs=1,
                            help='Id, Slug or Name of a Backend')
        parser.add_argument(
            'target', nargs='?', default="clear_and_pin", help='Id, Slug or Name of a Backend')
    

    
    def log(self, msg, format=None, *args, file=sys.stdout):
        if args:
            msg += " " + " ".join(str(arg) for arg in args)
        
        printMsg = self.PRINT_FORMATS[format](msg)
        htmlMsg = self.HTML_FORMATS[format](msg)
        self._logs.append(htmlMsg)
        print(printMsg, file=file)

    def handle(self, *args, returnLog=False, **options):
        target = options["target"]
        backend = options["backend"][0]

        backends = Backend.objects.filter(
            name=backend) | Backend.objects.filter(slug=backend)

        try:
            backends = backends | Backend.objects.filter(id=backend)
        except (ValueError, TypeError):
            pass

        backend = backends.first()

        if not backend:
            raise CommandError(
                "Please specify a Backend by providing it's name, slug or ID"
            )

        self.backend = backend

        if target == self.Targets.CLEAR_AND_PIN:
            self.clear()
            self.pin()
            self.clear(onlyUnpinned=True)
        elif target == self.Targets.PIN:
            self.pin()
        elif target == self.Targets.CLEAR:
            self.clear()
        elif target == self.Targets.CLEAR_UNPINNED:
            self.clear(onlyUnpinned=True)
        elif target == self.Targets.SHOW_ALL_AC_QUERIES:
            self.showAutocompleteQueries()
        else:
            raise CommandError("Unknown target: " + target)

        if returnLog:
            return self._logs

    def request_to_qlever(self, params):
        headers = { "Accept": "application/qlever-results+json" }
        # print(f"PYTHON VERSION: {sys.version}", file=sys.stderr)
        try:
            response = requests.post(self.backend.baseUrl, data=params, headers=headers)
            # response = requests.get(self.backend.baseUrl, params=params, headers=headers)
            response.raise_for_status()
            return response
        except requests.exceptions.RequestException as e:
            self.log(f"An exception of type {type(e).__name__} occurred ({e})",
                    format="red", file=sys.stderr)
            return None

    def clear(self, onlyUnpinned=False):
        if onlyUnpinned:
            msg = "Clear cache, but only the unpinned results"
            params = {"cmd": "clear-cache"}
        else:
            msg = "Clear cache completely, including the pinned results"
            params = {"cmd": "clear-cache-complete"}
        self.log(msg, format="bold")
        response = self.request_to_qlever(params)

    def pin(self):
        prefixString = self._getPrefixString()

        warmups = (
            (self.backend.warmupQuery1,
             "Entities names aliases score, ordered by score, full result for Subject AC query with empty prefix"),
            (self.backend.warmupQuery2,
             "Entities names aliases score, ordered by alias, part of Subject AC query with non-empty prefix"),
            (self.backend.warmupQuery3,
             "Entities names aliases score, ordered by entity, part of Object AC query"),
            (self.backend.warmupQuery4,
             "Predicates names aliases score, without prefix (only wdt: and schema:about)"),
            (self.backend.warmupQuery5,
             "Predicates names aliases score, with prefix (all predicates)"),
        )

        # pin warmup queries
        for warmup, headline in warmups:
            self.log(" ")
            self.log(f"Pin: {headline}", format="bold")
            warmupQuery = self._buildQuery(warmup)
            self.log(warmupQuery)
            self._pinQuery(f"{prefixString}\n{warmupQuery}")

        # clear unpinned
        self.log(" ")
        self.clear(onlyUnpinned=True)

        # pin frequent predicates
        for predicate in self.backend.frequentPredicates.split(" "):
            if not predicate:
                continue
            self.log(" ")
            self.log(f"Pin: {predicate} ordered by subject", format="bold")
            query = f"SELECT ?x ?y WHERE {{ ?x {predicate} ?y }} ORDER BY ?x"
            self.log(query)
            self._pinQuery(f"{prefixString}\n{query}")

            self.log(" ")
            self.log(f"Pin: {predicate} ordered by object", format="bold")
            query = f"SELECT ?x ?y WHERE {{ ?x {predicate} ?y }} ORDER BY ?y"
            self.log(query)
            self._pinQuery(f"{prefixString}\n{query}")

        # pin frequent patterns
        for pattern in self.backend.frequentPatternsWithoutOrder.split(" "):
            if not pattern:
                continue
            self.log(" ")
            self.log(f"Pin: {pattern} ordered by subject only", format="bold")
            query = f"SELECT ?x ?y WHERE {{ ?x {pattern} ?y }} ORDER BY ?x"
            self.log(query)
            self._pinQuery(f"{prefixString}\n{query}")

    def showAutocompleteQueries(self):
        self.log("Subject AC query", format="bold")
        self.log(self._buildQuery(self.backend.suggestSubjects))
        self.log("Predicate AC query", format="bold")
        self.log(self._buildQuery(self.backend.suggestSubjects))
        self.log("Object AC query", format="bold")
        self.log(self._buildQuery(self.backend.suggestSubjects))

    def _buildQuery(self, completionQuery):
        substitutionFinished = True
        for placeholder, replacement in self.backend.getWarmupAndAcPlaceholders().items():
            newQuery = completionQuery.replace(f"%{placeholder}%", replacement)
            if (newQuery != completionQuery):
                substitutionFinished = False
                completionQuery = newQuery

        if substitutionFinished:
            # replace prefixes
            if "%PREFIXES%" in completionQuery:
                prefixString = self._getPrefixString() + "\n%PREFIXES%"
                completionQuery = completionQuery.replace(
                    "%PREFIXES%", prefixString)
            return completionQuery
        else:
            return self._buildQuery(completionQuery)

    def _getPrefixString(self):
        prefixString = "\n".join(
            [f"PREFIX {prefixName}: <{prefix}>" for prefixName, prefix in self.backend.availablePrefixes.items()])
        return prefixString

    def _pinQuery(self, query):
        params = { "query": query, "pinresult": "true", "send": "10" }
        response = self.request_to_qlever(params)
        if response:
            jsonData = response.json()
            if "exception" in jsonData:
                self.log(f"ERROR in processing query: {jsonData['exception']}",
                        format="red")
            else:
                self.log(f"Result size: {jsonData['resultsize']:,}", format="blue")
