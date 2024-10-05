from functools import cached_property
import json
import re
from django.db import models
import datetime


class Backend(models.Model):
    MODES = ((3, '4. Mixed mode'),
             (2, '3. SPARQL & context sensitive entities'),
             (1, '2. SPARQL & context insensitive entities'),
             (0, '1. SPARQL syntax & keywords only'))
    useBackendDefaults = True

    name = models.CharField(
        max_length=500,
        help_text="Choose a name for the backend that helps you to distinguish between multiple backends",
        verbose_name="Name",
        unique=True)
    slug = models.CharField(
        max_length=100,
        default="Empty",
        help_text="Name used in the URL of this backend; MUST only use valid URL characters (in particular, no space)",
        verbose_name="Slug")
    sortKey = models.CharField(
        max_length=10,
        default="0",
        help_text="Sort key, according to which backends are ordered lexicographically; DO NOT SHOW if this value is zero",
        verbose_name="Sort Key")
    baseUrl = models.CharField(
        max_length=1000,
        help_text="The URL where to find / call the QLever backend (including http://)",
        verbose_name="Base URL")

    apiToken = models.CharField(
        max_length=32,
        help_text="This token needs to be provided as ?token query parameter when executing Warmup tasks through API",
        verbose_name="API token",
        default="",
        blank=True,
    )

    isDefault = models.BooleanField(
        default=0,
        help_text="Check if this should be the default backend for the QLever UI",
        verbose_name="Use as default")

    isNoSlugMode = models.BooleanField(
        default=0,
        help_text="Check if this default backend should also be available without a slug in the QLever UI",
        verbose_name="Enable no-slug mode")

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
        help_text="Default for how to compute autocompletion queries if any",
        verbose_name="Default autocompletion mode")
    
    defaultModeTimeout = models.FloatField(
        default=0,
        help_text="Default timeout in seconds for autocompletion queries",
        verbose_name="Autocomplete timeout",
    )
    mixedModeTimeout = models.FloatField(
        default=1,
        help_text="Timeout in seconds for the sensitive autocompletion query in mixed mode",
        verbose_name="Mixed mode timeout",
    )

    suggestSubjects = models.TextField(
        default='',
        blank=True,
        help_text="The query for <em>context-sensitive</em> subject autocompletion. Leave blank if you don't want subject suggestions.",
        verbose_name="Subject autocompletion query")

    suggestPredicates = models.TextField(
        default='',
        blank=True,
        help_text="The query for <em>context-sensitive</em> predicate autocompletion",
        verbose_name="Predicate autocompletion query")

    suggestObjects = models.TextField(
        default='',
        blank=True,
        help_text="The query for <em>context-sensitive</em> object autocompletion",
        verbose_name="Object autocompletion query")

    subjectName = models.TextField(
        default='',
        blank=True,
        help_text="<a href=\"javascript:void(0)\" onclick=\"django.jQuery('.helpSubjectName').slideToggle();\">Need help?</a><div class=\"helpSubjectName\" style=\"display: none;\">Clause that tells QLever UI the name of a subject (without prefixes). Qlever UI expects the following variables to be used:<br>&nbsp;&nbsp;- &nbsp;?qleverui_entity: The subject that we want to get the name of<br>&nbsp;&nbsp;- &nbsp;?qleverui_name: The variable that will hold the subject's name<br>Your clause should end in a dot '.' or closing bracket '}'<br>Your clause will be used as following:<br>SELECT ?qleverui_name WHERE {<br>&nbsp;&nbsp;&nbsp;&nbsp;?qleverui_entity &lt;predicate&gt; &lt;object&gt;<br>&nbsp;&nbsp;&nbsp;&nbsp;OPTIONAL {<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b><em>subject name clause</em></b><br>&nbsp;&nbsp;&nbsp;&nbsp;}<br>}</div>",
        verbose_name="Subject name clause")

    alternativeSubjectName = models.TextField(
        default='',
        blank=True,
        help_text="<a href=\"javascript:void(0)\" onclick=\"django.jQuery('.helpAlternativeSubjectName').slideToggle();\">Need help?</a><div class=\"helpAlternativeSubjectName\" style=\"display: none;\">Clause that tells QLever UI the alternative name of a subject (without prefixes). Qlever UI expects the following variables to be used:<br>&nbsp;&nbsp;- &nbsp;?qleverui_entity: The subject that we want to get the name of<br>&nbsp;&nbsp;- &nbsp;?qleverui_altname: The variable that will hold the subject's alternative name<br>Your clause should end in a dot '.' or closing bracket '}'<br>Your clause will be used as following:<br>SELECT ?qleverui_altname WHERE {<br>&nbsp;&nbsp;&nbsp;&nbsp;?qleverui_entity &lt;predicate&gt; &lt;object&gt;<br>&nbsp;&nbsp;&nbsp;&nbsp;OPTIONAL {<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b><em>alternative subject name clause</em></b><br>&nbsp;&nbsp;&nbsp;&nbsp;}<br>}</div>",
        verbose_name="Alternative subject name clause")

    predicateName = models.TextField(
        default='',
        blank=True,
        help_text="<a href=\"javascript:void(0)\" onclick=\"django.jQuery('.helpPredicateName').slideToggle();\">Need help?</a><div class=\"helpPredicateName\" style=\"display: none;\">Clause that tells QLever UI the name of a predicate (without prefixes). Qlever UI expects the following variables to be used:<br>&nbsp;&nbsp;- &nbsp;?qleverui_entity: The predicate that we want to get the name of<br>&nbsp;&nbsp;- &nbsp;?qleverui_name: The variable that will hold the predicate's name<br>Your clause should end in a dot '.' or closing bracket '}'<br>Your clause will be used as following:<br>SELECT ?qleverui_name WHERE {<br>&nbsp;&nbsp;&nbsp;&nbsp;&lt;subject&gt; ?qleverui_entity &lt;object&gt;<br>&nbsp;&nbsp;&nbsp;&nbsp;OPTIONAL {<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b><em>predicate name clause</em></b><br>&nbsp;&nbsp;&nbsp;&nbsp;}<br>}</div>",
        verbose_name="Predicate name clause")

    alternativePredicateName = models.TextField(
        default='',
        blank=True,
        help_text="<a href=\"javascript:void(0)\" onclick=\"django.jQuery('.helpAlternativePredicateName').slideToggle();\">Need help?</a><div class=\"helpAlternativePredicateName\" style=\"display: none;\">Clause that tells QLever UI the alternative name of a predicate (without prefixes). Qlever UI expects the following variables to be used:<br>&nbsp;&nbsp;- &nbsp;?qleverui_entity: The predicate that we want to get the name of<br>&nbsp;&nbsp;- &nbsp;?qleverui_altname: The variable that will hold the predicate's alternative name<br>Your clause should end in a dot '.' or closing bracket '}'<br>Your clause will be used as following:<br>SELECT ?qleverui_altname WHERE {<br>&nbsp;&nbsp;&nbsp;&nbsp;&lt;subject&gt; ?qleverui_entity &lt;object&gt;<br>&nbsp;&nbsp;&nbsp;&nbsp;OPTIONAL {<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b><em>alternative predicate name clause</em></b><br>&nbsp;&nbsp;&nbsp;&nbsp;}<br>}</div>",
        verbose_name="Alternative predicate name clause")

    objectName = models.TextField(
        default='',
        blank=True,
        help_text="<a href=\"javascript:void(0)\" onclick=\"django.jQuery('.helpObjectName').slideToggle();\">Need help?</a><div class=\"helpObjectName\" style=\"display: none;\">Clause that tells QLever UI the name of an object (without prefixes). Qlever UI expects the following variables to be used:<br>&nbsp;&nbsp;- &nbsp;?qleverui_entity: The object that we want to get the name of<br>&nbsp;&nbsp;- &nbsp;?qleverui_name: The variable that will hold the object's name<br>Your clause should end in a dot '.' or closing bracket '}'<br>Your clause will be used as following:<br>SELECT ?qleverui_name WHERE {<br>&nbsp;&nbsp;&nbsp;&nbsp;&lt;subject&gt; &lt;predicate&gt; ?qleverui_entity<br>&nbsp;&nbsp;&nbsp;&nbsp;OPTIONAL {<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b><em>object name clause</em></b><br>&nbsp;&nbsp;&nbsp;&nbsp;}<br>}</div>",
        verbose_name="Object name clause")

    alternativeObjectName = models.TextField(
        default='',
        blank=True,
        help_text="<a href=\"javascript:void(0)\" onclick=\"django.jQuery('.helpAlternativeObjectName').slideToggle();\">Need help?</a><div class=\"helpAlternativeObjectName\" style=\"display: none;\">Clause that tells QLever UI the alternativename of an object (without prefixes). Qlever UI expects the following variables to be used:<br>&nbsp;&nbsp;- &nbsp;?qleverui_entity: The object that we want to get the name of<br>&nbsp;&nbsp;- &nbsp;?qleverui_altname: The variable that will hold the object's alternative name<br>Your clause should end in a dot '.' or closing bracket '}'<br>Your clause will be used as following:<br>SELECT ?qleverui_altname WHERE {<br>&nbsp;&nbsp;&nbsp;&nbsp;&lt;subject&gt; &lt;predicate&gt; ?qleverui_entity<br>&nbsp;&nbsp;&nbsp;&nbsp;OPTIONAL {<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b><em>alternative object name clause</em></b><br>&nbsp;&nbsp;&nbsp;&nbsp;}<br>}</div>",
        verbose_name="Alternative object name clause")

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
        default='prefix, select, distinct, where, order, limit, offset, optional, by, as, having, not, textlimit, contains-entity, contains-word, filter, group, union, optional, has-predicate, minus, values',
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

    fillPrefixes = models.BooleanField(
        default=True,
        help_text="Replace prefixes in suggestions even if they are not yet declared in the query. Add prefix declarations if a suggestion with not yet declared prefix is picked.",
        verbose_name="Fill in known Prefixes")

    filterEntities = models.BooleanField(
        default=False,
        help_text="Also suggest FILTER for variables that store entity IDs. You can use this if you don't have name relations and your entity IDs and names are equal.",
        verbose_name="Suggest FILTER for entity variables")

    suggestedPrefixes = models.TextField(
        default='',
        blank=True,
        help_text="A list of prefixes that should be suggested. Prefixes can have either of these forms:<ul><li>@prefix schema: &lt;https://www.schema.org/&gt; .</li><li>Prefix schema: &lt;http://schema.org/&gt;</li></ul>",
        verbose_name="Suggested Prefixes")

    suggestionEntityVariable = models.CharField(
        max_length=100,
        default='',
        blank=True,
        help_text="The variable that stores the suggested entity in the following queries.",
        verbose_name="Variable for suggested entity")

    suggestionNameVariable = models.CharField(
        max_length=100,
        default='',
        blank=True,
        help_text="The variable that stores the name of the suggestion in the following queries.",
        verbose_name="Variable for suggestion name")

    suggestionAltNameVariable = models.CharField(
        max_length=100,
        default='',
        blank=True,
        help_text="The variable that stores the alternative name of the suggestion in the following queries.",
        verbose_name="Variable for alternative suggestion name")

    suggestionReversedVariable = models.CharField(
        max_length=100,
        default='',
        blank=True,
        help_text="The variable that stores wether a suggestion is reversed.",
        verbose_name="Variable for reversed suggestion")

    # variables for cache pinning
    frequentPredicates = models.TextField(
        default="",
        blank=True,
        verbose_name="Frequent predicates",
    )

    frequentPatternsWithoutOrder = models.TextField(
        default="",
        blank=True,
        verbose_name="Frequent patterns without order",
    )

    # warmup query patterns
    entityNameAndAliasPattern = models.TextField(
        default="",
        blank=True,
        verbose_name="Entity name and alias pattern",
        help_text="Use in warmup and autocomplete queries by typing %ENTITY_NAME_AND_ALIAS_PATTERN%",
    )

    entityScorePattern = models.TextField(
        default="",
        blank=True,
        verbose_name="Entity score pattern",
        help_text="Use in warmup and autocomplete queries by typing %ENTITY_SCORE_PATTERN%",
    )

    predicateNameAndAliasPatternWithoutContext = models.TextField(
        default="",
        blank=True,
        verbose_name="Predicate name and alias pattern without context",
        help_text="Use in warmup and autocomplete queries by typing %PREDICATE_NAME_AND_ALIAS_PATTERN_WITHOUT_CONTEXT%",
    )

    predicateNameAndAliasPatternWithContext = models.TextField(
        default="",
        blank=True,
        verbose_name="Predicate name and alias pattern with context",
        help_text="Use in warmup and autocomplete queries by typing %PREDICATE_NAME_AND_ALIAS_PATTERN_WITH_CONTEXT%",
    )

    entityNameAndAliasPatternDefault = models.TextField(
        default="",
        blank=True,
        verbose_name="Entity name and alias pattern (default)",
        help_text="Use in warmup and autocomplete queries by typing %ENTITY_NAME_AND_ALIAS_PATTERN_DEFAULT%",
    )

    predicateNameAndAliasPatternWithoutContextDefault = models.TextField(
        default="",
        blank=True,
        verbose_name="Predicate name and alias pattern without context (default)",
        help_text="Use in warmup and autocomplete queries by typing %PREDICATE_NAME_AND_ALIAS_PATTERN_WITHOUT_CONTEXT_DEFAULT%",
    )

    predicateNameAndAliasPatternWithContextDefault = models.TextField(
        default="",
        blank=True,
        verbose_name="Predicate name and alias pattern with context (default)",
        help_text="Use in warmup and autocomplete queries by typing %PREDICATE_NAME_AND_ALIAS_PATTERN_WITH_CONTEXT_DEFAULT%",
    )

    warmupQuery1 = models.TextField(
        default="",
        blank=True,
        verbose_name="Warmup query 1",
        help_text="Use in warmup and autocomplete queries by typing %WARMUP_QUERY_1%",
    )

    warmupQuery2 = models.TextField(
        default="",
        blank=True,
        verbose_name="Warmup query 2",
        help_text="Use in warmup and autocomplete queries by typing %WARMUP_QUERY_2%",
    )

    warmupQuery3 = models.TextField(
        default="",
        blank=True,
        verbose_name="Warmup query 3",
        help_text="Use in warmup and autocomplete queries by typing %WARMUP_QUERY_3%",
    )

    warmupQuery4 = models.TextField(
        default="",
        blank=True,
        verbose_name="Warmup query 4",
        help_text="Use in warmup and autocomplete queries by typing %WARMUP_QUERY_4%",
    )

    warmupQuery5 = models.TextField(
        default="",
        blank=True,
        verbose_name="Warmup query 5",
        help_text="Use in warmup and autocomplete queries by typing %WARMUP_QUERY_5%",
    )

    suggestSubjectsContextInsensitive = models.TextField(
        default='',
        blank=True,
        help_text="The query for <em>context-insensitive<em> subject autocompletion. Leave blank if you don't want subject suggestions.",
        verbose_name="Context-insensitive subject autocompletion query")

    suggestPredicatesContextInsensitive = models.TextField(
        default='',
        blank=True,
        help_text="The query for <em>context-insensitive</em> predicate autocompletion",
        verbose_name="Context-insensitive predicate autocompletion query")

    suggestObjectsContextInsensitive = models.TextField(
        default='',
        blank=True,
        help_text="The query for <em>context-insensitive</em> object autocompletion",
        verbose_name="Context-insensitive object autocompletion query")

    mapViewBaseURL = models.CharField(
        default="",
        blank=True,
        max_length=2048, # URLs don't have a length limit, but this should be plenty long
        verbose_name="Map view base URL",
        help_text="The base URL of the https://github.com/ad-freiburg/qlever-petrimaps instance; if empty, no Map View button will appear",
    )

    def save(self, *args, **kwargs):
        # We need to replace \r because QLever can't handle them very well
        for field in (
            'subjectName', 'predicateName', 'objectName',
            'suggestSubjects', 'suggestPredicates', 'suggestObjects',
            'alternativeSubjectName', 'alternativePredicateName', 'alternativeObjectName',
            'suggestSubjectsContextInsensitive', 'suggestPredicatesContextInsensitive', 'suggestObjectsContextInsensitive'):
            setattr(self, field, str(getattr(self, field)).replace(
                "\r\n", "\n").replace("\r", "\n"))
        super(Backend, self).save(*args, **kwargs)

        if self.isDefault == True:
            Backend.objects.exclude(pk=self.pk).update(isDefault=False)
            Backend.objects.exclude(pk=self.pk).update(isNoSlugMode=False)

    def __str__(self):
        return self.name

    def slugify(self):
        return self.slug
        # return "".join(filter(lambda x: ord(x) in range(40, 123),
        #                       self.name.replace(' ', '_').replace('/', '-').replace(
        #     '*', '-')))

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
        for field in (
            'subjectName', 'predicateName', 'objectName',
            'suggestSubjects', 'suggestPredicates', 'suggestObjects',
            'alternativeSubjectName', 'alternativePredicateName', 'alternativeObjectName',
            'suggestSubjectsContextInsensitive', 'suggestPredicatesContextInsensitive', 'suggestObjectsContextInsensitive'):
            data[field.upper()] = getattr(self, field)
        return json.dumps(data)

    def replacePredicatesList(self):
        data = {}
        for line in self.replacePredicates.split("\n"):
            match = re.search(r"([\S]+)[\s]+([\S]+)", line)
            if match:
                predicate, replacement = match.groups()
                data[predicate] = replacement
        return json.dumps(data)

    def getWarmupAndAcPlaceholders(self):
        data = {
            "ENTITY_NAME_AND_ALIAS_PATTERN": self.entityNameAndAliasPattern,
            "ENTITY_SCORE_PATTERN": self.entityScorePattern,
            "PREDICATE_NAME_AND_ALIAS_PATTERN_WITHOUT_CONTEXT": self.predicateNameAndAliasPatternWithoutContext,
            "PREDICATE_NAME_AND_ALIAS_PATTERN_WITH_CONTEXT": self.predicateNameAndAliasPatternWithContext,
            "ENTITY_NAME_AND_ALIAS_PATTERN_DEFAULT": self.entityNameAndAliasPatternDefault,
            "PREDICATE_NAME_AND_ALIAS_PATTERN_WITHOUT_CONTEXT_DEFAULT": self.predicateNameAndAliasPatternWithoutContextDefault,
            "PREDICATE_NAME_AND_ALIAS_PATTERN_WITH_CONTEXT_DEFAULT": self.predicateNameAndAliasPatternWithContextDefault,
            "WARMUP_QUERY_1": self.warmupQuery1,
            "WARMUP_QUERY_2": self.warmupQuery2,
            "WARMUP_QUERY_3": self.warmupQuery3,
            "WARMUP_QUERY_4": self.warmupQuery4,
            "WARMUP_QUERY_5": self.warmupQuery5,
        }
        return data

    @property
    def availablePrefixes(self):
        prefixes = {}
        for match in re.findall(r"prefix\s+(\S+):\s+(\S+)", self.suggestedPrefixes, re.IGNORECASE):
            prefixes[match[0]] = match[1].strip('<>')
        return prefixes

    @cached_property
    def backendDefaults(self):
        return BackendDefaults.objects.first()

    def __getattribute__(self, name, forceUseDefault=False):
        value = super().__getattribute__(name)
        try:
            useDefault = forceUseDefault or super().__getattribute__("useBackendDefaults")
            if useDefault and not value and super().__getattribute__("backendDefaults") and name in BackendDefaults.AVAILABLE_DEFAULTS:
                value = getattr(self.backendDefaults, name)
        except RecursionError:
            pass  # during imports, the backend defaults don't work and would throw an error

        return value


class BackendDefaults(Backend):
    # every field name listed in AVAILABLE_DEFAULTS will automatically appear in the Backend Defaults admin
    # And will automatically be used as default for every Backend
    AVAILABLE_DEFAULTS = ("suggestionEntityVariable", "suggestionNameVariable", "suggestionAltNameVariable",
                          "suggestionReversedVariable", "suggestSubjects", "suggestPredicates", "suggestObjects",
                          "entityNameAndAliasPattern", "entityScorePattern", "predicateNameAndAliasPatternWithoutContext",
                          "predicateNameAndAliasPatternWithContext", "entityNameAndAliasPatternDefault",
                          "predicateNameAndAliasPatternWithoutContextDefault", "predicateNameAndAliasPatternWithContextDefault",
                          "warmupQuery1", "warmupQuery2", "warmupQuery3", "warmupQuery4", "warmupQuery5",
                          'suggestSubjectsContextInsensitive', 'suggestPredicatesContextInsensitive', 'suggestObjectsContextInsensitive',
                          'apiToken')

    class Meta:
        verbose_name_plural = "Backend defaults"

    def save(self, *args, **kwargs):
        self.name = "Global defaults for all Backends"
        self.slug = "globaldefaults_" + \
            str(datetime.datetime.now().timestamp())
        self.sortKey = "0"
        self.baseUrl = ""
        self.isDefault = False
        super(BackendDefaults, self).save(*args, kwargs)

    def __getattribute__(self, name, forceUseDefault=False):
        return super(models.Model, self).__getattribute__(name)


class Link(models.Model):
    identifier = models.CharField(max_length=256)
    content = models.TextField()


class Example(models.Model):
    backend = models.ForeignKey(Backend, on_delete=models.CASCADE)
    name = models.CharField(
        max_length=100, help_text="Name of this example to show in the user interface")
    query = models.TextField()
    sortKey = models.CharField(
            max_length=100,
            default="",
            blank=True,
            help_text="Sort key, according to which examples are ordered lexicographically for a backend",
            verbose_name="Sort key")

    def __str__(self):
        return self.name
