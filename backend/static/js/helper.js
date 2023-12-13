// UI helpers

function log(message, kind) {
  if (kind == undefined) {
    kind = "other";
  }
  if ((kind == 'parsing' && $('#logParsing').is(':checked')) ||
    (kind == 'other' && $('#logOther').is(':checked')) ||
    (kind == 'requests' && $('#logRequests').is(':checked')) ||
    (kind == 'suggestions' && $('#logSuggestions').is(':checked'))) {
    console.log('[' + kind + ']: ' + message.replaceAll(/^\s*$[\n\r]{1,}/gm, "\n"));
  }
}

// Normalize query in the following way. This is used when we need the query in
// a single line, for example, in the "Share" dialog or for the "Map View".
//
// 1a. Replace all # in IRIs by %23
// 1b. Remove all comments and empty lines
// 1c. Replace all %23 in IRIs by #
// 2. Replace all whitespace (including newlines) by a single space
// 3. Remove trailing full stops before closing braces
// 4. Remove leading and trailing whitespac
//
//
function normalizeQuery(query, escapeQuotes = false) {
  return query.replace(/(<[^>]+)#/g, "$1%23")
              .replace(/#.*\n/mg, " ")
              .replace(/(<[^>]+)%23/g, "$1#")
              .replace(/\s+/g, " ")
              .replace(/\s*\.\s*}/g, " }")
              .trim();
}


// Wrapper for `fetch` that turns potential errors into
// errors with user-friendly error messages.
async function fetchQleverBackend(params, additionalHeaders = {}, fetchOptions = {}) {
  let response;
  try {
    response = await fetch(BASEURL, {
      method: "POST",
      body: new URLSearchParams(params),
      headers: {
        Accept: "application/qlever-results+json",
        ...additionalHeaders
      },
      ...fetchOptions
    });
  } catch (error) {
    // Rethrow abort errors directly
    if (error.name === "AbortError") {
      throw error;
    }
    throw new Error(`Cannot reach ${BASEURL}. The most common cause is that the QLever server is down. Please try again later and contact us if the error persists`);
  }
  switch(response.status) {
    case 502:
      throw new Error("502 Bad Gateway. The most common cause is a problem with the web server. Please try again later and contact us if the error perists");
    case 503:
      throw new Error("503 Service Unavailable. The most common cause is that the QLever server is down. Please try again later and contact us if the error perists");
    case 504:
      throw new Error("504 Gatway Timeout. The most common cause is that the query timed out. Please try again later and contact us if the error perists");
  }
  let text;
  try {
    text = await response.text();
  } catch {
    throw new Error('Server response was not valid UTF-8');
  }
  try {
    return JSON.parse(text);
  } catch {
    // If response is not valid JSON and status is not 2xx,
    // treat the text as error message.
    if (!response.ok) {
      throw new Error(text);
    }
    throw new Error(`Expected a JSON response, but got '${text}'`);
  }
}

// Append the given runtime information for the given query to the runtime log.
//
// NOTE: A click on "Analysis" will show the runtime information from the last
// query. See runtimeInfoForTreant in qleverUI.js.
function appendRuntimeInformation(runtime_info, query, time, queryUpdate) {
  // Backwards compatability hack in case the info on the execution tree is
  // not in a separate "query_execution_tree" element yet.
  if (runtime_info["query_execution_tree"] === undefined) {
    console.log("BACKWARDS compatibility hack: adding runtime_info[\"query_execution_tree\"]");
    runtime_info["query_execution_tree"] = structuredClone(runtime_info);
    runtime_info["meta"] = {};
  }

  // Add query time to meta info.
  runtime_info["meta"]["total_time_computing"] =
    parseInt(time["computeResult"].toString().replace(/ms/, ""), 10);
  runtime_info["meta"]["total_time"] =
    parseInt(time["total"].toString().replace(/ms/, ""), 10);

  const previousTimeStamp = request_log.get(queryUpdate.queryId)?.timeStamp || Number.MIN_VALUE;
  // If newer runtime info for existing query or new query.
  if (previousTimeStamp < queryUpdate.updateTimeStamp) {
    request_log.set(queryUpdate.queryId, {
      timeStamp: queryUpdate.updateTimeStamp,
      runtime_info: runtime_info,
      query: query
    });
    if (request_log.size > 10) {
      // Note: `keys().next()` is the key that was inserted first.
      request_log.delete(request_log.keys().next().value);
    }
  }
}

// Add "text" field to given `tree_node`, for display using Treant.js
// (in function `renderRuntimeInformationToDom` in `qleverUI.js`).
// This function call itself recursively on each child of `tree_node` (if any).
//
// NOTE: The labels and the style can be found in backend/static/css/style.css .
// The coloring of the boxes, which depends on the time and caching status, is
// done in function `renderRuntimeInformationToDom` in `qleverUI.js`.
function addTextElementsToQueryExecutionTreeForTreant(tree_node, is_ancestor_cached = false) {
  if (tree_node["text"] == undefined) {
    var text = {};
    if (tree_node["column_names"] == undefined) { tree_node["column_names"] = ["not yet available"]; }
    // console.log("RUNTIME INFO:",runtime_info["description"])
    // Rewrite runtime info from QLever as follows:
    //
    // 1. Abbreviate IRIs (only keep part after last / or # or dot)
    // 2. Remove qlc_ and _qlever_internal_... prefixes from variable names
    // 3. Lowercase fully capitalized words (with _)
    // 4. Separate CamelCase word parts by hyphen (Camel-Case)
    // 5. First word in ALL CAPS (like JOIN or INDEX-SCAN)
    // 6. Replace hyphen in all caps by space (INDEX SCAN)
    // 7. Abbreviate long QLever-internal variable names
    //
    text["name"] = tree_node["description"]
    .replace(/<[^>]*[#\/\.]([^>]*)>/g, "<$1>")
    .replace(/qlc_/g, "").replace(/_qlever_internal_variable_query_planner/g, "")
    .replace(/\?[A-Z_]*/g, function (match) { return match.toLowerCase(); })
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/^([a-zA-Z-])*/, function (match) { return match.toUpperCase(); })
    .replace(/([A-Z])-([A-Z])/g, "$1 $2")
    .replace(/AVAILABLE /, "").replace(/a all/, "all");
    // console.log("-> REWRITTEN TO:", text["name"])

    text["cols"] = tree_node["column_names"].join(", ")
    .replace(/qlc_/g, "").replace(/_qlever_internal_variable_query_planner/g, "")
    .replace(/\?[A-Z_]*/g, function (match) { return match.toLowerCase(); });
    text["size"] = formatInteger(tree_node["result_rows"]) + " x " + formatInteger(tree_node["result_cols"])
    text["size-estimate"] = "[~ " + formatInteger(tree_node["estimated_size"]) + "]";
    text["cache-status"] = is_ancestor_cached
      ? "ancestor_cached"
      : tree_node["cache_status"]
          ? tree_node["cache_status"]
          : tree_node["was_cached"]
              ? "cached_not_pinned"
              : "computed";
    text["time"] = tree_node["cache_status"] == "computed" || tree_node["was_cached"] == false
      ? formatInteger(tree_node["operation_time"])
      : formatInteger(tree_node["original_operation_time"]);
    text["cost-estimate"] = "[~ " + formatInteger(tree_node["estimated_operation_cost"]) + "]"
    text["status"] = tree_node["status"];
    if (text["status"] == "not started") { text["status"] = "not yet started"; }
    text["total"] = text["time"];
    if (tree_node["details"]) {
      text["details"] = JSON.stringify(tree_node["details"]);
      console.log("details:", text["details"]);
    }

    // Delete all other keys except "children" (we only needed them here to
    // create a proper "text" element) and the "text" element.
    for (var key in tree_node) { if (key != "children") { delete tree_node[key]; } }
    tree_node["text"] = text;

    // Check out https://fperucic.github.io/treant-js
    // TODO: Do we still need / want this?
    tree_node["stackChildren"] = true;

    // Recurse over all children. Propagate "cached" status.
    tree_node["children"].map(
      child => addTextElementsToQueryExecutionTreeForTreant(
        child,
        is_ancestor_cached || text["cache-status"] != "computed"));
  }
}

function formatInteger(number) {
  return number.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
}

// Check if the given query fragment (for example, a completion or a whole
// query) contains the given prefix. Take into account that prefixes may occur
// in predicate paths and be prefixed by language tags, for example,
// wdt:P17|@en@rdfs:label . Also take into account that prefixes may occur in
// literal type IRIs, following ^^
function doesQueryFragmentContainPrefix(query_fragment, prefix) {
  return query_fragment.match(RegExp("(^|[\\s{;/|]|[\'\"]\\^\\^)\\^?(@[a-z]+@)?" + prefix + ":"));
}

// Split SPARQL query into the following parts and return as dictionary with
// these keys: prefixes (is an array), select_clause, select_vars, body, group_by, footer.
function splitSparqlQueryIntoParts(query) {
  var query_normalized = query.replace(/\s+/g, " ")
                              .replace(/\(\s+/g, "(").replace(/\s+\)/g, ")")
                              .replace(/\{\s*/g, "{ ").replace(/\s*\.?\s*\}$/g, " }");
  // console.log("SPLIT_SPARQL_QUERY_INTO_PARTS:", query_with_spaces_normalized)
  const pattern = /^\s*(.*?)\s*SELECT\s+([^{]*\S)\s*WHERE\s*{\s*(\S.*\S)\s*}\s*(.*?)\s*$/m;
  var match = query_normalized.match(pattern);
  if (!match) {
    throw "ERROR: Query did not match regex for SELECT queries";
  }
  var query_parts = {};
  query_parts["prefixes"] = match[1].split(/\s+(?=PREFIX)/);
  query_parts["select_clause"] = match[2];
  if (query_parts["select_clause"] != "*") {
    query_parts["select_vars"] = query_parts["select_clause"].replace(
      /\(\s*[^(]+\s*\([^)]+\)\s*[aA][sS]\s*(\?[^)]+)\s*\)/g, "$1").split(/\s+/);
  } else {
    query_parts["select_vars"] = "*";
  }
  query_parts["body"] = match[3];
  query_parts["footer"] = match[4];
  query_parts["group_by"] = "";
  var footer_match =
    query_parts["footer"].match(/^(GROUP BY( \?[A-Za-z0-9_]+)+) (.*)$/);
  if (footer_match) {
    query_parts["group_by"] = footer_match[1];
    query_parts["footer"] = footer_match[3];
  }
  // console.log("QUERY PARTS:", query_parts);
  return query_parts;
}


// Assemble query parts, as produced by splitSparqlQueryIntoParts above, to a
// SPARQL query and returns as string.
function createSparqlQueryFromParts(query_parts) {
  // If no GROUP BY (which is the case for all our invocations of this method),
  // remove all aliases from the SELECT clause. For example, (COUNT(?link) AS
  // ?num_links) becomes ?num_links.
  var select_clause = query_parts["group_by"] != ""
    ? query_parts["select_clause"]
    : query_parts["select_clause"]
        .replace(/\(.+\s*[aA][sS]\s*(\?\S+)\s*\)/g, "$1");
  var query =
    query_parts["prefixes"].join("\n") + "\n" +
    "SELECT " + select_clause + " WHERE {\n" +
  query_parts["body"].replace(/^/mg, ">>") + "\n" + "}" +
    (" " + query_parts["group_by"] + " " + query_parts["footer"])
      .replace(/ +/g, " ").replace(/ $/, "");
  query = query.replace(/ +/g, " ").replace(/^>>/mg, "  ").replace(/ *\. *}/, " }")
  return query;
}

// Name service (translated to JavaScript from qlever-proxy.py).
async function enhanceQueryByNameTriples(query) {

  // CONFIG depending on instance. TODO: this should be configurable in the QLever UI.
  if (BASEURL.match(/api\/wikidata$/)) {
    prefix_definitions=["PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>",
                       "PREFIX wikibase: <http://wikiba.se/ontology#>"];
    name_template="%ENTITY% rdfs:label %NAME% FILTER(LANG(%NAME%) = \"en\")";
    name_template_alt="%ENTITY% ^wikibase:directClaim/@en@rdfs:label %NAME%";
    predicate_exists_regex="(@[a-z]+@)?rdfs:label";
    new_var_suffix="_label";
  } else if (BASEURL.match(/api\/osm(-[a-z]+)?$/)) {
    prefix_definitions=["PREFIX osmkey: <https://www.openstreetmap.org/wiki/Key:>"];
    name_template="%ENTITY% osmkey:name %NAME%",
    predicate_exists_regex="osmkey:name",
    new_var_suffix="_name";
  } else if (BASEURL.match(/api\/pubchem$/)) {
    prefix_definitions=["PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>"];
    name_template="%ENTITY% rdfs:label %NAME%";
    predicate_exists_regex="rdfs:label";
    new_var_suffix="_label";
  } else if (BASEURL.match(/api\/dblp$/)) {
    prefix_definitions=["PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>"];
    name_template="%ENTITY% rdfs:label %NAME%";
    predicate_exists_regex="rdfs:label";
    new_var_suffix="_label";
  } else if (BASEURL.match(/api\/vvz$/)) {
    prefix_definitions=["PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>"];
    name_template="%ENTITY% rdfs:label %NAME%";
    predicate_exists_regex="rdfs:label";
    new_var_suffix="_label";
  } else {
    return query;
  }

  // STEP 1: Get query parts.
  var query_parts = splitSparqlQueryIntoParts(query);
  if (query_parts["select_vars"] == "*") {
    throw "NOT YET IMPLEMENTED: enhanceQueryByName cannot handle SELECT * yet";
  }

  // STEP 2: Check which triples to add.
  var new_vars = { }
  var new_triples = { };
  var new_prefix_definitions = query_parts["prefixes"];
  if (new_prefix_definitions.length > 50) {
    console.log("WARNING: Query with many prefix definitions, the name service" +
      " might be slow because it does multiple linear searches in them!");
  }
  for (const select_var of query_parts["select_vars"]) {
    var regex = new RegExp("\\" + select_var + " " + predicate_exists_regex);
    if (!query_parts["body"].match(regex)) {
      // console.log("Name triple exists for:", select_var);
      test_query_parts = {};
      test_query_parts["prefixes"] = [...query_parts["prefixes"], ...prefix_definitions];
      test_query_parts["select_clause"] = "*";
      // TODO: The ORDER BY is a workaround for Qlever Issue #729.
      test_query_parts["body"] =
          "{ SELECT " + query_parts["select_clause"] + " WHERE " +
          " { " + query_parts["body"] + " } " + query_parts["group_by"] +
          " ORDER BY " + select_var + " } " +
          // HACK: For variable ?pred use name_template_alt (see above).
          (select_var != "?pred"
            ?  name_template.replace(/%ENTITY%/g, select_var)
                            .replace(/%NAME%/g, "?qleverui_tmp")
            :  name_template_alt.replace(/%ENTITY%/g, select_var)
                                .replace(/%NAME%/g, "?qleverui_tmp"));
      test_query_parts["group_by"] = "";
      test_query_parts["footer"] = "LIMIT 1";
      test_query = createSparqlQueryFromParts(test_query_parts);
      const result = await fetchQleverBackend(
        { query: test_query },
        { Accept: "application/sparql-results+json" }
      );
      if ("results" in result && result.results.bindings.length == 1) {
        // HACK: For variable ?pred use name_template_alt (see above).
        new_vars[select_var] = select_var + new_var_suffix;
        new_triples[select_var] = select_var != "?pred"
          ?  name_template.replace(/%ENTITY%/g, select_var)
                          .replace(/%NAME%/g, new_vars[select_var])
          :  name_template_alt.replace(/%ENTITY%/g, select_var)
                              .replace(/%NAME%/g, new_vars[select_var]);
        for (const prefix_definition of prefix_definitions) {
          if (!new_prefix_definitions.includes(prefix_definition)) {
            new_prefix_definitions.push(prefix_definition);
          }
        }
      }
    }
  }
  // console.log("NEW TRIPLES:", Object.values(new_triples));
  // console.log("NEW VARS:", new_vars);
  // console.log("NEW PREFIXES:", new_prefix_definitions);

  // Report whether we found any name triples, and if not, return query as is.
  if (Object.keys(new_vars).length == 0) {
    return query;
  }

  // STEP 3: Reassemble the (possible augmented) query.
  console.log("NAME SERVICE found triples for the following variables:",
    Object.keys(new_vars));
  new_query_parts = {};
  new_query_parts["prefixes"] = new_prefix_definitions;
  var select_clause = query_parts["select_clause"];
  for (const select_var of Object.keys(new_vars)) {
    select_clause = select_clause.replace(RegExp("\\" + select_var),
      select_var + " " + new_vars[select_var]);
  }
  new_query_parts["select_clause"] = select_clause;
  // TODO: The ORDER BY is a workaround for Qlever Issue #729.
  new_query_parts["body"] =
      "{ SELECT " + query_parts["select_clause"] + " WHERE" +
      " { " + query_parts["body"] + " } " + query_parts["group_by"] +
      " ORDER BY " + Object.keys(new_vars)[0] + " }\n" +
      Object.values(new_triples).join(" .\n");
  // console.log("BODY:\n" + new_query_parts["body"]);
  new_query_parts["group_by"] = "";
  new_query_parts["footer"] = query_parts["footer"];
  new_query = createSparqlQueryFromParts(new_query_parts);
  // console.log(new_query);
  // var enhanced_query = createSparqlQueryFromParts(query_parts);
  // return enhanced_query;
  return new_query;
}

// Rewrite query in various ways, where the first three are synchronous (in a
// seperate function right below) and the fourth is asynchronous because it
// launches queries itself. Note that the first three are all HACKs, which
// should eventually be handled by the QLever backend instead of here.
//
// 1a. Rewrite FILTER CONTAINS(...) using ql:contains-word and ql:contains-entity
// 1b. Rewrite queries suitable for ql:has-predicate (simplistic)
// 1c. Rewrite ogc:contains using osm2rdf:contains_area and osm2rdf:contains_nonarea
//
// 4. Add "name service" triples
//
async function rewriteQuery(query, kwargs = {}) {
  // First the synchronous part (this should come first, so that the label
  // service gets a query where FILTER CONTAINS or ogc:contains have already
  // been replaced by constructs know to QLever.
  var query_rewritten = rewriteQueryNoAsyncPart(query);

  // If certain conditions are met, rewrite query with name service. This asks
  // queries to the backend, and is hence asynchronous.
  const apply_name_service = kwargs["name_service" == "always"] ||
    (kwargs["name_service"] == "if_checked" && $("#name_service").prop("checked"));
  if (apply_name_service) {
    try {
      query_rewritten = await enhanceQueryByNameTriples(query_rewritten);
    } catch(e) {
      console.log("ERROR in \"enhanceQueryByName\": " + e);
      return query_rewritten;
    }
  }

  return query_rewritten;
}

// Synchronous parts of the query rewriting, see above.
// TODO: We currently need this for the SPARQL suggestions, check whether that
// is still up to date.
function rewriteQueryNoAsyncPart(query) {
  var query_rewritten = query;

  // HACK 1: Rewrite FILTER KEYWORDS(?title, "info* retr*") using
  // ql:contains-entity and ql:contains-word.
  const rewriteFilterKeywords = true;
  if (rewriteFilterKeywords) {
    var num_rewrites_filter_contains = 0;
    var m_var = "?qlm_";
    var filter_contains_re = /FILTER\s+KEYWORDS\((\?[\w_]+),\s*(\"[^\"]+\")\)\s*\.?\s*/i;
    while (query_rewritten.match(filter_contains_re)) {
      query_rewritten = query_rewritten.replace(filter_contains_re,
           m_var + ' ql:contains-entity $1 . ' + m_var + ' ql:contains-word $2 . ');
      m_var = m_var + "i";
      num_rewrites_filter_contains += 1;
    }
    if (num_rewrites_filter_contains > 0) {
      console.log("Rewrote query with \"FILTER KEYWORDS\"");
    }
  }

  // HACK 2: Rewrite query to use ql:has-predicate if it fits a certain pattern
  // (which is currently far from covering all cases where it fits).
  const rewriteQlHasPredicateQueries = false;
  if (rewriteQlHasPredicateQueries) {
    var query_parts = splitSparqlQueryIntoParts(query);
    var select_clause_re = /(\?\S+) \(COUNT\(DISTINCT (\?\S+)\) AS (\?\S+)\)/i;
    var body_re = /(\?\S+) (\?\S+) (\?\S+)( \.)?/;
    var group_by_re = /GROUP BY (\?\S+)/i;
    var select_clause_match = query_parts["select_clause"].match(select_clause_re);
    var body_match = query_parts["body"].match(body_re);
    var body_without_match = query_parts["body"].replace(body_re, "");
    var group_by_match = query_parts["group_by"].match(group_by_re);
    if (select_clause_match && body_match && group_by_match &&
        select_clause_match[1] == body_match[2] &&
        select_clause_match[2] == body_match[1] &&
        select_clause_match[1] == group_by_match[1] &&
        !body_without_match.includes(body_match[2] + " ") &&
        !body_without_match.includes(body_match[3] + " ")
    ) {
      const subject = body_match[1];
      const predicate = body_match[2];
      const has_predicate_triple = subject + " ql:has-predicate " + predicate;
      // console.log("Query suitable for ql:has-predicate (subject = \"" + subject + "\", predicate = \"" + predicate + "\"): replacing \"" + body_match[0] + "\" by \"" + has_predicate_triple + "\"")
      query_parts["select_clause"] =
        query_parts["select_clause"].replace(/DISTINCT /, "");
      query_parts["body"] =
        query_parts["body"].replace(body_re, has_predicate_triple + " .");
      query_rewritten = createSparqlQueryFromParts(query_parts);
      console.log("Rewrote query using \"ql:has-predicate\":", query_rewritten);
    }
  }

  // HACK 3: Rewrite each occurrence of the ogc:contains predicate using the
  // predicates osm2rdf:contains_area and osm2rdf:contains_nonarea .
  //
  // TODO: currently assumes that there are no ogc:contains inside of UNION,
  // MINUS, OPTIONAL. Is this still true?.
  var num_rewrites_ogc_contains = 0;

  // First replace all { and } due to UNION, OPTIONAL, or MINUS by __OBR__ and
  // __CBR__.
  query_rewritten = escapeCurlyBracesOfUnionMinusOptional(query_rewritten);
  // var union_regex = /\{\s*([^{}]*[^{} ])\s*\}\s*UNION\s*\{\s*([^{}]*[^{} ])\s*\}/;
  // var optional_or_minus_regex = /(OPTIONAL|MINUS)\s*\{\s*([^{}]*[^{} ])\s*\}/;
  // while (true) {
  //   if (query_rewritten.match(union_regex)) {
  //     query_rewritten = query_rewritten.replace(union_regex,
  //       "__OBR__ $1 __CBR__ UNION __OBR__ $2 __CBR__");
  //   } else if (query_rewritten.match(optional_or_minus_regex)) {
  //     query_rewritten = query_rewritten.replace(optional_or_minus_regex,
  //       "$1 __OBR__ $2 __CBR__");
  //   } else {
  //     break;
  //   }
  // }

  // Now iteratively replace all ogc:contains within a { ... } scope.
  var ogc_contains_match = /ogc:contains([^_])/;
  var ogc_contains_replace = /\{(\s*)([^{}]*)ogc_tmp:contains([^{}]*[^{}\s])(\s*)\}/;
  while (query_rewritten.match(ogc_contains_match)) {
    if (!query_rewritten.includes("PREFIX ogc:")) query_rewritten =
      'PREFIX ogc: <http://www.opengis.net/rdf#>\n' + query_rewritten;
    if (!query_rewritten.includes("PREFIX osm2rdf:")) query_rewritten =
      'PREFIX osm2rdf: <https://osm2rdf.cs.uni-freiburg.de/rdf#>' + query_rewritten;
    m_var = m_var + "i";
    // Replace first occurrence by ql_ogc:contains and check that it is indeed
    // gone. That way, we can be sure that we do not enter an infinite loop in
    // case the regex from the large replace does not match.
    query_rewritten = query_rewritten.replace(ogc_contains_match,
      'ogc_tmp:contains$1');
    query_rewritten = query_rewritten.replace(ogc_contains_replace,
      '{ {$1$2osm2rdf:contains_area+ ' + m_var + ' . ' + m_var + ' osm2rdf:contains_nonarea$3\n' +
      '  } UNION { {$1$2osm2rdf:contains_area+$3$4} UNION {$1$2osm2rdf:contains_nonarea$3$4} } }');
    num_rewrites_ogc_contains += 1;
    // console.log("Version with " + m_var + ":\n" + query_rewritten);
    if (query_rewritten.includes('ogc_tmp:contains ')) {
      throw "Leftover ogc_tmp:contains, this should not happen";
    }
  }
  if (num_rewrites_ogc_contains > 0) {
    console.log("Rewrote query with \"ogc:contains\"");
  }

  // Replace all __OBR__ and __CBR__ back to { and }, respectively.
  query_rewritten = unescapeCurlyBracesOfUnionMinusOptional(query_rewritten);
  // query_rewritten = query_rewritten.replace(/__OBR__/g, "{");
  // query_rewritten = query_rewritten.replace(/__CBR__/g, "}");

  return query_rewritten;
}

// Replace all { and } due to UNION, OPTIONAL, or MINUS by __OBR__ and __CBR__.
// This is used in `rewriteQueryNoAsyncPart` above.
function escapeCurlyBracesOfUnionMinusOptional(query) {
  var union_regex = /\{\s*([^{}]*[^{} ])\s*\}\s*UNION\s*\{\s*([^{}]*[^{} ])\s*\}/;
  var optional_or_minus_regex = /(OPTIONAL|MINUS)\s*\{\s*([^{}]*[^{} ])\s*\}/;
  while (true) {
    if (query.match(union_regex)) {
      query = query.replace(union_regex, "__OBR__ $1 __CBR__ UNION __OBR__ $2 __CBR__");
    } else if (query.match(optional_or_minus_regex)) {
      query = query.replace(optional_or_minus_regex, "$1 __OBR__ $2 __CBR__");
    } else {
      break;
    }
  }
  // console.log("Query with UNION, OPTIONAL, or MINUS braces replaced: ", query_rewritten);
  return query;
}

// Unescape the escaping from the previous function. That is, replace all
// __OBR__ and __CBR__ back to { and }, respectively.
function unescapeCurlyBracesOfUnionMinusOptional(query) {
  query = query.replace(/__OBR__/g, "{");
  query = query.replace(/__CBR__/g, "}");
  return query;
}

// DEPRECATED: Get URL for current query.
function getQueryString(query) {

  // q = editor.getValue();
  // q = await rewriteQuery(q, kwargs);

  log("getQueryString:\n" + query, 'requests');

  var queryString = "?query=" + encodeURIComponent(query);
  // if ($("#name_service").prop("checked")) {
  //   queryString += "&name_service=true";
  // }
  if ($("#clear").prop('checked')) {
    queryString += "&cmd=clear-cache";
  }

  // Remove -proxy from base URL if so desired.
  // var base_url = BASEURL;
  // if (kwargs["replace-proxy"] == true) {
  //   base_url = baseurl.replace(/-proxy$/, "");
  // }

  return BASEURL + queryString
}

function cleanLines(cm) {
  var cursor = cm.getCursor();
  var selection = cm.listSelections()[0];
  var position = cm.getScrollInfo();
  var lastLine = undefined;
  var line = cm.getLine(0);
  for (var i = 0; i < cm.lastLine(); i++) {
    if (i != cursor.line && i != cursor.line - 1) {
      lastLine = line;
      line = cm.getLine(i);
      if (line.trim() == "") {
        if (i == 0) {
          cm.setSelection({ line: i, ch: 0 }, { line: i + 1, ch: 0 })
        } else {
          cm.setSelection({ line: i - 1, ch: 999999999 }, { line: i, ch: line.length });
        }
        cm.replaceSelection('');

        if (i < cursor.line) {
          cursor.line -= 1;
          selection.anchor = selection.head
        }
      }
      var startingWhitespaces = line.length - line.replace(/^\s+/, "").length;
      lineContent = line.slice(startingWhitespaces);
      if (lineContent != lineContent.replace(/\s{2,}/g, ' ')) {
        cm.setSelection({ line: i, ch: startingWhitespaces }, { line: i, ch: line.length });
        cm.replaceSelection(lineContent.replace(/\s{2,}/g, ' '));
      }
    }
  }
  cm.scrollTo(position.left, position.top);
  cm.setCursor(cursor);
  cm.setSelection(selection.anchor, selection.head);
}

// Triggered when using TAB
function switchStates(cm) {

  var cur = editor.getCursor(); // current cursor position
  var absolutePosition = editor.indexFromPos({ 'line': cur.line, 'ch': cur.ch + 1 }); // absolute cursor position in text

  var content = cm.getValue();

  var gaps = [];

  var gap1 = /WHERE/g
  while ((match = gap1.exec(content)) != null) {
    gaps.push(match.index + match[0].length - 5);
  }

  var gap2 = /(\s)*\}/g
  while ((match = gap2.exec(content)) != null) {
    gaps.push(match.index - 1);
  }

  gaps.push(content.length - 1);

  gaps = Array.from(new Set(gaps));
  gaps.sort(function (a, b) { return a - b });

  var found = false;
  for (gap of gaps) {
    if (gap > absolutePosition) {
      found = gap;
      break;
    }
  }

  if (found == false && gaps.length > 0) {
    found = gaps[0];
  }

  if (found == false) {
    return;
  }


  var newCursor = editor.posFromIndex(found);
  editor.setCursor(newCursor);
  var line = cm.getLine(newCursor.line);

  indentWhitespaces = (" ".repeat((line.length - line.trimStart().length)))

  if (line.slice(newCursor.ch, newCursor.ch + 5) == "WHERE") {
    // add empty whitespace in select if not present
    log("Found SELECT-Placeholder on postion " + found, 'other');
    cm.setSelection({ 'line': newCursor.line, 'ch': line.length - 8 }, { 'line': newCursor.line, 'ch': line.length - 7 });
    cm.replaceSelection("  ");
    cm.setCursor(newCursor.line, (line.length - 7));
  } else if (found >= content.length - 1) {
    log("Found MODIFIER-Placeholder on postion " + found, 'other');
    if (editor.getLine(newCursor.line + 1) == undefined || editor.getLine(newCursor.line + 1) != "") {
      log("Adding a line at the end of the input", 'other');
      cm.setSelection({ 'line': newCursor.line, 'ch': line.length }, { 'line': newCursor.line, 'ch': line.length });
      cm.replaceSelection('\n'+ indentWhitespaces);
    }
    cm.setCursor(newCursor.line + 1, 0);
  } else {
    log("Found WHERE-Placeholder on postion " + found, 'other');
    cm.setSelection({ 'line': newCursor.line, 'ch': 9999999 }, { 'line': newCursor.line, 'ch': 9999999 });

    if (line.slice(-1) == "{") {
      cm.replaceSelection('\n' + (" ".repeat($('#whitespaces').val())) + indentWhitespaces);
      cm.setCursor(newCursor.line + 1, $('#whitespaces').val() + indentWhitespaces.length);
    } else {
      cm.replaceSelection('\n' + indentWhitespaces);
      cm.setCursor(newCursor.line + 1, indentWhitespaces.length);
    }
  }

  cm.setSelection(cm.getCursor(), cm.getCursor());

  window.setTimeout(function () {
    CodeMirror.commands.autocomplete(editor);
  }, 100);
}

function changeTheme(theme = undefined) {
  if (editor.getOption("theme") == 'railscasts' || theme == 'default') {
    log('Setting theme to default...', 'other');
    editor.setOption('theme', 'default');
    $('body').css('background', '#FFFFFF');
    $('.well').css('background', '#F6F6F6');
    $('.navbar').css('background', '#262626');
    $('.navbar-default .navbar-nav>li>a,.navbar-default .navbar-brand').css('color', '#9d9d9d');
    $('.navbar').addClass('navbar-inverse');
    createCookie("theme", "default", 3);
  } else {
    log('Setting theme to dark...', 'other');
    editor.setOption('theme', 'railscasts');
    $('body').css('background', '#313131');
    $('.well,.navbar').css('background', '#D2D2D2');
    $('.navbar-default .navbar-nav>li>a,.navbar-default .navbar-brand').css('color', '#000');
    $('.navbar').removeClass('navbar-inverse');
    createCookie("theme", "railscasts", 3);
  }
}

function expandEditor() {
  if ($('#editorArea').hasClass("col-md-8")) {
    $('#editorArea').removeClass("col-md-8").addClass("col-md-12");
    $('#help').hide();
  } else {
    $('#editorArea').removeClass("col-md-12").addClass("col-md-8");
    $('#help').show();
  }
}

function displayError(response, queryId = undefined) {
  console.error("Either the GET request failed or the backend returned an error:", response);
  if (response["exception"] == undefined || response["exception"] == "") {
    response["exception"] = "Unknown error";
  }
  disp = "<h4><strong>Error processing query</strong></h4>";
  disp += "<p>" + htmlEscape(response["exception"]) + "</p>";
  // The query sometimes is a one-element array with the query TODO: find out why.
  if (Array.isArray(response.query)) {
    if (response.query.length >= 1) { response.query = response.query[0]; }
    else { response.query = "response.query is an empty array"; }
  }
  let queryToDisplay = response.query;
  // If the error response contains metadata about position of parse error,
  // highlight that part.
  if ("metadata" in response && "startIndex" in response.metadata
                             && "stopIndex" in response.metadata) {
    let start = response.metadata.startIndex;
    let stop = response.metadata.stopIndex;
    queryToDisplay = htmlEscape(queryToDisplay.substring(0, start))
                       + "<b><u style=\"color: red\">"
                       + htmlEscape(queryToDisplay.substring(start, stop + 1))
                       + "</u></b>" + htmlEscape(queryToDisplay.substring(stop + 1));
  } else {
      queryToDisplay = htmlEscape(queryToDisplay);
  }
  disp += "Your query was: " + "<br><pre>" + queryToDisplay + "</pre>";
  $('#errorReason').html(disp);
  $('#errorBlock').show();
  $('#answerBlock, #infoBlock').hide();

  // If error response contains query and runtime info, append to runtime log.
  //
  // TODO: Show items from error responses in different color (how about "red").
  if (response["query"] && response["runtimeInformation"] && queryId) {
    // console.log("DEBUG: Error response with runtime information found!");
    appendRuntimeInformation(response.runtimeInformation,
                             response.query,
                             response.time,
                             { queryId, updateTimeStamp: Number.MAX_VALUE });
    renderRuntimeInformationToDom();
  }
}

function displayWarning(result) {
  console.warn('QLever returned warnings while processing request', result);

  disp = "<h3>Warnings:</h3><ul>";
  $(result['warnings']).each((el) => {
    disp += '<li>' + result['warnings'][el] + '</li>';
  })
  $('#warningReason').html(disp + '</ul>');
  $('#warningBlock').show();
}

function displayStatus(str) {
  $("#errorBlock,#answerBlock,#warningBlock").hide();
  $("#info").html(str);
  $("#infoBlock").show();
}

function tsep(str) {
  var spl = str.toString().split('.');
  var intP = spl[0];
  var frac = spl.length > 1 ? '.' + spl[1] : '';
  var regex = /(\d+)(\d{3})/;
  while (regex.test(intP)) {
    intP = intP.replace(regex, '$1' + ',' + '$2');
  }
  return intP + frac;
}

function htmlEscape(str) {
  return str.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// Get formatted version of given entry `str` from the result table. Returns an
// array with two elements: the formatted result entry and a boolean that says
// whether the entry should be right aligned or not..
//
// For the kind of formatting, see the many cases in the implementation below.
// This is called in `processQuery` in `qleverUI.js` when filling the result
// table.
function getFormattedResultEntry(str, maxLength, column = undefined) {

  // Get the variable name from the table header. TODO: it is inefficient to do
  // this for every table entry.
  var var_name = $($("#resTable").find("th")[column + 1]).html();

  // If the entry is or contains a link, make it clickable (see where these
  // variables are set in the following code).
  let isLink = false;
  let linkStart = "";
  let linkEnd = "";

  // HACK: If the variable ends in "_sparql" or "_mapview", consider the value
  // as a SPARQL query, and show it in the QLever UI or on a map, respectively.
  if (var_name.endsWith("_sparql") || var_name.endsWith("_mapview")) {
    isLink = true;
    if (var_name.endsWith("_sparql")) {
      mapview_url = `https://qlever.cs.uni-freiburg.de/${SLUG}/` +
                    `?query=${encodeURIComponent(str)}`;
      icon_class = "glyphicon glyphicon-search";
      str = "Query view";
    } else {
      mapview_url = `https://qlever.cs.uni-freiburg.de/mapui-petri/` +
                    `?query=${encodeURIComponent(str)}` +
                    `&mode=objects&backend=${BASEURL}`;
      icon_class = "glyphicon glyphicon-globe";
      str = "Map view";
    }
    linkStart = `<span style="white-space: nowrap;">` +
                `<i class="${icon_class}"></i> ` +
                `<a href="${mapview_url}" target="_blank">`;
    linkEnd = '</a></span>';
  }

  // TODO: Do we really want to replace each _ by a space right in the
  // beginning?
  str = str.replace(/_/g, ' ');

  var pos;
  var cpy = str;
  var rightAlign = false;

  // For IRIs, remove everything before the final / or # and abbreviate what
  // remains if it's longer than `maxLength`.
  if (cpy.charAt(0) == '<') {
    pos = Math.max(cpy.lastIndexOf('/'), cpy.lastIndexOf('#'));
    var paraClose = cpy.lastIndexOf(')');
    if (paraClose > 0 && paraClose > pos) {
      var paraOpen = cpy.lastIndexOf('(', paraClose);
      if (paraOpen > 0 && paraOpen < pos) {
        pos = Math.max(cpy.lastIndexOf('/', paraOpen),
                       cpy.lastIndexOf('#', paraOpen));
      }
    }
    if (pos < 0) {
      pos += 1;
    }
    str = cpy.substring(pos + 1, cpy.length - 1);
    if (str.length > maxLength) {
      str = str.substring(0, maxLength - 1) + "[...]"
    }

  // For literals, remove everything after the final " and abbreviate what
  // remains if it is longer than `maxLength`.
  } else if (cpy.charAt(0) == '\"') {
    pos = cpy.lastIndexOf('\"');
    if (pos !== 0) {
      str = cpy.substring(0, pos + 1);
    }
    if (str.length > maxLength) {
      str = str.substring(0, maxLength - 1) + "[...]\""
    }

  // For entries that are neither IRIs nor literals (TODO: are these text
  // records?), abbreviate them if they are longer than `veryLongLength`.
  } else {
    const veryLongLength = 500;
    if (cpy.length > veryLongLength) {
      half_length = veryLongLength / 2 - 3;
      str = cpy.substring(0, half_length) + " [...] " + cpy.substring(cpy.length - half_length);
    }
  }

  // For IRIs and literals, remove the surrouning < > or " ", respectively.
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith('\"') && str.endsWith('\"'))) {
    str = str.slice(1, -1);
  }
  if (str.startsWith('<') && str.endsWith('>')) {
    str = str.slice(1, -1);
  }

  // HACK Hannah 16.09.2021: Custom formatting depending on the variable name in
  // the column header.
  // console.log("Check if \"" + str + "\" in column \"" + var_name + "\" is a float ...");
  if (var_name.endsWith("?note") || var_name.endsWith("_note")) str = parseFloat(str).toFixed(2).toString();
  if (var_name.endsWith("_per_paper")) str = parseFloat(str).toFixed(2).toString();
  if (var_name.endsWith("_perc") || var_name.endsWith("percent")) str = parseFloat(str).toFixed(2).toString();
  if (var_name.endsWith("?lp_proz")) str = parseFloat(str).toFixed(0).toString();
  if (var_name.endsWith("?gesamt_score") || var_name.endsWith("?imdb_rating")) str = parseFloat(str).toFixed(1).toString();
  if (var_name.endsWith("?lehrpreis")) str = parseFloat(str).toFixed(0).toString();

  pos = cpy.lastIndexOf("^^")
  pos_http = cpy.indexOf("http");

  // For typed literals (with a ^^ part), prepend icon to header that links to
  // that type.
  // TODO: What if ^^ occurs inside the literal?
  // TODO: This is computed for *every* entry of a column. It's not wrong
  // (because the code makes sure that the icon is prepended at most once), but
  // it's terribly inefficient.
  if (pos > 0) {
    cpy = cpy.replace(/ /g, '_');
    link = cpy.substring(pos).match(/(https?:\/\/[a-zA-Z0-9.:%/#\?_-]+)/g)[0];
    columnHTML = $($('#resTable').find('th')[column + 1]);
    content = '<a href="' + link + '" target="_blank"><i class="glyphicon glyphicon-list-alt" data-toggle="tooltip" title="' + link + '"></i></a> ';
    if (columnHTML.html().indexOf(content) < 0) {
      columnHTML.html(content + columnHTML.html());
    }
    // If the type is int or integer or if the type is decimal yet the number is
    // an integer, display the number with thousand separators and mark it as
    // right-aligned.
    const typeIsInteger = link.endsWith("int") || link.endsWith("integer");
    const typeIsDecimalButNumberIsInteger = link.endsWith("decimal") && str.match(/^\d+$/);
    if (typeIsInteger || typeIsDecimalButNumberIsInteger) {
      if (!var_name.endsWith("year")) {
        str = formatInteger(str);
        rightAlign = true;
      }
    }

  // For IRIs that start with http display the item depending on the link type.
  // For images, a thumbnail of the image is shown. For other links, prepend a
  // symbol that depends on the link type and links to the respective URL.
  //
  // TODO: What if http occur somewhere inside a literal or a link?
  } else if (pos_http > 0) {
    cpy = cpy.replace(/ /g, '_');
    link_match = cpy.match(/(https?:\/\/[a-zA-Z0-9.:%/#\?_-]+)/g);
    if(link_match != null) {
      isLink = true;
      link = link_match[0];
      checkLink = link.toLowerCase();
      if (checkLink.endsWith('jpg') || checkLink.endsWith('png') || checkLink.endsWith('gif') || checkLink.endsWith('jpeg') || checkLink.endsWith('svg')) {
        str = "";
        linkStart = '<a href="' + link + '" target="_blank"><img src="' + link + '" width="50" >';
        linkEnd = '</a>';
      } else if (checkLink.endsWith('pdf') || checkLink.endsWith('doc') || checkLink.endsWith('docx')) {
        linkStart = '<span style="white-space: nowrap;"><a href="' + link + '" target="_blank"><i class="glyphicon glyphicon-file"></i>&nbsp;';
        linkEnd = '</a></span>';
      } else {
        linkStart = '<span style="white-space: nowrap;"><a href="' + link + '" target="_blank"><i class="glyphicon glyphicon-link"></i>&nbsp;';
        linkEnd = '</a></span>';
      }
    }
  }

  // Any remaining < and > and & should now be takig literally.
  str = htmlEscape(str);

  // Abbreviate links longer than `maxLinkLength`.
  // TODO: What all counts as a link here?
  if (isLink) {
    const maxLinkLength = 50;
    if (str.length > maxLinkLength) str = str.substring(0, maxLinkLength - 4) + " ...";
    str = `${linkStart}${str}${linkEnd}`;
  }

  // Right align of the whole column gives a strange look when there are few
  // columns.
  if (rightAlign) {
    // str = "<span style=\"width: 5em; float: right\">" + str + "</span>";
    rightAlign = false;
  }

  // Return the modified string and whether it should be right aligned or not.
  return [str, rightAlign];
}

// Cookie helpers
var createCookie = function (name, value, days) {
  var expires = "";
  if (days) {
    var date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toGMTString();
  }
  document.cookie = name + "=" + value + expires + "; path=/";
}

function getCookie(c_name) {
  if (document.cookie.length > 0) {
    c_start = document.cookie.indexOf(c_name + "=");
    if (c_start != -1) {
      c_start = c_start + c_name.length + 1;
      c_end = document.cookie.indexOf(";", c_start);
      if (c_end == -1) {
        c_end = document.cookie.length;
      }
      return unescape(document.cookie.substring(c_start, c_end));
    }
  }
  return "";
}

// Compatibility helpers
String.prototype.trimLeft = String.prototype.trimLeft || function () {
  var start = -1;
  while (this.charCodeAt(++start) < 33);
  return this.slice(start, this.length);
};
