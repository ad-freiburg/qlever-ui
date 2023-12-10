from django.core.management.base import BaseCommand, CommandError
from django.db.models import TextChoices
from backend.models import Backend
import requests
import sys
import re


class Command(BaseCommand):
    help = 'Usage: python manage.py warmup <backend name / slug / id> [target]'
    help += '\npossible targets are:'
    help += '\n  - clear_and_pin  (default)'
    help += '\n  - pin'
    help += '\n  - clear'
    help += '\n  - clear-unpinned'
    help += '\n  - queries'
    help += '\n  - show-all-ac-queries'

    # Initialization. The `backend` and `warmupQueries` will be set first thing
    # in `handle` below.
    def __init__(self, *args, **kwargs):
        self._logs = []
        super().__init__(*args, **kwargs)
        self.backend = None

    class Targets(TextChoices):
        CLEAR_AND_PIN = "clear_and_pin", "Clear and pin"
        PIN = "pin", "Pin"
        CLEAR = "clear", "Clear"
        CLEAR_UNPINNED = "clear_unpinned", "Clear unpinned"
        QUERIES = "queries", "Queries"
        SHOW_ALL_AC_QUERIES = "show_all_ac_queries", \
                              "Show all autocompletion queries"

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
            'target', nargs='?', default="clear_and_pin",
            help='Id, Slug or Name of a Backend')

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

        # Determine backend.
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

        # Get the warmup queries.
        self. warmupQueries = [
            (self.backend.warmupQuery1,
             "Entities names aliases score, ordered by score"),
            (self.backend.warmupQuery2,
             "Entities names aliases score, ordered by alias"),
            (self.backend.warmupQuery3,
             "Entities names aliases score, ordered by entity"),
            (self.backend.warmupQuery4,
             "Predicates names aliases score, for use without prefix"),
            (self.backend.warmupQuery5,
             "Predicates names aliases score, for use with prefix"),
            ]

        # EXPERIMENTAL: For Pubchem, add result of half-sensitive object AC for
        # predicate rdf:type to warmup queries.
        if self.backend.slug == "pubchem":
            for predicate in ["rdf:type"]:
                halfSensitiveWarmupQuery = (
                    "SELECT ?type (COUNT(?type) AS ?count) WHERE {\n"
                    "  ?subject " + predicate + " ?type\n"
                    "} GROUP BY ?type")
                self.warmupQueries.append(
                    (halfSensitiveWarmupQuery,
                     "Half-sensitive object AC query for predicate " +
                     predicate))

        # Do something depending on the target.
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
        elif target == self.Targets.QUERIES:
            return self.getAllWarmupQueries()
        elif target == self.Targets.SHOW_ALL_AC_QUERIES:
            self.showAutocompleteQueries()
        else:
            raise CommandError("Unknown target: " + target)

        # TODO: Not sure what this is good for.
        if returnLog:
            return self._logs

    # Send a request to QLever.
    def request_to_qlever(self, params):
        headers = {"Accept": "application/qlever-results+json"}
        try:
            response = requests.post(self.backend.baseUrl,
                                     data=params, headers=headers)
            return response
        except requests.exceptions.RequestException as e:
            self.log(f"Error requesting {self.backend.baseUrl}: {e}",
                     format="red")
            return None

    # Clear the cache.
    def clear(self, onlyUnpinned=False):
        if onlyUnpinned:
            msg = "Clear cache, but only the unpinned results"
            params = {"cmd": "clear-cache"}
        else:
            msg = "Clear cache completely, including the pinned results"
            params = {"cmd": "clear-cache-complete"}
        self.log(msg, format="bold")
        self.request_to_qlever(params)

    # Pin warmup queries and frequent predicates.
    def pin(self):
        prefixString = self._getPrefixString()

        # Pin warmup queries.
        for warmupQuery, description in self.warmupQueries:
            self.log(" ")
            self.log(f"Pin: {description}", format="bold")
            warmupQuery = self._buildQuery(warmupQuery)
            self.log(warmupQuery)
            warmupQuery = f"{prefixString}\n{warmupQuery}"
            self._pinQuery(warmupQuery)

        # Clear the rest of the cache.
        self.log(" ")
        self.clear(onlyUnpinned=True)

        # Pin frequent predicates (two orders each: by subject and by object).
        for predicate in self.backend.frequentPredicates.split(" "):
            if not predicate or predicate.startswith("#"):
                continue
            self.log(" ")
            self.log(f"Pin: {predicate} ordered by subject", format="bold")
            query = (f"SELECT ?x ?y WHERE {{ ?x {predicate} ?y }} "
                     f"INTERNAL SORT BY ?x")
            self.log(query)
            self._pinQuery(f"{prefixString}\n{query}")

            self.log(" ")
            self.log(f"Pin: {predicate} ordered by object", format="bold")
            query = (f"SELECT ?x ?y WHERE {{ ?x {predicate} ?y }} "
                     f"INTERNAL SORT BY ?y")
            self.log(query)
            self._pinQuery(f"{prefixString}\n{query}")

        # Pin frequent predicates (ordered by subject only).
        for pattern in self.backend.frequentPatternsWithoutOrder.split(" "):
            if not pattern or pattern.startswith("#"):
                continue
            self.log(" ")
            self.log(f"Pin: {pattern} ordered by subject only", format="bold")
            query = (f"SELECT ?x ?y WHERE {{ ?x {pattern} ?y }} "
                     f"INTERNAL SORT BY ?x")
            self.log(query)
            self._pinQuery(f"{prefixString}\n{query}")

    # TODO: Deprecated, but there is still a button in the frontend using this.
    def showAutocompleteQueries(self):
        self.log("Subject AC query", format="bold")
        self.log(self._buildQuery(self.backend.suggestSubjects))
        self.log("Predicate AC query", format="bold")
        self.log(self._buildQuery(self.backend.suggestSubjects))
        self.log("Object AC query", format="bold")
        self.log(self._buildQuery(self.backend.suggestSubjects))

    # Get TSV with one description and warmup query per line.
    #
    # NOTE: Used by qlever script for action `autocompletion-warmup`.
    def getAllWarmupQueries(self):
        tvs_lines = []
        # The standard warmup queries.
        for warmupQuery, description in self.warmupQueries:
            warmupQuery = self._buildQuery(warmupQuery)
            warmupQuery = self._addPrefixes(warmupQuery)
            warmupQuery = self._normalizeQuery(warmupQuery)
            tvs_lines.append(f"{description}\t{warmupQuery}")
        # The frequent predicates (both orders).
        for predicate in self.backend.frequentPredicates.split(" "):
            if not predicate or predicate.startswith("#"):
                continue
            for sort_by in ["subject", "object"]:
                description = f"{predicate} ordered by {sort_by}"
                query = (f"SELECT ?subject ?object WHERE {{ "
                         f"?subject {predicate} ?object "
                         f"}} INTERNAL SORT BY ?{sort_by}")
                query = self._buildQuery(query)
                query = self._addPrefixes(query)
                query = self._normalizeQuery(query)
                tvs_lines.append(f"{description}\t{query}")
        # The frequent predicates (ordered by subject only).
        for pattern in self.backend.frequentPatternsWithoutOrder.split(" "):
            if not pattern or pattern.startswith("#"):
                continue
            description = f"{pattern} ordered by subject only"
            query = (f"SELECT ?subject ?object WHERE {{ "
                     f"?subject {pattern} ?object "
                     f"}} INTERNAL SORT BY ?subject")
            query = self._buildQuery(query)
            query = self._addPrefixes(query)
            query = self._normalizeQuery(query)
            tvs_lines.append(f"{description}\t{query}")
        return "\n".join(tvs_lines)

    # Fill in the placeholders in the given query.
    def _buildQuery(self, completionQuery):
        substitutionFinished = True
        for placeholder, replacement in \
                self.backend.getWarmupAndAcPlaceholders().items():
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

    # Get all the list of predefined prefixes for the given backend.
    def _getPrefixString(self):
        prefixString = "\n".join(
            [f"PREFIX {prefixName}: <{prefix}>" for prefixName,
             prefix in self.backend.availablePrefixes.items()])
        return prefixString

    # Add only those prefixes to the query that are actually used in the query.
    def _addPrefixes(self, query):
        prefixNames = re.findall(r"([a-zA-Z0-9]+):[a-zA-Z0-9]+", query)
        prefixDefinitions = []
        for prefixName in list(dict.fromkeys(prefixNames)):
            prefix = self.backend.availablePrefixes[prefixName]
            prefixDefinitions.append(f"PREFIX {prefixName}: <{prefix}>")
        return "\n".join(prefixDefinitions) + "\n" + query

    # Pin the given query.
    def _pinQuery(self, query):
        params = {"query": query, "pinresult": "true", "send": "10"}
        response = self.request_to_qlever(params)
        if response is not None:
            jsonData = response.json()
            if "exception" in jsonData:
                self.log(f"ERROR processing query: {jsonData['exception']}",
                         format="red")
            else:
                self.log(f"Result size: {jsonData['resultsize']:,}",
                         format="blue")

    # Normalize the given query to a one-liner.
    #
    # TODO: Copied from commands/exampls.py -> this should be at one place.
    def _normalizeQuery(self, query):
        # Replace # in IRIs by %23.
        query = re.sub(r'(<[^>]+)#', r'\1%23', query)
        # Remove comments.
        query = re.sub(r'#.*\n', ' ', query, flags=re.MULTILINE)
        # Re-replace %23 in IRIs by #.
        query = re.sub(r'(<[^>]+)%23', r'\1#', query)
        # Replace all sequences of whitespace by a single space.
        query = re.sub(r'\s+', ' ', query)
        # Remove . before }.
        query = re.sub(r'\s*\.\s*}', ' }', query)
        # Remove any trailing whitespace.
        query = query.strip()
        return query
