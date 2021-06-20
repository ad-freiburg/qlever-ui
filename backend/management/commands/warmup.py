from django.core.management.base import BaseCommand, CommandError
from backend.models import Backend
import requests


class Command(BaseCommand):
    help = 'Usage: python manage.py warmup <backend name / slug / id> [target]'
    help += '\npossible targets are:'
    help += '\n  - clear_and_pin  (default)'
    help += '\n  - pin'
    help += '\n  - clear'
    help += '\n  - clear-unpinned'
    help += '\n  - show-all-ac-queries'

    def add_arguments(self, parser):
        parser.add_argument('backend', nargs=1,
                            help='Id, Slug or Name of a Backend')
        parser.add_argument(
            'target', nargs='?', default="clear_and_pin", help='Id, Slug or Name of a Backend')

    def handle(self, *args, **options):
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

        if target == "clear_and_pin":
            self.clear()
            self.pin()
            self.clear(onlyUnpinned=True)
        elif target == "pin":
            self.pin()
        elif target == "clear":
            self.clear()
        elif target == "clear-unpinned":
            self.clear(onlyUnpinned=True)
        elif target == "show-all-ac-queries":
            self.showAutocompleteQueries()
        else:
            raise CommandError("Unknown target: " + target)

    def clear(self, onlyUnpinned=False):
        if onlyUnpinned:
            msg = "\033[1mClear cache, but only the unpinned results\033[0m"
            params = {"cmd": "clearcache"}
        else:
            msg = "\033[1mClear cache completely, including the pinned results\033[0m"
            params = {"cmd": "clearcachecomplete"}
        print(msg)
        response = requests.get(self.backend.baseUrl, params=params)
        response.raise_for_status()

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
            print(f"\n\033[1mPin: {headline}\033[0m")
            warmupQuery = self._buildQuery(warmup)
            print(warmupQuery)
            self._pinQuery(f"{prefixString} {warmupQuery}")

        # pin frequent predicates
        for predicate in self.backend.frequentPredicates.split(" "):
            if not predicate:
                continue
            print(f"\n\033[1mPin: {predicate} ordered by subject\033[0m")
            query = f"{prefixString}\nSELECT ?x ?y WHERE {{ ?x {predicate} ?y }} ORDER BY ?x"
            print(query)
            self._pinQuery(query)

            print(f"\n\033[1mPin: {predicate} ordered by object\033[0m")
            query = f"{prefixString}\nSELECT ?x ?y WHERE {{ ?x {predicate} ?y }} ORDER BY ?y"
            print(query)
            self._pinQuery(query)

        # pin frequent patterns
        for pattern in self.backend.frequentPatternsWithoutOrder.split(" "):
            if not pattern:
                continue
            print(f"\n\033[1mPin: {pattern} without ORDER BY\033[0m")
            query = f"{prefixString}\nSELECT ?x ?y WHERE {{ ?x {pattern} ?y }}"
            print(query)
            self._pinQuery(query)

    def showAutocompleteQueries(self):
        print("\n\033[1mSubject AC query\033[0m\n")
        print(self._buildQuery(self.backend.suggestSubjects))
        print("\n\033[1mPredicate AC query\033[0m\n")
        print(self._buildQuery(self.backend.suggestSubjects))
        print("\n\033[1mObject AC query\033[0m\n")
        print(self._buildQuery(self.backend.suggestSubjects))

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
        params = {"pinresult": "true", "send": "10", "query": query}
        response = requests.get(self.backend.baseUrl, params=params)
        response.raise_for_status()
        jsonData = response.json()
        if "exception" in jsonData:
            print("\033[31mERROR:\033[0m", jsonData["exception"])
        else:
            print(f"\033[34mResult size: {jsonData['resultsize']:,}\033[0m")
