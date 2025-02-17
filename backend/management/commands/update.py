from django.core.management.base import BaseCommand
from backend.models import Backend
import yaml


class Command(BaseCommand):
    help = (
        "Usage: python manage.py update <backend> <field> <value>\n"
        "\n"
        "Update the specified field of the specified backend to the specified value"
    )

    # Constructor.
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.log_messages = []

    # Custom log function.
    def log(self, msg=""):
        print(msg)
        self.log_messages.append(msg)

    # Command line arguments.
    def add_arguments(self, parser):
        parser.add_argument("backend_slug", help="Slug of the backends to update")
        # parser.add_argument("field", help="Field to update")
        # parser.add_argument("value", help="Value to set the field to")

    def handle(self, *args, returnLog=False, **options):
        # self.log(f"Updating {connection.settings_dict['NAME']} ...")
        # self.log("Handling `update` command ...")
        backend = Backend.objects.filter(slug=options["backend_slug"]).get()
        # field = options["field"]
        # value = options["value"]

        # Custom representer for yaml, which uses the "|" style only for multiline strings.
        class MultiLineDumper(yaml.Dumper):
            def represent_scalar(self, tag, value, style=None):
                if isinstance(value, str) and "\n" in value:
                    style = "|"
                return super().represent_scalar(tag, value, style)

        # Get the contents of all fields of `backend`, as yaml.
        config = {"config": {}}
        for field in Backend._meta.get_fields():
            value = getattr(backend, field.name, None)
            if value is not None:
                config["config"][field.name] = str(value)
        config_yaml = yaml.dump(
            config,
            # default_flow_style=False,
            sort_keys=False,
            Dumper=MultiLineDumper,
        )
        print(config_yaml)
        return

        # Get all available fields of the backend.
        fields = [f.name for f in Backend._meta.get_fields()]
        return f"Available fields: {', '.join(fields)}"

        # self.log(f"Fetching value of field `{field}` from backend `{backend.slug}` ...")
        # value_before = getattr(backend, field, None)
        # if value_before is None:
        #     return [f"Field `{field}` does not exist in backend `{backend.slug}`"]
        # self.log(f"Value of field `{field}` before update: {value_before}")
        # return self.log_messages
