from rest_framework import serializers

from backend.models import Backend, Example


class BackendListSerializer(serializers.HyperlinkedModelSerializer):
    """
    Serializer for listing all backends, each with their name, slug, and
    URL of the server processing requests.
    """

    class Meta:
        model = Backend
        fields = ["name", "slug", "url"]
        extra_kwargs = {
            "url": {"view_name": "backend-detail", "lookup_field": "slug"}
        }


class BackendDetailSerializer(serializers.HyperlinkedModelSerializer):
    """
    Serializer for detailed view of a backend; see `models.Backend'.

    Also adds the example queries associated with the backend. The
    `suggestedPrefixes` (which is a a string in `models.Backend`) are converted
    to a dictionary mapping prefix to IRI.
    """

    examples = serializers.SerializerMethodField()
    prefixMap = serializers.SerializerMethodField()

    class Meta:
        model = Backend
        exclude = ["url"]

    def get_examples(self, obj):
        examples = Example.objects.filter(backend=obj).order_by("sortKey")
        return [example.as_dict() for example in examples]

    def get_prefixMap(self, obj):
        prefixes = obj.suggestedPrefixes.replace("@", "").split(" .")
        result = {}
        for prefix in prefixes:
            line = prefix.strip()
            if line == "":
                continue
            words = line.split()
            if words[1][-1] != ":":
                continue
            elif words[2][0] != "<":
                continue
            elif words[2][-1] != ">":
                continue
            result[words[1][:-1]] = words[2][1:-1]
        return result
