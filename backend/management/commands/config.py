from django.core.management.base import BaseCommand
from backend.models import Backend
from backend.models import Example
import yaml


class Command(BaseCommand):
    help = (
        "Usage: python manage.py config <backend> <field> <value>\n"
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
        parser.add_argument("backend_slug", help="Slug of the backend")
        parser.add_argument(
            "config_file",
            nargs="?",
            help="If provided, set the backend config " "according to this YAML file",
        )
        parser.add_argument(
            "--hide-all-other-backends",
            action="store_true",
            default=False,
            help="Hide all other backends (set sort key to 0)",
        )

    # Return a YAML string for the given dictionary. Format values with
    # newlines using the "|" style.
    def dict_to_yaml(self, dictionary):
        # Custom representer for yaml, which uses the "|" style only for
        # multiline strings.
        #
        # NOTE: We eeplace all `\r\n` with `\n` because otherwise the `|` style
        # does not work as expected.
        class MultiLineDumper(yaml.Dumper):
            def represent_scalar(self, tag, value, style=None):
                value = value.replace("\r\n", "\n")
                if isinstance(value, str) and "\n" in value:
                    style = "|"
                return super().represent_scalar(tag, value, style)

        # Dump as yaml.
        return yaml.dump(
            dictionary,
            sort_keys=False,
            Dumper=MultiLineDumper,
        )

    # Get backend config and examples for the given `backend_slug`. Return the
    # result as a nicely formatted YAML string.
    def get_backend_config(self, backend_slug):
        backend = Backend.objects.filter(slug=backend_slug).get()
        backend_id = backend.id

        # Get the `Backend` config for this backend.
        backend_config = {}
        for field in Backend._meta.get_fields():
            value = getattr(backend, field.name, None)
            if value is not None:
                backend_config[field.name] = str(value)

        # Get all `Example` queries for this backend.
        backend_examples = []
        for example in Example.objects.filter(backend_id=backend_id):
            backend_examples.append(
                {
                    "name": example.name,
                    "sort_key": example.sortKey,
                    "query": example.query,
                }
            )

        # Return as YAML.
        return self.dict_to_yaml(
            {
                "config": {
                    "backend": backend_config,
                    "examples": backend_examples,
                }
            }
        )

    # Set the backend config for the given `backend_slug` according to the
    # given `config_yaml`.
    def set_backend_config(self, backend_slug, config_yaml):
        backend = Backend.objects.filter(slug=backend_slug).get()
        backend_id = backend.id

        # Parse the `config_yaml` as a dictionary.
        try:
            config = yaml.safe_load(config_yaml)
        except Exception as e:
            raise Exception(f"Error parsing YAML: {e}")

        # Check that the `config_yaml` has a top-level `config` key, with
        # exactly two keys: `backend` and `examples`.
        if "config" not in config:
            raise Exception("No `config` key found in YAML")
        if not isinstance(config["config"], dict):
            raise Exception("`config` key is not a dictionary")
        if "backend" not in config["config"]:
            raise Exception("No `backend` key found in `config`")
        if "examples" not in config["config"]:
            raise Exception("No `examples` key found in `config`")
        if not isinstance(config["config"]["backend"], dict):
            raise Exception("`backend` key is not a dictionary")
        if not isinstance(config["config"]["examples"], list):
            raise Exception("`examples` key is not a list")
        backend_config = config["config"]["backend"]
        backend_examples = config["config"]["examples"]

        # Check that all the keys in `backend_config` are valid fields of the
        # `Backend` model and that all the `backend_examples` are dictionaries
        # with the fields `name`, `sort_key`, and `query`.
        for key in backend_config:
            if not hasattr(backend, key):
                raise Exception(
                    f"Field `{key}` is not a valid field of the `Backend` model"
                )
        for index, example in enumerate(config["config"]["examples"]):
            if not isinstance(example, dict):
                raise Exception(f"Example #{index} is not a dictionary")
            if "name" not in example:
                raise Exception(f"No `name` key found in example #{index}")
            if "sort_key" not in example:
                raise Exception(f"No `sort_key` key found in example #{index}")
            if "query" not in example:
                raise Exception(f"No `query` key found in example #{index}")

        # Check that the `id` and `slug` of the backend match `backend_id` and
        # `backend_slug`, respectively.
        backend_config_id = backend_config.get("id", None)
        backend_config_slug = backend_config.get("slug", None)
        try:
            backend_config_id = int(backend_config_id)
        except Exception:
            raise Exception(f"Id `{backend_config_id}` is not an integer")
        if backend_config_id != backend_id:
            raise Exception(
                f"Id {backend_config_id} from YAML does not match backend id "
                f"{backend_id} obtained via slug `{backend_slug}`"
            )
        if backend_config_slug != backend_slug:
            raise Exception(
                f"Slug {backend_config_slug} from YAML does not match backend "
                f"slug `{backend_slug}`"
            )

        # Update the backend config.
        Backend.objects.filter(id=backend_id).update(**backend_config)
        print(
            f"Updated backend config for `{backend_slug}` "
            f"(number of fields: {len(backend_config)})"
        )

        # Update the examples.
        Example.objects.filter(backend_id=backend_id).delete()
        for example in backend_examples:
            Example.objects.create(
                backend_id=backend_id,
                name=example["name"],
                sortKey=example["sort_key"],
                query=example["query"],
            )
        print(
            f"Updated examples for `{backend_slug}` "
            f"(number of examples: {len(backend_examples)})"
        )

    # Handle the command.
    def handle(self, *args, returnLog=False, **options):
        backend_slug = options["backend_slug"]

        # If a `config_file` is provided, set the backend config according to
        # this YAML file.
        if options["config_file"]:
            config_file = options["config_file"]
            with open(config_file) as f:
                config_yaml = f.read()
            try:
                self.set_backend_config(backend_slug, config_yaml)
            except Exception as e:
                print(f"ERROR: {e}")
                return

            # If `--hide-all-other-backends` is provided, hide all other
            # backends.
            if options["hide_all_other_backends"]:
                try:
                    for other_backend in Backend.objects.exclude(slug=backend_slug):
                        other_backend.sortKey = 0
                        other_backend.save()
                    print(f"All backends other than `{backend_slug}` are hidden "
                          f"(sort key set to 0)")
                except Exception as e:
                    self.log(f"ERROR: {e}")

            return

        # Otherwise, get the backend config as a YAML string.
        config_yaml = self.get_backend_config(backend_slug)
        print(config_yaml)
        return

        # self.log(f"Updating {connection.settings_dict['NAME']} ...")
        # self.log("Handling `update` command ...")
        # field = options["field"]
        # value = options["value"]

        # Get all available fields of the backend.
        # fields = [f.name for f in Backend._meta.get_fields()]
        # return f"Available fields: {', '.join(fields)}"

        # self.log(f"Fetching value of field `{field}` from backend `{backend.slug}` ...")
        # value_before = getattr(backend, field, None)
        # if value_before is None:
        #     return [f"Field `{field}` does not exist in backend `{backend.slug}`"]
        # self.log(f"Value of field `{field}` before update: {value_before}")
        # return self.log_messages
