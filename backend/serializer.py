import backend
from backend.models import Backend, Example
from rest_framework import serializers


class BackendListSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Backend
        fields = ["name", "slug", "url"]
        extra_kwargs = {
            "url": {"view_name": "backend-detail", "lookup_field": "slug"}
        }


class BackendDetailSerializer(serializers.HyperlinkedModelSerializer):
    examples = serializers.SerializerMethodField()
    prefix_map = serializers.SerializerMethodField()

    class Meta:
        model = Backend
        exclude = ["url"]

    def get_examples(self, obj):
        examples = Example.objects.filter(backend=obj).order_by("sortKey")
        return [example.as_dict() for example in examples]

    def get_prefix_map(self, obj):
        prefixes = obj.suggestedPrefixes.replace("@", "").split(" .")
        result = {}
        for prefix in prefixes:
            line = prefix.strip()
            if line == "":
                continue
            words = line.split()
            if words[1][-1] != ":":
                continue
            result[words[1][:-1]] = words[2]
        return result
