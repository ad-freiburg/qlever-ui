# Configure QLever UI

Assuming that you already have a QLever Instance running and super user created you can now configure your existing QLever backend in you new QLever UI instance. 

You may access the admin panel by adding `/admin` to the URL you are using for your QLever UI instance and login with the credentials you just created.

If you don't have a QLever instance readily available to key in or just want to get up and running as fast as possible, you can use our [example settings](/resources/) that use a QLever instance with Wikidata KB hosted at the Chair of Algorithms and Data Structures at the University of Freiburg.  

Click "Backends" and "Add backend" in order to start configuring your first QLever backend. There are many help texts below each configuration box that guide you through the process. If you are done save the settings and reload the QLever UI interface.

You can also import the respective `*-sample.csv` file for the example backend.

If everything worked correctly you should see backend details displayed on top right of the regular QLever UI. If not you can enable details error logging in the user interface (in top right dropdown menu) and open your browsers developer console to see the outputs.

# Configure the autocompletion queries
QLever UI offers several settings that can be used to configure the autocompletion. They are separated into five categories:
- [Variable Names](#variable-names)
- [Warmup Query Patterns](#warmup-query-patterns)
- [Warmup Queries](#warmup-queries)
- [Autocomplete Queries (context-insensitive)](#autocomplete-queries-context-insensitive)
- [Autocomplete Queries (context-sensitive)](#autocomplete-queries-context-sensitive)

## Variable Names
In this section you can define the special variable names that are used in the queries below. QLever UI needs this information in order to know which variables to look out for. The variables that can be defined are:
1. Variable for suggested entity: The variable that stores the suggested entity in the autocompletion queries.
2. Variable for suggestion name: The variable that stores the name of the suggestion in the autocompletion queries.
3. Variable for alternative suggestion name: The variable that stores the alternative name of the suggestion.
4. Variable for reversed suggestion: The variable that stores wether a suggestion is reversed. This is only needed when using the [qlever proxy](https://github.com/ad-freiburg/qlever-proxy)

## Warmup Query Patterns
The settings in "Warmup Query Patterns" category consist of patterns that are used in the warmup queries below.
The "Name and Alias" patterns are typically defined with KB-specific predicates such as rdfs:label or fb:type.object.name. However usually not all entities in a knowledge base have such names. As a fallback, therefore also names according to the patterns labelled as "... (default)" are used.

## Warmup Queries
The warmup queries are used in two different ways.
1. The queries defined in these settings can be used in the autocomplete queries below, through placeholders.
2. QLever UI can send the warmup queries to the QLever instance in order to add these queries to the QLever cache.

QLever UI can currently accomodate up to five warmup queries. The number of warmup queries can be extended with little work, though.

## Autocomplete Queries (context-insensitive)
These are the queries QLever UI will use when searching for autocompletion suggestions. There are independent settings for subject, predicate and object autocompletion queries. The queries labelled _context-insensitive_ will be used when the backend is set to use suggestion mode 2: "SPARQL & context insensitive entities"

## Autocomplete Queries (context-sensitive)
Everything said about the context-insensitive autocompletion queries also holds true for the context-sensitive ones. These are used when the backend is set to use suggestion mode 3: "SPARQL & context sensitive entities"
  

# Writing autocompletion queries
The autocompletion queries settings are not only written in plain SPARQL. QLever UI uses a simple template language which will be rendered to plain SPARQL before the autocompletion queries are sent to the QLever backend. This template language knows the following statements:

**1. `%CURRENT_SUBJECT%`, `%CURRENT_PREDICATE%` and `%CURRENT_WORD%`**  
The current line of the query the user is typing will be split into these placeholders.  
Examples:  
current line: `?c wdt:P31 coun[cursor]`  
`%CURRENT_SUBJECT%` = `?c`  
`%CURRENT_PREDICATE%` = `wdt:P31`  
`%CURRENT_WORD%` = `coun`

current line: `?c inst[cursor]`  
`%CURRENT_SUBJECT%` = `?c`  
`%CURRENT_PREDICATE%` = `inst`  
`%CURRENT_WORD%` = `inst`

current line: `?c[cursor]`  
`%CURRENT_SUBJECT%` = `?c`  
`%CURRENT_PREDICATE%` = `[not defined]`  
`%CURRENT_WORD%` = `?c`

**2. `%CURRENT_WORD%`**  
Same as `%CURRENT_WORD%`, but prepends a `<` if `%CURRENT_WORD%` doesn't start with `<` or `"`  
Can be helpful in combination with `HAVING` and KBs such as FreebaseEasy where you don't want to always type the `<` in order for autocompletion to work.

**3. `# IF #`, `# ELSE #` and `# ENDIF #`**  
Can be used to alter the completion query depending on the users current input.  
Text inside an `# IF #` or `# ELSE #` block will be ignored if the given condition is not satisified.  
Defining an  `# ELSE #` block is optional.  
`IF / ELSE / ENDIF` statements can be nested.

**4. Conditions**  
Available conditions for `# IF #` statements are as follows:  
* `CURRENT_WORD_EMPTY` : true if the user hasn't startet typing a new word
* `CURRENT_SUBJECT_VARIABLE` : true if `%CURRENT_SUBJECT%` is a variable
* `CURRENT_PREDICATE_VARIABLE` : true if `%CURRENT_PREDICATE%` is a variable
* `CONNECTED_TRIPLES_EMPTY` : true if `%CONNECTED_TRIPLES%` is empty

These conditions can be combined into logical expressions of arbitraty length using
- `OR` - _logical or (binds weakest)_
- `AND` - _logical and (binds stronger than OR)_
- `!` - _negation (binds stronger than AND)_

Example:
```
# IF !CURRENT_WORD_EMPTY OR CURRENT_SUBJECT_VARIABLE AND CURRENT_PREDICATE_VARIABLE #
    # Text inside this block will be used for the query if the condition above evaluates to true
    [...]
# ELSE #
    # Text inside this block will be used otherwise
    [...]
# ENDIF #
```

**5. `%PREFIXES%`**  
Inserts the prefix declarations the user has made in addition to all the prefixes that are defined in the backend's settings.

**6. `%CONNECTED_TRIPLES%`**  
Inserts the lines of the user's query that are connected to `%CURRENT_WORD%`

**7. Placeholders for the queries defined above**  
All the queries defined in "Warmup Queries" and "Warmup Query Patterns" can be inserted into an autocompletion query. The placeholder for a setting is the name of the setting in upper case, spaces replaced by underscore, all enclodes in percent signs. Examples:  
| Setting name                   | Placeholder                            |
|--------------------------------|----------------------------------------|
| Entity name and alias pattern  | `%ENTITY_NAME_AND_ALIAS_PATTERN%`      |
| Warmup query 1                 | `%WARMUP_QUERY_1%`                     |




## Further reading
* See [publications](../README.md#publications) on QLever UI