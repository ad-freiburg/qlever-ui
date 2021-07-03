# Extending the language parser

## The basics and dependencies
QLever UI uses the Code Mirror Code editor and a few of its available addons which already provides a useful set of tools like line counts, highlighting the active line, search and replace and many more.

Many features of QLever UI are built on top of the [CodeMirror Programming API](https://codemirror.net/doc/manual.html#api) / Addons or at least actively make use of them.

CodeMirror related code is stored in [/static/js/codemirror/](/backend/static/js/codemirror/). There are plenty of modes for different programming languages supported by CodeMirror available. We built our own SPARQL language mode which is similar to the SQL mode due to the parallels between both languages.

There a full documentation for [language modes](https://codemirror.net/doc/manual.html#modeapi) on the website of CodeMirror which describes the CodeMirror API features we used in our mode at [/static/js/codemirror/modes/sparql/sparql.js](/backend/static/js/codemirror/modes/sparql/sparql.js).

One may also make use of different code themes / styles as using different color schemes is also supported by CodeMirror itself.

**Further reading**
- [Basic usage of CodeMirror](https://codemirror.net/doc/manual.html)
- [Extending / Customizing CodeMirror](https://codemirror.net/doc/manual.html#api)
- [Available Addons](https://codemirror.net/doc/manual.html#addons)

For any features that are unrelated to the actual text editor window (results, shares, etc.) there is a [qleverUI.js](/backend/static/js/qleverUI.js) and a [helper.js](/backend/static/js/helper.js) for some helper functions used within the code.

We implemented a `log()` function that accepts a message and a kind (one of 'parsing', 'requests', 'suggestions' and 'other) and logs the given message to the browser console when the corresponding log is enabled in the UI settings of the website. We make active use of this within the code which helps a lot figuring out which values are detected and what decisions are made within the UI. We recommend making active use of this feature which helps a lot while developing QLever UI. 

### Extending the Tokenizer
By default CodeMirror uses a tokenizer in order to separate elements in a code lines to generate an HTML DOM representation of the actual value of the editor. This is intentionally used in order to allow syntax highlighting and QLever UI makes active use on it.

The tokenizer can be found in the [SPARQL mode](/backend/static/js/codemirror/modes/sparql/sparql.js). When there is need to separate more tokens than the ones already present (variable, bracket, prefix-declaration, keyword,...) one can extend the tokenizer to return more values.

Each mode get its own css class in the rendering which allows to easily style the new tokens. For example the "variable"-token get a class called `cm-variable` that can have custom styling attributes in [codemirror.css](/backend/static/css/codemirror.css).
#### Extending the Parser
For making suggestions there is a separate [spraql-hint.js](/backend/static/js/codemirror/modes/sparql/sparql-hint.js) in the language mode folder that actually cares about the context-sensitivity.

According to the SPARQL grammar there are different contexts within a query - for example the *SelectClause*, the *WhereClause* or the *SolutionModifier* - QLever UI also uses these contexts and keeps a definition of available contexts in the [SPARQL language file](/backend/static/js/codemirror/modes/sparql/sparql.js) as a constant variable.

Within a `CONTEXT` there are different parts of a query that may or may not occur at a specific position. Next to simple keywords and variables there are many constructs to use. We refer to them as complex types.

The following options are taken for `CONTEXS`:
Attribute | Type | Required | Content 
--- | --- | --- | --- |
w3name | string | yes | name of the context, should correspond to the w3 standard
definition | regex | yes | a regex that matches everything inside the context (if present) |
suggestInSameLine | boolean | no | false, if the context should only be suggestions on an empty line  
forceLineBreak | boolean | no | true, if a line break should be added after choosing a suggestion inside this context

function buildQueryTree(content, start) {
Types and their names are used in order to build to query tree (as it is logged by the UI itself when enabling parser logging) and easily get the contents of one context within the query. On can find our more on the tree representation in the `buildQueryTree` function inside [spraql-hint.js](/backend/static/js/codemirror/modes/sparql/sparql-hint.js). 

There is also a constant definition of all available `COMPLEXTTYPES` in the [SPARQL language file](/backend/static/js/codemirror/modes/sparql/sparql.js). A complex type consists of a name, a definition on how to detect it if present and a callback that provides all the different variations of this type that might be relevant.

Additionally each type has a list of `CONTEXTS` it is compatible with and some optional configuration parameter that may limit the occurrence of this type to only one or only one per variation (e.g. each combination of a keyword with one variable is considered to be a variation).

Also there are options to hide suggestions until they match whats currently typed (e.g. to prevent always suggestion subquerys or optionals in each and every line where they may occur).

The following options are taken for a `COMPLEXTTYPE`:
Attribute | Type | Required | Content 
--- | --- | --- | --- |
name | string | yes | name of the construct / 
definition | regex | yes |
suggestions | callback / list | yes |
availableInContext | list | yes |
onlyOnce | boolean | no |
onlyOncePerVariation | boolean | no |
requiresEmptyLine | boolean | no | 
suggestOnlyWhenMatch | boolean | no |



As new types / contexts will be available in QLever one can easily extend the according definition. For un-nested types adding the `COMPLEXTTYPES` is sufficient. If there are other complex types that may occur within brackets or at any other position within the type itself one needs to add a context for the "inside" of this complex type and add `COMPLEXTTYPES` that are allowed within the context. 
