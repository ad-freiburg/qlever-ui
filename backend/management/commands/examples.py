from django.core.management.base import BaseCommand
from backend.models import Backend
from backend.models import Example
import re


# Command to get the example queries from the particular backend, with one line
# per query, in the format:
#
# name of query<TAB>SPARQL query in one line without newlines
#
# TODO: Provide option to return result as JSON.
class Command(BaseCommand):
    help = "Usage: python manage.py examples <argument string>"

    # Copied from warmup.py, is this really needed?
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    # Custom log function.
    def log(self, msg=""):
        print(msg)

    # Command line arguments.
    def add_arguments(self, parser):
        parser.add_argument("slug", nargs=1, help="Slug of the backend")
        parser.add_argument(
            "--output-format",
            choices=["tsv", "yaml"],
            default="tsv",
            help="Output format (default: tsv)",
        )

    # This defines the actual behavior.
    def handle(self, *args, returnLog=False, **options):
        try:
            slug = options["slug"][0]
        except Exception as e:
            self.log(f"Error parsing command line arguments: {e}")
            self.log()
            self.print_help("manage.py", "examples")
            return
        try:
            backend = Backend.objects.filter(slug=slug).get()
        except Exception as e:
            self.log(f'Error finding config with slug "{slug}": {e}')
            return
        # self.log()
        # self.log(f"ID of backend \"{slug}\" is: {backend.pk}")
        # self.log()
        # self.log(f"Keys of Example table: {Example._meta.fields}")
        output_format = options.get("output_format", "tsv")
        if output_format == "tsv":
            result = []
            for example in Example.objects.filter(backend=backend).order_by(
                "sortKey"
            ):
                query_name = example.name
                query_string = self.normalize_query(example.query)
                result.append(f"{query_name}\t{query_string}")
            self.log(
                f'Returning {len(result)} example queries for backend "{slug}"'
            )
            return "\n".join(result) + "\n"
        else:
            result = [f"kb: {backend.slug}\n", "queries:\n"]
            for example in Example.objects.filter(backend=backend).order_by(
                "sortKey"
            ):
                query_name = re.sub(
                    r"^", "    ", example.name, flags=re.MULTILINE
                )
                query_string = re.sub(
                    r"^", "    ", example.query, flags=re.MULTILINE
                )
                result.append(
                    f"- query: |-\n{query_name}\n  sparql: |-\n{query_string}\n"
                )
            return "".join(result)

    # Helper function for normalizing a query (translated from
    # static/js/helper.js).
    def normalize_query(self, query):
        # Replace # in IRIs by %23.
        query = re.sub(r"(<[^>]+)#", r"\1%23", query)
        # Remove comments.
        query = re.sub(r"#.*\n", " ", query, flags=re.MULTILINE)
        # Re-replace %23 in IRIs by #.
        query = re.sub(r"(<[^>]+)%23", r"\1#", query)
        # Replace all sequences of whitespace by a single space.
        query = re.sub(r"\s+", " ", query)
        # Remove . before }.
        query = re.sub(r"\s*\.\s*}", " }", query)
        # Remove any trailing whitespace.
        query = query.strip()

        return query
