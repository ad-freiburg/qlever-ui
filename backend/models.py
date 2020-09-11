import json
import re
from django.db import models


class Backend(models.Model):
    MODES = ((2, '3. SPARQL & context sensitive entities'),
             (1, '2. SPARQL & context insensitive entities'),
             (0, '1. SPARQL syntax & keywords only'))

    name = models.CharField(
        max_length=500,
        help_text="Choose a name for the backend that helps you to distinguish between multiple backends",
        verbose_name="Name",
        unique=True)
    baseUrl = models.CharField(
        max_length=1000,
        help_text="The URL where to find / call the QLever backend (including http://)",
        verbose_name="Base URL")

    ntFilePath = models.CharField(
        max_length=2000,
        default='',
        blank=True,
        help_text="Local (absolute or relative) path to the source .nt file QLever uses",
        verbose_name="Source Path")
    ntFileLastChange = models.CharField(
        max_length=100, default='0', blank=True, editable=False)

    isDefault = models.BooleanField(
        default=0,
        help_text="Check if this should be the default backend for QLever UI",
        verbose_name="Use as default")

    isImporting = models.BooleanField(default=False, editable=False)

    maxDefault = models.IntegerField(
        default=100,
        help_text="The default for how many lines are shown in the first request",
        verbose_name="Default Maximum")

    filteredLanguage = models.CharField(
        max_length=2000,
        default='en',
        help_text="Comma separated language codes used for filter suggestions",
        verbose_name="Filter languages")

    dynamicSuggestions = models.IntegerField(
        default=2,
        choices=MODES,
        help_text="If you want to disable the dynamic suggestions from QLever or QLever UI by default change this option.",
        verbose_name="Default suggestion mode")

    suggestSubjects = models.TextField(
        default='',
        blank=True,
        help_text="<a href=\"javascript:void(0)\" onclick=\"django.jQuery('.helpSuggestSubjects').slideToggle();\">Need help?</a><div class=\"helpSuggestSubjects\" style=\"display: none;\">Clause that tells QLever UI which subjects to suggest from. Leave blank if you don't want subject suggestions.</div>",
        verbose_name="Suggest subjects clause")

    suggestPredicates = models.TextField(
        default='',
        blank=True,
        help_text="<a href=\"javascript:void(0)\" onclick=\"django.jQuery('.helpSuggestPredicates').slideToggle();\">Need help?</a><div class=\"helpSuggestPredicates\" style=\"display: none;\">Clause that tells QLever UI which predicates to suggest from.</div>",
        verbose_name="Suggest predicates clause")

    suggestObjects = models.TextField(
        default='',
        blank=True,
        help_text="<a href=\"javascript:void(0)\" onclick=\"django.jQuery('.helpSuggestObjects').slideToggle();\">Need help?</a><div class=\"helpSuggestObjects\" style=\"display: none;\">Clause that tells QLever UI which objects to suggest from.</div>",
        verbose_name="Suggest objects clause")

    subjectName = models.TextField(
        default='',
        blank=True,
        help_text="<a href=\"javascript:void(0)\" onclick=\"django.jQuery('.helpSubjectName').slideToggle();\">Need help?</a><div class=\"helpSubjectName\" style=\"display: none;\">Clause that tells QLever UI the name of a subject (without prefixes). Qlever UI expects the following variables to be used:<br>&nbsp;&nbsp;- &nbsp;?qleverui_entity: The subject that we want to get the name of<br>&nbsp;&nbsp;- &nbsp;?qleverui_name: The variable that will hold the subject's name<br>Your clause should end in a dot '.' or closing bracket '}'<br>Your clause will be used as following:<br>SELECT ?qleverui_name WHERE {<br>&nbsp;&nbsp;&nbsp;&nbsp;?qleverui_entity &lt;predicate&gt; &lt;object&gt;<br>&nbsp;&nbsp;&nbsp;&nbsp;OPTIONAL {<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b><em>subject name clause</em></b><br>&nbsp;&nbsp;&nbsp;&nbsp;}<br>}</div>",
        verbose_name="Subject name clause")

    predicateName = models.TextField(
        default='',
        blank=True,
        help_text="<a href=\"javascript:void(0)\" onclick=\"django.jQuery('.helpPredicateName').slideToggle();\">Need help?</a><div class=\"helpPredicateName\" style=\"display: none;\">Clause that tells QLever UI the name of a predicate (without prefixes). Qlever UI expects the following variables to be used:<br>&nbsp;&nbsp;- &nbsp;?qleverui_entity: The predicate that we want to get the name of<br>&nbsp;&nbsp;- &nbsp;?qleverui_name: The variable that will hold the predicate's name<br>Your clause should end in a dot '.' or closing bracket '}'<br>Your clause will be used as following:<br>SELECT ?qleverui_name WHERE {<br>&nbsp;&nbsp;&nbsp;&nbsp;&lt;subject&gt; ?qleverui_entity &lt;object&gt;<br>&nbsp;&nbsp;&nbsp;&nbsp;OPTIONAL {<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b><em>predicate name clause</em></b><br>&nbsp;&nbsp;&nbsp;&nbsp;}<br>}</div>",
        verbose_name="Predicate name clause")

    objectName = models.TextField(
        default='',
        blank=True,
        help_text="<a href=\"javascript:void(0)\" onclick=\"django.jQuery('.helpObjectName').slideToggle();\">Need help?</a><div class=\"helpObjectName\" style=\"display: none;\">Clause that tells QLever UI the name of an object (without prefixes). Qlever UI expects the following variables to be used:<br>&nbsp;&nbsp;- &nbsp;?qleverui_entity: The object that we want to get the name of<br>&nbsp;&nbsp;- &nbsp;?qleverui_name: The variable that will hold the object's name<br>Your clause should end in a dot '.' or closing bracket '}'<br>Your clause will be used as following:<br>SELECT ?qleverui_name WHERE {<br>&nbsp;&nbsp;&nbsp;&nbsp;&lt;subject&gt; &lt;predicate&gt; ?qleverui_entity<br>&nbsp;&nbsp;&nbsp;&nbsp;OPTIONAL {<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b><em>object name clause</em></b><br>&nbsp;&nbsp;&nbsp;&nbsp;}<br>}</div>",
        verbose_name="Object name clause")

    replacePredicates = models.TextField(
        default='',
        blank=True,
        help_text="""<a href=\"javascript:void(0)\" onclick=\"django.jQuery('.replacePredicates').slideToggle();\">Need help?</a><div class=\"replacePredicates\" style=\"display: none;\">
        A list of predicates that should be replaced for autocompletion.<br>
        Each line should consist of a predicate + replacement pair, separated by whitespace.<br>
        Example:<br>
        &lt;http://www.w3.org/2000/01/rdf-schema#label&gt;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@en@&lt;http://www.w3.org/2000/01/rdf-schema#label&gt;<br>
        &lt;http://schema.org/name&gt;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@en@&lt;http://schema.org/name&gt<br>
        &lt;http://wikiba.se/ontology#label&gt;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;@en@&lt;http://wikiba.se/ontology#label&gt;</div>
        """,
        verbose_name="Replace predicates in autocompletion context."
    )

    supportedKeywords = models.TextField(
        default='prefix, select, distinct, where, order, limit, offset, optional, by, as, having, not, textlimit, contains-entity, contains-word, filter, group, union, optional, has-predicate',
        blank=True,
        help_text="Comma separated list of SPARQL keywords supported by the backend. Will be used for keyword highlighting.",
        verbose_name="Supported keywords")

    supportedFunctions = models.TextField(
        default='asc, desc, avg, values, score, text, count, sample, min, max, average, concat, group_concat, langMatches, lang, regex, sum',
        blank=True,
        help_text="Comma separated list of SPARQL functions supported by the backend. Will be used for function highlighting.",
        verbose_name="Supported functions")

    supportedPredicateSuggestions = models.TextField(
        default='ql:contains-word, ql:contains-entity',
        blank=True,
        help_text="Comma separated list of predicate suggestions that should always be shown.",
        verbose_name="Predicate suggestions")

    suggestPrefixnamesForPredicates = models.BooleanField(
        default=True,
        help_text="Suggest Prefix names without a particular entity when autocompleting predicates.",
        verbose_name="Suggest prefix names for predicates.")

    suggestSubjectsInEmptyLine = models.BooleanField(
        default=False,
        help_text="Suggest subjects when no character has been typed yet.",
        verbose_name="Suggest subjects in empty lines.")

    fillPrefixes = models.BooleanField(
        default=True,
        help_text="Replace prefixes in suggestions even if they are not yet declared in the query. Add prefix declarations if a suggestion with not yet declared prefix is picked.",
        verbose_name="Fill in known Prefixes")

    filterEntities = models.BooleanField(
        default=False,
        help_text="Also suggest FILTER for variables that store entity IDs. You can use this if you don't have name relations and your entity IDs and names are equal.",
        verbose_name="Suggest FILTER for entity variables")

    def save(self, *args, **kwargs):
        # We need to replace \r because QLever can't handle them very well
        for field in ('subjectName', 'predicateName', 'objectName', 'suggestSubjects', 'suggestPredicates', 'suggestObjects'):
            setattr(self, field, str(getattr(self, field)).replace(
                "\r\n", "\n").replace("\r", "\n"))
        super(Backend, self).save(*args, **kwargs)

        if self.isDefault == True:
            Backend.objects.exclude(pk=self.pk).update(isDefault=False)

    def __str__(self):
        return self.name

    def slugify(self):
        return "".join(filter(lambda x: ord(x) in range(40, 123),
                              self.name.replace(' ', '_').replace('/', '-').replace(
            '*', '-')))

    def languages(self):
        jsArray = "["
        for val in self.filteredLanguage.split(","):
            jsArray += '\'"'+val.strip()+'"\','
        jsArray += "]"
        return jsArray

    def keywords(self):
        jsArray = "["
        for val in self.supportedKeywords.split(","):
            jsArray += '"'+val.strip()+'",'
        jsArray += "]"
        return jsArray

    def functions(self):
        jsArray = "["
        for val in self.supportedFunctions.split(","):
            jsArray += '"'+val.strip()+'",'
        jsArray += "]"
        return jsArray

    def predicateSuggestions(self):
        jsArray = "["
        for val in self.supportedPredicateSuggestions.split(","):
            if val:
                jsArray += '"'+val.strip()+'",'
        jsArray += "]"
        return jsArray

    def entityNameQueries(self):
        data = {}
        for field in ('subjectName', 'predicateName', 'objectName', 'suggestSubjects', 'suggestPredicates', 'suggestObjects'):
            data[field.upper()] = getattr(self, field)
        return json.dumps(data)

    def replacePredicatesList(self):
        data = {}
        for line in self.replacePredicates.split("\n"):
            match = re.search("([\S]+)[\s]+([\S]+)", line)
            if match:
                predicate, replacement = match.groups()
                data[predicate] = replacement
        return json.dumps(data)


class Link(models.Model):
    identifier = models.CharField(max_length=256)
    content = models.TextField()


class Prefix(models.Model):
    class Meta:
        verbose_name_plural = "Prefixes"

    name = models.CharField(max_length=30, default="",
                            help_text="Please chose the short name of this prefix (e.g. scm)",)
    prefix = models.CharField(max_length=200, default="",
                              help_text="Insert the original scope with it's path (e.g. &lt;http://schema.org/&gt;).")
    backend = models.ForeignKey(Backend, on_delete=models.CASCADE)
    occurrences = models.IntegerField(
        default=1, help_text="Estimated or calculated occurrences of this prefix (used for ordering).")


class Example(models.Model):
    backend = models.ForeignKey(Backend, on_delete=models.CASCADE)
    name = models.CharField(
        max_length=100, help_text="Name of this example to show in the user interface")
    query = models.TextField()

    def __str__(self):
        return self.name
