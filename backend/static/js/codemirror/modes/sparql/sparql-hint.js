var lastUrl; // remark url for autocomplete call
var requestExtension = false; // append autocompletion or create new widget
var lastSize = 0; // size of last auto completion call (increases over the time)
var size = 40; // size for next auto completion call
var resultSize = 0; // result size for counter badge
var lastWidget = undefined; // last auto completion widget instance
var activeLine; // the current active line that holds loader / counter badge
var activeLineBadgeLine; // the badge holder in the current active line
var activeLineNumber; // the line number of the active line (replaced by loader)

var sparqlCallback;
var sparqlFrom;
var sparqlTo;
var sparqlTimeout;
var suggestions;

(function (mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"), require("../../mode/sparql/sparql"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror", "../../mode/sparql/sparql"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function (CodeMirror) {
  "use strict";


  var timeoutCompletion; // holds the window.timeout of the completion - needed to stop requests
  var sparqlQuery; // holds the sparql query that is executed

  var Pos = CodeMirror.Pos,
    cmpPos = CodeMirror.cmpPos;

  // helper to detect arrays
  function isArray(val) {
    return Object.prototype.toString.call(val) == "[object Array]"
  }

  // get language specific keywords
  function getKeywords(editor) {
    var mode = editor.doc.modeOption;
    return CodeMirror.resolveMode(mode).keywords;
  }

  // add matches to result
  function addMatches(result, addedSuggestions, context) {
    log('Found  ' + addedSuggestions.length + ' suggestions for this position', 'suggestions');
    // current line
    var cursor = editor.getCursor();
    var line = editor.getLine(cursor.line).slice(0, cursor.ch);
    var curChar = line[line.length - 1];
    var lineTokens = [];
    var token = "";
    var types = getAvailableTypes(context);

    // split line by white spaces
    var nextToken = undefined;
    do {
      nextToken = getLastLineToken(line);
      if (!(nextToken.string.match(/^\?[\w\d]*$/) && nextToken.endsInWhitespace)) {
        lineTokens.unshift(nextToken);
      }
      line = line.slice(0, nextToken.start)
    } while (nextToken == undefined || nextToken.start != 0);

    // remove tokens one by one until there are suggestions
    var foundSuggestions = false;
    var allSuggestions = [];

    for (var j in lineTokens) {
      if (foundSuggestions) {
        break;
      }
      var currentTokens = lineTokens.slice(j);
      var token = "";

      // Rebuild the token we just typed
      for (var subToken of currentTokens) {
        token += subToken.string;
        if (subToken.endsInWhitespace) {
          token += " ";
        }
      }
      for (var suggestion of addedSuggestions) {

        var word = suggestion.word;
        var type = types[suggestion.type] || {};
        var alreadyExists = 0;

        var fullLineContent = editor.getLine(cursor.line).trim();
        if (type.requiresEmptyLine == true && (fullLineContent != "" && !word.startsWith(fullLineContent))) {
          continue;
        }

        // check if the type already exists
        if (type.onlyOnce == true) {
          // get content to test with
          var content = (context) ? context['content'] : editor.getValue();

          if (type.definition) {
            type.definition.lastIndex = 0;
            var match = content.match(type.definition) || [];
            alreadyExists = match.length;
          }
        }

        if (j == 0 && type.suggestOnlyWhenMatch != true && alreadyExists == 0) {
          allSuggestions.push(suggestion.word);
        }

        if (word.toLowerCase().startsWith(token.toLowerCase()) && token.trim().length > 0 && word != token) {

          // if the type already exists but it is within the token we just typed: continue suggesting it
          // if it is outside of what we typed: don't suggest it
          if (alreadyExists == 1) {
            type.definition.lastIndex = 0;
            var match = type.definition.exec(token);
            if (!match) {
              continue;
            }
          } else if (alreadyExists > 1) {
            continue;
          }

          for (var subToken of currentTokens) {
            if (subToken.endsInWhitespace) {
              word = word.replace(RegExp(subToken.string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i"), "").replace(/^\s*/, "");
            }
          }

          result.push(word);
          foundSuggestions = true;
        }
      }
    }

    line = editor.getLine(cursor.line).slice(0, cursor.ch);
    // suggest everything if we didn't find any suggestion and didn't start typing a word
    if (!foundSuggestions && (!curChar || curChar.match(/\s/))) {
      log('Could not determine any limits - showing all suggestions', 'suggestions');
      if ((context && context.suggestInSameLine == true) || line == undefined || line.match(/^\s+$/)) {
        for (var suggestion of allSuggestions) {
          result.push(suggestion);
        }
      }
    }

  }

  // This function defines the CORE LOGIC OF THE QLEVER UI SUGGESTIONS
  //
  // TODO: explain how it works in this comment.
  CodeMirror.registerHelper("hint", "sparql", function (editor, callback, options) {

    // If a previous AC query is still running, cancel it.
    //
    // NOTE: `sparqlTimeout` and `activeLine` are both set in the function
    // `getQleverSuggestions` (which sends the AC query to the backend and turns
    // the result into nice-looking suggestions).
    window.clearTimeout(sparqlTimeout);
    if (activeLine) {
      activeLine.html(activeLineNumber);
    }

    // Get the current cursor position and its index in the whole query.
    var cur = editor.getCursor();
    var absolutePosition = editor.indexFromPos((cur));

    // Get the element of the query tree at that position.
    //
    // TODO: This is currently a major bug, since for a typical SPARQL query,
    // there are different tree elements for ordinary triples, the FILTER
    // clauses (one element each), or the UNION or OPTIONAL clauses (again, one
    // element each). That way, the sensitive AC queries do not work correctly
    // when one of FILTER, UNION, or OPTIONAL is present, or after these
    // clauses.
    var context = getCurrentContext(absolutePosition);
    // console.log("context", context);

    log('Position: ' + absolutePosition, 'suggestions');
    if (context) {
      log('Context: ' + context.w3name, 'suggestions');
    } else {
      log('Context: None', 'suggestions');
    }

    // Get the token at the current cursor position.
    var line = editor.getLine(cur.line).slice(0, cur.ch);
    var token = getLastLineToken(line);
    var start, end;
    if (token.endsInWhitespace) {
      start = end = cur.ch;
    } else {
      start = token.start;
      end = token.end;
    }

    // Determine all types that potentially could (not necessarily actually do)
    // occur in this context. These are all `TYPES` which contain the name of
    // the current context in their `availableInContext`.
    types = getAvailableTypes(context);
    // console.log("Types: ", types);

    sparqlCallback = callback;
    sparqlFrom = Pos(cur.line, start);
    sparqlTo = Pos(cur.line, end);

    suggestions = []; // TODO: Why is this a global variable?
    var allTypeSuggestions = [];
    for (var i = 0; i < types.length; i++) {
      for (var suggestion of getTypeSuggestions(types[i], context)) {
        if (context && context.forceLineBreak && !suggestion.endsWith('\n')) {
          suggestion += "\n";
        }
        allTypeSuggestions.push({ word: suggestion, type: i });
      }
    }
    addMatches(suggestions, allTypeSuggestions, context);

    sparqlCallback({
      list: suggestions,
      from: sparqlFrom,
      to: sparqlTo,
    });

    return false;

  });
  CodeMirror.hint.sparql.async = true;

});

/**

Find the complex types

@params context - the current context

**/
function getAvailableTypes(context) {
  types = [];

  contextName = "undefined";
  if (context) {
    contextName = context.w3name;
  }
  // console.log(`getAvailableTypes -> contextName: ${contextName}`);

  // check for complex types that are valid in this context
  for (var i = 0; i < COMPLEXTYPES.length; i++) {
    if (COMPLEXTYPES[i].availableInContext.indexOf(contextName) != -1) {
      // console.log(`getAvailableTypes -> type: ${COMPLEXTYPES[i].name}`);
      types.push(COMPLEXTYPES[i]);
    }
  }

  return types;
}

function detectPropertyPath(predicate) {
  var propertyPath = [];
  var property = "";
  var bracketCounter = 0;
  for (var ch of predicate) {
    if (ch == "/" && bracketCounter === 0) {
      propertyPath.push(property);
      property = "";
      continue;
    } else if (ch == "<") {
      bracketCounter++;
    } else if (ch == ">") {
      bracketCounter--;
    }
    property += ch;
  }
  propertyPath.push(property);

  return propertyPath;
}

// Get suggestions for the given "context" (element of the query tree).
//
// NOTE: This function is only called via the `TRIPLE` type in `COMPLEXTYPES`
// from `sparql.js`. It eventually calls `getQleverSuggestions`.
function getDynamicSuggestions(context) {
  var cur = editor.getCursor();
  var line = editor.getLine(cur.line);
  var suggestionMode = parseInt($("#dynamicSuggestions").val() + '');

  word = getLastLineToken(line.slice(0, cur.ch));
  if (word.endsInWhitespace) { word = ""; } else { word = word.string; }

  // Get current line and split into `words` by whitespace.
  var words = line.slice(0, cur.ch).trimLeft().replace('  ', ' ').split(" ");

  // Find words that are separated by whitespace but seem to belong together.
  var whiteSpaceWord = "";
  for (var i = words.length - 1; i >= 0; i--) {
    var prevWord = words[i]
    if (!(prevWord.startsWith("?") || prevWord.startsWith("<") || prevWord.endsWith(">") || prevWord.indexOf(":") != -1)) {
      if (i == words.length - 1) {
        whiteSpaceWord = prevWord;
      } else {
        whiteSpaceWord = (prevWord + " " + whiteSpaceWord);
      }
      words.splice(i, 2, whiteSpaceWord);
    } else {
      break;
    }
  }
  word = words[words.length - 1];
  var wordIndex = line.slice(0, cur.ch).lastIndexOf(word);
  if (wordIndex != -1 && word.length > 0) {
    sparqlFrom = CodeMirror.Pos(cur.line, wordIndex);
    sparqlTo = CodeMirror.Pos(cur.line, cur.ch);
  }

  // Collect prefixes (as string and dict).
  var prefixes = "";
  var prefixesRelation = {};
  var lines = getPrefixLines();
  for (var prefLine of lines) {
    if (prefLine.trim().startsWith("PREFIX")) {
      var match = /PREFIX (.*): ?<(.*)>/g.exec(prefLine.trim());
      if (match) {
        prefixes += prefLine.trim() + '\n';
        prefixesRelation[match[1]] = match[2];
      }
    }
  }

  // Get editor lines and remove current line.
  var lines = context['content'].split('\n');
  // console.log("lines", lines);
  for (var i = 0; i < lines.length; i++) {
    if (lines[i] == line) {
      lines.splice(i, 1);
      // watch for property paths and insert temporary lines
      if (words.length == 2) {
        var propertyPath = detectPropertyPath(word);

        if (propertyPath.length > 1) {
          // Found a property path!
          for (var j = 0; j < propertyPath.length - 1; j++) {
            lines.splice(i + j, 0, words[0] + " " + propertyPath[j] + " ?temp_" + j + " .");
            words[0] = "?temp_" + j;
          }
          word = propertyPath[propertyPath.length - 1];
          sparqlFrom = CodeMirror.Pos(sparqlTo.line, sparqlTo.ch - word.length);
        }

      }
      break;
    }
  }

  // replace the prefixes
  $.each(prefixesRelation, function (key, value) {
    if (word.startsWith(key + ':')) {
      word = '<' + word.replace(key + ':', value);
      return false;
    }
  });

  if (words.length < 1 || words[0].toUpperCase() == "FILTER") {

    var response = [];
    var variables = getVariables(context, undefined, "both");
    for (var i = 0; i < variables.length; i++) {
      response.push(variables[i] + ' ');
    }
    return response;

  } else {

    // Find part of query to plug in for %CONNECTED_TRIPLES% in AC query
    // templates.
    //
    // TODO: Lines with FILTER on connected variables are missing,
    // for example https://qlever.cs.uni-freiburg.de/wikidata/Z0FvRA
    const variableRegex = /\?\w+\b/g;
    let seenVariables = line.match(variableRegex);
    if (seenVariables) {
      // at first we know only the variable in our current line and do not use any other lines
      let linesTaken = [];
      let foundNewVariables = true;
      while (foundNewVariables) {
        foundNewVariables = false;
        for (const curLine of lines) {
          if (curLine == "" || linesTaken.indexOf(curLine) != -1) {
            continue;
          }
          // check for each already seen variable
          for (const seenVariable of seenVariables) {
            if (RegExp('\\' + seenVariable + "\\b").test(curLine) && curLine.indexOf('{') == -1) {
              linesTaken.push(curLine);
              // search for variables
              for (const lineVariable of curLine.match(variableRegex)) {
                if (seenVariables.indexOf(lineVariable) == -1) {
                  seenVariables.push(lineVariable);
                  // do another iteration because there are new variables
                  foundNewVariables = true;
                }
              }
              break;
            }
          }
        }
      }

      lines = [];
      for (var line of linesTaken) {
        let trimmed = line.trim();
        if (!(/^FILTER/i.test(trimmed)) && !(/\.$/.test(trimmed))) {
          // Add dots to lines without dots.
          trimmed += " .";
        }
        lines.push(trimmed);
      }
    }

    sparqlQuery = "";
    var sendSparql = !(word.startsWith('?'));
    var sparqlLines = "";
    var mode1Query = "";  // mode 1 is context-insensitive
    var mode2Query = "";  // mode 2 is context-sensitive
    var suggestVariables;
    var appendToSuggestions = "";
    var nameList;
    var response = [];
    var predicateForObject = undefined;
    if (suggestionMode > 0) {
      if (words.length == 1) {
        suggestVariables = "both";
        appendToSuggestions = " ";
        mode1Query = SUGGESTSUBJECTS_CONTEXT_INSENSITIVE;
        mode2Query = SUGGESTSUBJECTS;
        nameList = subjectNames;
      } else if (words.length == 2) {
        suggestVariables = word.startsWith('?') ? "normal" : false;
        appendToSuggestions = " ";
        nameList = predicateNames;
        response = PREDICATESUGGESTIONS;
        // add single prefixes to suggestions
        if (SUGGEST_PREFIXNAMES_FOR_PREDICATES) {
          response = response.concat(getPrefixNameSuggestions(word));
        }
        mode1Query = SUGGESTPREDICATES_CONTEXT_INSENSITIVE;
        mode2Query = SUGGESTPREDICATES;
      } else if (words.length == 3) {
        predicateForObject = words[1];
        suggestVariables = "normal";
        appendToSuggestions = ' .';
        nameList = objectNames;
        // TRYING STH OUT: Make object AC queries "half-sensitive" (ignore the
        // context triples, but not the predicate, see head.html). If you want
        // to restrict this to certain instances, use a condition like SLUG ==
        // "pubchem".
        if (SLUG != "uniprot") {
          mode1Query = SUGGESTOBJECTS_CONTEXT_HALFSENSITIVE;
        } else {
          mode1Query = SUGGESTOBJECTS_CONTEXT_INSENSITIVE;
        }
        mode2Query = SUGGESTOBJECTS;

        // Replace the prefixes.
        var propertyPath = detectPropertyPath(words[1]);

        for (var i in propertyPath) {
          var property = propertyPath[i];
          $.each(prefixesRelation, function (key, value) {
            if (property.startsWith(key + ':')) {
              var addAsterisk = false;
              if (property.endsWith('*')) {
                property = property.slice(0, property.length - 1);
                addAsterisk = true;
              }
              let noPrefixProperty = '<' + property.replace(key + ':', value) + '>';

              if (REPLACE_PREDICATES[noPrefixProperty] !== undefined) {
                property = REPLACE_PREDICATES[noPrefixProperty];
              }

              if (addAsterisk) {
                property += "*";
              }

              propertyPath[i] = property;
              return false;
            }
          });
        }

        words[1] = propertyPath.join("/");

        var lastWord = words[1];
        if (!lastWord.startsWith("<") && lastWord.indexOf("/") != -1) {
          // property path detected. Get last predicate as lastWord
          var properties = lastWord.split("/");
          lastWord = properties[properties.length - 1];
        }
        lastWord = (predicateNames[lastWord] != "" && predicateNames[lastWord] != undefined) ? predicateNames[lastWord] : words[1];
        if (typeof (lastWord) == "object") {
          lastWord = String(lastWord);
        }
        if (lastWord == "ql:contains-entity") {
          sendSparql = false;
        } else if (lastWord == "ql:contains-word") {
          sendSparql = false;
          suggestVariables = false;
        } else {
          var subject = (subjectNames[words[0]] != "" && subjectNames[words[0]] != undefined) ? subjectNames[words[0]] : words[0];
          var subjectVarName = subject.split(/[.\/\#:]/g).slice(-1)[0].replace(/@\w*$/, '').replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
          var objectVarName = lastWord.split(/[.\/\#:]/g).slice(-1)[0]
            .replace(/@\w*$/, "").replace(/\s/g, "_")
            .replace(/^has([A-Z_-])/, "$1$")
            .replace(/^([a-z]+)edBy/, "$1$")
            .replace(/^(year)[A-Z_]\w*/, "$1$")
            .replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();

          response.push('?' + objectVarName + ' .');
          response.push('?' + subjectVarName + '_' + objectVarName + ' .');
        }
      } else {
        console.warn('Skipping every suggestions based on current position...');
        return [];
      }

      let completionQuery = "";
      let mixedModeQuery = "";
      switch(suggestionMode) {
        case 1:
          completionQuery = mode1Query;
          break;
        case 2:
          completionQuery = mode2Query; break;
        case 3:
          completionQuery = mode2Query;
          mixedModeQuery = mode1Query;
          break;
      }

      if (sendSparql && completionQuery) {
        sparqlLines = replaceQueryPlaceholders(completionQuery, word, prefixes, lines, words);
        if (mixedModeQuery) {
          mixedModeQuery = replaceQueryPlaceholders(mixedModeQuery, word, prefixes, lines, words);
        }
        getQleverSuggestions(sparqlLines, prefixesRelation, appendToSuggestions, nameList, predicateForObject, word, mixedModeQuery);
      }

      if (suggestVariables) {
        var variables = getVariables(context, undefined, suggestVariables);
        for (var variable of variables) {
          response.push(variable + appendToSuggestions);
        }
      }
      return (!requestExtension) ? response : [];

    }
  }
  console.warn('Skipping every suggestions based on current position...');
  return [];
}

function replaceQueryPlaceholders(completionQuery, word, prefixes, lines, words) {
  // first, build the complete AC query
  sparqlLines = substituteCustomPlaceholders(completionQuery)

  for (const prefixName in COLLECTEDPREFIXES) {
    prefixes += `\nPREFIX ${prefixName}: <${COLLECTEDPREFIXES[prefixName]}>`
  }

  word = word.replaceAll('.','\\\\.')
             .replaceAll('*','\\\\*')
             .replaceAll('^','\\\\^')
             .replaceAll('?','\\\\?')
             .replaceAll('[','\\\\[')
             .replaceAll(']','\\\\]');
  var word_with_bracket = ((word.startsWith("<") || word.startsWith('"')) ? "" : "<") + word.replace(/'/g, "\\'");
  sparqlLines = sparqlLines.replace(/%<CURRENT_WORD%/g, word_with_bracket).replace(/%CURRENT_WORD%/g, word);
  sparqlLines = sparqlLines.replace(/%PREFIXES%/g, prefixes);


  var linePlaceholder = sparqlLines.match(/(\s*)%CONNECTED_TRIPLES%/);
  while (linePlaceholder != null) {
    sparqlLines = sparqlLines.replace(/%CONNECTED_TRIPLES%/g, lines.join(linePlaceholder[1]));
    linePlaceholder = sparqlLines.match(/(\s*)%CONNECTED_TRIPLES%/);
  }

  if (words.length > 0) {
    sparqlLines = sparqlLines.replace(/%CURRENT_SUBJECT%/g, words[0]);
  }
  if (words.length > 1) {
    // HACK (Hannah, 23.02.2021): Replace <pred1>/<pred2>* by
    // <pred1>|<pred2> in object completion, but only when the subject is a
    // variable.
    if (words[0].startsWith("?")) {
      words[1] = words[1].replace(/^([^ \/]+)\/([^ \/]+)\*$/, "$1|$2");
      log("CURRENT_PREDICATE -> ", words[1], 'suggestions');
    }

    sparqlLines = sparqlLines.replace(/%CURRENT_PREDICATE%/g, words[1]);
  }

  sparqlLines = evaluateIfStatements(sparqlLines, word, lines, words)

  return sparqlLines;
}

function substituteCustomPlaceholders(completionQuery) {
  substitutionFinished = true;
  for (const replacement in WARMUP_AC_PLACEHOLDERS) {
    let sparqlLines = completionQuery.replace(new RegExp(`%${replacement}%`, "g"), WARMUP_AC_PLACEHOLDERS[replacement]);
    if (sparqlLines !== completionQuery) {
      substitutionFinished = false;
      completionQuery = sparqlLines;
    }
  }
  if (substitutionFinished) {
    return completionQuery;
  } else {
    return substituteCustomPlaceholders(completionQuery)
  }
}

function evaluateIfStatements(completionQuery, word, lines, words) {
  // find all IF statements
  let if_statements = [];
  const ifRegex = /#\sIF\s+([!A-Z_\s]+)\s+#/;
  let match = completionQuery.match(ifRegex);
  let substrIdx = 0;
  while (match != null) {
    // find all IF declarations
    const index = match.index;
    const len = match[0].length;
    substrIdx += index + len;
    if_statements.push({ 'IF': { 'index': substrIdx - len, 'len': len }, 'condition': match[1] });
    const substr = completionQuery.slice(substrIdx);
    match = substr.match(ifRegex);
  }

  if_statements = if_statements.reverse();
  for (let statement of if_statements) {
    // find matching ELSE and ENDIFs
    const start = statement['IF']['index'];
    const endifMatch = completionQuery.slice(start).match(/#\sENDIF\s#/);
    const elseMatch = completionQuery.slice(start).match(/#\sELSE\s#/);

    if (elseMatch != null && elseMatch.index < endifMatch.index) {
      const index = start + elseMatch.index;
      const len = elseMatch[0].length;
      statement['ELSE'] = { 'index': index, 'len': len };
    }

    if (endifMatch == null) {
      console.error("Number of # IF # and # ENDIF # does not match!");
    }
    const index = start + endifMatch.index;
    const len = endifMatch[0].length;
    statement['ENDIF'] = { 'index': index, 'len': len }

    let conditionSatisfied = parseAndEvaluateCondition(statement.condition, word, lines, words);

    let result = completionQuery.slice(0, statement['IF']['index']);

    if (conditionSatisfied && statement["ELSE"] == undefined) {
      // Add content between IF and ENDIF
      result += completionQuery.slice(statement['IF']['index'] + statement['IF']['len'], statement['ENDIF']['index']);
    } else if (conditionSatisfied && statement["ELSE"] != undefined) {
      // Add content between IF and ELSE
      result += completionQuery.slice(statement['IF']['index'] + statement['IF']['len'], statement['ELSE']['index']);
    } else if (!conditionSatisfied && statement["ELSE"] != undefined) {
      // Add content between ELSE and ENDIF
      result += completionQuery.slice(statement['ELSE']['index'] + statement['ELSE']['len'], statement['ENDIF']['index']);
    }

    result += completionQuery.slice(statement['ENDIF']['index'] + statement['ENDIF']['len']);
    completionQuery = result;
  }

  return completionQuery
}

function parseAndEvaluateCondition(condition, word, lines, words) {
  // split condition by AND and OR
  const logicalOperator = condition.match(/(.*)\s+(OR)\s+(.*)/) || condition.match(/(.*)\s(AND)\s+(.*)/);
  const negated = condition.startsWith("!");
  let conditionSatisfied = false;
  if (logicalOperator != null) {
    const lhs = parseAndEvaluateCondition(logicalOperator[1], word, lines, words);
    const rhs = parseAndEvaluateCondition(logicalOperator[3], word, lines, words);

    if (logicalOperator[2] == "OR") {
      conditionSatisfied = lhs || rhs;
    } else {
      conditionSatisfied = lhs && rhs;
    }
  } else if (negated) {
    conditionSatisfied = !parseAndEvaluateCondition(condition.slice(1), word, lines, words);
  } else {
    if (condition == "CURRENT_WORD_EMPTY") {
      conditionSatisfied = (word.length == 0);
    } else if (condition == "CURRENT_SUBJECT_VARIABLE") {
      conditionSatisfied = (words.length > 0 && words[0].startsWith("?"));
    } else if (condition == "CURRENT_PREDICATE_VARIABLE") {
      conditionSatisfied = (words.length > 1 && words[1].startsWith("?"));
    } else if (condition == "CONNECTED_TRIPLES_EMPTY") {
      conditionSatisfied = (lines.length == 0);
    } else {
      console.error(`Invalid condition in IF statement: '${condition}'`);
    }
  }
  log(`Evaluating condition: "${condition}", word="${word}", lines=${lines.length}, words=${words}\n  result: ${conditionSatisfied}`, 'other');
  return conditionSatisfied;
}

// Get result of SPARQL query with timeout.
//
// NOTE: The function returns immediately with a `fetch` promise. To wait for
// the result of the `fetch` (or its failure), call `await fetchTimeout(...)`.
const fetchTimeout = async (sparqlQuery, timeoutSeconds, queryId) => {
  const parameters = {
    query: sparqlQuery,
    // Only add timeout if it's valid
    ...(timeoutSeconds > 0 && { timeout: `${timeoutSeconds}s` })
  };
  return fetchQleverBackend(parameters, { "Query-Id": queryId });
};

function getSuggestionsSparqlQuery(sparqlQuery) {
  if (!sparqlQuery) return false;
  // Do the limits for the scrolling feature.
  sparqlQuery += "\nLIMIT " + size + "\nOFFSET " + lastSize;

  // Rewrite queries also when obtaining suggestions (FILTER CONTAINS or
  // ql:contains).
  sparqlQuery = rewriteQueryNoAsyncPart(sparqlQuery);

  // Show the loading indicator and badge.
  activeLineBadgeLine = $('.CodeMirror-activeline-background');
  activeLine = $('.CodeMirror-activeline-gutter .CodeMirror-gutter-elt');
  if(activeLine.html().length < 10){
    activeLineNumber = activeLine.html();
  }
  activeLine.html('<img src="/static/img/ajax-loader.gif">');
  $('#aBadge').remove();
  $('#suggestionErrorBlock').parent().hide()
  log("Getting suggestions from QLever (PREFIXes omitted):\n"
    + sparqlQuery.replace(/^PREFIX.*/mg, ""), "requests");

  return sparqlQuery;
}

// Helper function that opens a websocket to cancel a single query.
function cancelQuery(queryId) {
  const ws = new WebSocket(getWebSocketUrl(queryId));
  ws.onopen = () => {
    ws.send("cancel");
    ws.close();
  };
  ws.onerror = () => log(`Failed to cancel query with id ${queryId}`, "other");
}


// Get suggestions from QLever backend and show them to the user.
function getQleverSuggestions(
  sparqlQuery,          // the main AC query
  prefixes,             // prefixes used for abbreviating IRIs
  appendix,
  nameList,
  predicateForObject,
  word,
  mixedModeQuery        // `mixedModeQuery` : the "backup" query when in mixed mode
) {

  // Show the loading indicator and badge
  activeLineBadgeLine = $('.CodeMirror-activeline-background');
  activeLine = $('.CodeMirror-activeline-gutter .CodeMirror-gutter-elt');
  activeLineNumber = activeLine.html();
  activeLine.html('<img src="/static/img/ajax-loader.gif">');
  $('#aBadge').remove();
  $('#suggestionErrorBlock').parent().hide()

  const lastSparqlQuery = getSuggestionsSparqlQuery(sparqlQuery);
  const mixedModeSparqlQuery = getSuggestionsSparqlQuery(mixedModeQuery);

  // The actual code for getting the suggestions and showing them.
  //
  // TODO: Why is this wrapped in a `setTimeout` with a timeout of only 500
  // milliseconds?
  const sparqlTimeoutDuration = 500;
  const activeAutoCompleteQueries = new Set();
  sparqlTimeout = window.setTimeout(async function () {
    // Issue AC query (or two when in mixed mode) and get `response`.
    try {
      activeAutoCompleteQueries.forEach(cancelQuery);
      // When in mixed mode, first issue the alternative query (but don't wait
      // for it to return, `fetchTimeout` returns a promise).
      let mixedModeQuery = null;
      if (mixedModeSparqlQuery) {
        const queryId = generateQueryId();
        activeAutoCompleteQueries.add(queryId);
        mixedModeQuery = fetchTimeout(mixedModeSparqlQuery, DEFAULT_TIMEOUT, queryId)
          .finally(() => activeAutoCompleteQueries.delete(queryId));
      }
      // Issue the main autocompletion query (and wait for it to return).
      const mainQueryTimeout = mixedModeSparqlQuery ? MIXED_MODE_TIMEOUT : DEFAULT_TIMEOUT;
      const queryId = generateQueryId();
      const mainQueryResult = await fetchTimeout(lastSparqlQuery, mainQueryTimeout, queryId)
        .finally(() => activeAutoCompleteQueries.delete(queryId));
      
      // Get the actual query result as `data`.
      const data = mainQueryResult.res || mixedModeQuery === null
        ? mainQueryResult
        : await mixedModeQuery;
      const isMixedModeSuggestion = !mainQueryResult.res && mixedModeQuery !== null;
      // Cancel queries that might still be pending. 
      activeAutoCompleteQueries.forEach(cancelQuery);

      // Show the suggestions to the user.
      //
      // NOTE: This involves some post-processing (for example, showing the
      // suggestions with prefixes like `wdt:` and not with their full IRIs as
      // returned by the backend) and several hacks (for example, when wdt:P31
      // is a suggestion, also add wdt:P31/wdt:P279*).
      if (data.res) {
        log("Got suggestions from QLever.", 'other');
        log("Query took " + data.time.total + " and found " + data.resultsize + " lines", 'requests');
        var entityIndex = data.selected.indexOf(SUGGESTIONENTITYVARIABLE);
        var suggested = {};
        var ogc_contains_added = false;
        for (var result of data.res) {
          var entity = result[entityIndex];

          // NOTE: What was the purpose of this? The AC queries group by entity,
          // so there should be no duplicates. When a  predicate occurs in both
          // directions, this "continue" prevents the predicate showing twice
          // (with and without ^).
          // if (suggested[entity]) {
          //   continue
          // }
          suggested[entity] = true;

          if (predicateForObject !== undefined) {
            var resultType = LITERAL;
            if (/^<.*>$/.test(entity)) {
              resultType = ENTITY;
            } else if (/@[\w-_]+$/.test(entity)) {
              resultType = LANGUAGELITERAL;
            }
          }

          // Abbreviate IRIs using the prefixes of the SPARQL query.
          var replacePrefix = "";
          var prefixName = "";
          for (var prefix in prefixes) {
            if (entity.indexOf(prefixes[prefix]) > 0 && prefixes[prefix].length > replacePrefix.length) {
              replacePrefix = prefixes[prefix];
              prefixName = prefix;
            }
          }

          // Repeat, using ALL prefixes from the backend configuraion
          // (`FILLPREFIXES` is `fillPrefixes` from the backend configuration).
          if (FILLPREFIXES) {
            for (var prefix in COLLECTEDPREFIXES) {
              if (entity.indexOf(COLLECTEDPREFIXES[prefix]) > 0 && COLLECTEDPREFIXES[prefix].length > replacePrefix.length) {
                replacePrefix = COLLECTEDPREFIXES[prefix];
                prefixName = prefix;
              }
            }
          }
          if (replacePrefix.length > 0) {
            entity = entity.replace("<" + replacePrefix, prefixName + ':').slice(0, -1);
          }

          if (predicateForObject !== undefined) {
            if (predicateResultTypes[predicateForObject] == undefined) {
              predicateResultTypes[predicateForObject] = resultType;
            } else {
              predicateResultTypes[predicateForObject] = Math.max(predicateResultTypes[predicateForObject], resultType);
            }
          }

          var nameIndex = data.selected.indexOf(SUGGESTIONNAMEVARIABLE);
          var altNameIndex = data.selected.indexOf(SUGGESTIONALTNAMEVARIABLE);
          var entityName = (nameIndex != -1) ? result[nameIndex] : "";
          var altEntityName = (altNameIndex != -1) ? result[altNameIndex] : "";
          nameList[entity] = entityName;
          // add ^ if the reversed column exists
          // and is 1 (indicating that this is a predicate suggestion, but for
          // the reversed predicate.
          var reversedIndex = data.selected.indexOf(SUGGESTIONREVERSEDVARIABLE);
          var reversed = (reversedIndex != -1 && (result[reversedIndex] == 1
                            || result[reversedIndex].startsWith("\"1\"")))
          var displayText = (reversed ? "^" : "") + entity + appendix;
          var completion = (reversed ? "^" : "") + entity + appendix;
          const dynamicSuggestions = [];
          dynamicSuggestions.push({
            displayText: displayText,
            completion: completion,
            name: entityName + (reversed ? " (reversed)" : ""),
            altname: altEntityName,
            isMixedModeSuggestion: isMixedModeSuggestion,
          });
          // HACK Hannah 23.02.2021: Add transitive suggestions (for
          // hand-picked predicates only -> TODO: generalize this).
          // console.log("DISPLAY TEXT: \"" + displayText + "\"");
          if (displayText == "wdt:P31 ") {
            dynamicSuggestions.push({
              displayText: displayText.trim() + "/wdt:P279* ",
              completion: completion.trim() + "/wdt:P279* ",
              name: entityName + " (transitive)",
              altname: altEntityName,
              isMixedModeSuggestion: isMixedModeSuggestion
            });
          } else if (displayText == "wdt:P131 ") {
            dynamicSuggestions.push({
              displayText: "wdt:P131+ ",
              completion: "wdt:P131+ ",
              name: entityName + " (transitive)",
              altname: altEntityName,
              isMixedModeSuggestion: isMixedModeSuggestion
            });
          } else if (!ogc_contains_added && displayText.startsWith("osm2rdf:contains_")) {
            dynamicSuggestions.splice(dynamicSuggestions.length - 1, 0, {
              displayText: "ogc:contains ",
              completion: "ogc:contains ",
              // displayText: "ogc:contains_area*/ogc:contains_nonarea ",
              // completion: "ogc:contains_area*/ogc:contains_nonarea ",
              name: "",
              altname: altEntityName,
              isMixedModeSuggestion: isMixedModeSuggestion
            });
            ogc_contains_added = true;
          } else if (displayText == "rdf:type " && window.location.href.match(/yago-2/)) {
            dynamicSuggestions.push({
              displayText: displayText.trim() + "/rdfs:subClassOf* ",
              completion: completion.trim() + "/rdfs:subClassOf* ",
              name: entityName + " (transitive)",
              altname: altEntityName,
              isMixedModeSuggestion: isMixedModeSuggestion
            });
          }
        }

        activeLine.html(activeLineNumber);
      } else {
        activeLine.html('<i class="glyphicon glyphicon-remove" style="color:red; cursor: pointer;" onclick="$(\'#suggestionErrorBlock\').parent().show()"></i>');
        $('#suggestionErrorBlock').html('<strong>Error while collecting suggestions:</strong><br><pre>' + data.exception + '</pre>')
        console.error(data.exception);
      }

      // Reset loading indicator.
      $('#aBadge').remove();

      // Add badge that shows the total numbers of suggestions.
      if (data.resultsize != undefined && data.resultsize != null) {
        resultSize = data.resultsize;
        activeLineBadgeLine.prepend('<span class="badge badge-success pull-right" id="aBadge">' + data.resultsize + '</span>');
      }

      sparqlCallback({
        list: suggestions.concat(dynamicSuggestions),
        from: sparqlFrom,
        to: sparqlTo,
        word: word
      });
    } catch (err) {
      // Qlever didn't return proper result because of a network
      // error or some other failure.
      console.error('Failed to load suggestions from QLever', err);
      activeLine.html(activeLineNumber);
    }

  }, sparqlTimeoutDuration);


}


// Get all suggestions for the given `type`by computing the cross-product of the
// elements in the array `type.suggestions`, see `COMPLEXTYPES` in `sparql.js`.
//
// For example, for the type `LIMIT`, the suggestion array is ['LIMIT ', [1, 10,
// 100, 1000], '\n'], and the list of suggestions computed is hence
//
// LIMIT 1
// LIMIT 10
// LIMIT 100
// LIMIT 1000
//
// An element of `type.suggestions` can also be a function. For example,
// `TRIPLE` contains `function (c) { return getDynamicSuggestions(c); }`. These
// functions are called with the given `context`.
function getTypeSuggestions(type, context) {

  typeSuggestions = []

  for (var i = 0; i < type.suggestions.length; i++) {

    var suggestion = type.suggestions[i];
    var dynString = "";
    var placeholders = [];

    // evaluate placeholders in definition
    for (var j = 0; j < suggestion.length; j++) {

      // concat dyn string
      if (typeof suggestion[j] == 'object') {
        if (suggestion[j] && suggestion[j].length > 0) {
          dynString += '{[' + placeholders.length + ']}';
          placeholders.push(suggestion[j]);
        }
      } else if (typeof suggestion[j] == 'function') {
        if (suggestion[j] && suggestion[j].length > 0) {
          dynString += '{[' + placeholders.length + ']}';
          placeholders.push(suggestion[j](context));
        }
      } else {
        dynString += suggestion[j]
      }

    }

    // no multiplying placeholders - simply use the string with no value
    if (placeholders.length == 0) {
      typeSuggestions.push(dynString);
    } else if (placeholders[0].length != 0 && placeholders[0] != false) {
      // mulitply the suggestiony by placeholders
      tempStrings = [];
      for (var k = 0; k < placeholders.length; k++) {
        // there are no valid values for this placeholder. Skip.
        if (placeholders[k].length != 0 && placeholders[k] != false) {
          // multiply by each valid value for each placeholder
          newTempStrings = $.extend([], tempStrings);
          tempStrings = [];
          for (var l = 0; l < placeholders[k].length; l++) {
            if (k == 0) {
              // first iteration is different
              placeholders[k][l] = '' + placeholders[k][l];
              var replacement = dynString.replace('{[' + k + ']}', placeholders[k][l]).replace('{[' + k + ']}', (placeholders[k][l]).replace('?', ''));
              tempStrings.push(replacement);
            } else {
              // second iteration mulitplies the solutions already found
              for (var m = 0; m < newTempStrings.length; m++) {
                placeholders[k][l] = '' + placeholders[k][l];
                var replacement = newTempStrings[m].replace('{[' + k + ']}', placeholders[k][l]).replace('{[' + k + ']}', (placeholders[k][l]).replace('?', ''));
                tempStrings.push(replacement);
              }
            }
          }
        } else {
          tempStrings = [];
        }
      }
      $.extend(typeSuggestions, tempStrings);

    }
  }

  if (type.onlyOncePerVariation != false) {

    // get content to test with
    content = (context) ? context['content'] : editor.getValue();

    // ignore DISTINCT keywords when detecting duplicates
    content = content.replace(/DISTINCT /g, '');

    var tempSuggestions = $.extend([], typeSuggestions);
    typeSuggestions = [];
    // check if this combination is already in use in this context
    for (var i = 0; i < tempSuggestions.length; i++) {
      if (content.indexOf(tempSuggestions[i].replace('DISTINCT ', '')) == -1) {
        typeSuggestions.push(tempSuggestions[i]);
      }
    }

  }
  return typeSuggestions;
}

// Compute tree representation of the given (partial) SPARQL query.
//
// NOTE: The result is returned as an array of elements with fields `w3name`,
// `content`, `start`, `end`, and optionally `children` (the latter giving this
// a tree-like structure)giving this a tree-like structure). The values for
// the fields `start` and `end` are absolute and not relative to the second
// argument `start` of the function.
//
// NOTE: To get the tree for the whole query from the editor window,
// call `buildQueryTree(editor.getValue(), 0)`.
function buildQueryTree(content, start) {

  var tree = [];
  var i = 0;

  var tempString = "";
  var tempElement = { w3name: 'PrefixDecl', start: start }

  // Iteratively go through the query character by character.
  while (i < content.length) {
    tempString += content[i];

    // Determine whether we should start a new tree element (`tempElement`) and
    // finish the previous one. The following sequences (minus the quotes)
    // start a new element:
    //
    // "SELECT ", "WHERE {", "OPTIONAL {",
    //
    // TODO: A lot of code duplication here and some mistakes. Also, why are the
    // regexes hard-coded here and not part of the definitions of `CONTEXTS` in
    // `sparql.js`?
    if (/SELECT $/i.test(tempString)) {
      tempElement['content'] = tempString.slice(0, tempString.length - 7);
      tempElement['end'] = i + start - 6;
      tree.push(tempElement);
      tempString = "";
      tempElement = { w3name: 'SelectClause', suggestInSameLine: true, start: i + start }
    } else if (/WHERE \{$/i.test(tempString)) {
      tempElement['content'] = tempString.slice(0, tempString.length - 7);
      tempElement['end'] = i + start - 6;
      tree.push(tempElement);
      tempString = "";
      tempElement = { w3name: 'WhereClause', suggestInSameLine: true, start: i + start }
    } else if (/OPTIONAL \{$/i.test(tempString)) {
      tempElement['content'] = tempString.slice(0, tempString.length - 10);
      tempElement['end'] = i + start - 9;
      tree.push(tempElement);
      tempString = "";
      tempElement = { w3name: 'WhereClause', suggestInSameLine: true, start: i + start }
    } else if (/MINUS \{$/i.test(tempString)) {
      tempElement['content'] = tempString.slice(0, tempString.length - 7);
      tempElement['end'] = i + start - 6;
      tree.push(tempElement);
      tempString = "";
      tempElement = { w3name: 'WhereClause', suggestInSameLine: true, start: i + start }
    } else if (/VALUES $/i.test(tempString)) {
      tempElement['content'] = tempString.slice(0, tempString.length - 8);
      tempElement['end'] = i + start - 7;
      tree.push(tempElement);
      tempString = "";
      tempElement = { w3name: 'ValuesClause', suggestInSameLine: true, start: i + start }
    } else if (/FILTER $/i.test(tempString)) {
    // } else if (/FILTER \(?$/i.test(tempString)) {
      tempElement['content'] = tempString.slice(0, tempString.length - 7);
      tempElement['end'] = i + start - 6;
      tree.push(tempElement);
      tempString = "";
      tempElement = { w3name: 'Filter', suggestInSameLine: true, start: i + start }
    } else if (tempElement.w3name == 'ValuesClause' && /{$/i.test(tempString)) {
      // TODO: How does this go together with the regex for VALUES above?
      tempElement['content'] = tempString.slice(0, tempString.length - 7);
      tempElement['end'] = i + start;
      tree.push(tempElement);
      tempString = "";
      tempElement = { w3name: 'DataBlock', suggestInSameLine: true, start: i + start }
    } else if (/UNION \{$/i.test(tempString)) {
      tempElement['content'] = tempString.slice(0, tempString.length - 7);
      tempElement['end'] = i + start - 6;
      tempElement.w3name = 'WhereClause';
      tree.push(tempElement);
      tempString = "";
      tempElement = { w3name: 'WhereClause', suggestInSameLine: true, start: i + start }
    } else if (tempString.endsWith('{')) {

      // Iterate to find the closing `}` or the end of `content`. Extend
      // `tempString` until before the closing `}`, while `subString` is the
      // part after the opening `{`.
      var depth = 1;
      var subStart = i;
      var subString = "";
      i++;
      while (i < content.length) { // NOTE: was <= content.length and i++ at beginning.
        if (content[i] == '}') {
          depth -= 1;
          if (depth == 0) break;
        } else if (content[i] == '{') {
          depth += 1;
        }
        subString += content[i];
        tempString += content[i];
        i++;
      }

      // Recursively build tree for the part in "{...}".
      if (tempElement['children']) {
        tempElement['children'] = tempElement['children'].concat(buildQueryTree(subString, subStart));
      } else {
        tempElement['children'] = buildQueryTree(subString, subStart);
      }
    }
    // Solution modifiers at the end of the query.
    else if (tempString.endsWith('}') || ((tempElement.w3name == "OrderCondition" || tempElement.w3name == "GroupCondition") && tempString.endsWith('\n'))) {
      tempElement['content'] = tempString.slice(0, tempString.length - 1);
      tempElement['end'] = i + start - 1;
      tree.push(tempElement);
      tempString = "";
      tempElement = { w3name: 'SolutionModifier', suggestInSameLine: true, start: i + start }
    }

    // Go to the next character.
    i++;
  }

  // Add the last element.
  tempElement['content'] = tempString;
  tempElement['end'] = content.length + start;
  tree.push(tempElement);

  // Some post-processing for `OptionalClause`, `UnionClause`, and
  // `SolutionModifier`.
  //
  // TODO: Why do we need to explicitly set the name of the first child of
  // `OptionalClause` and `UnionClause` to `WhereClause`?
  //
  // TODO: Why the additional parsing of the `SolutionModifier` here? Is it
  // because we have additional structure within a line here, whereas the code
  // above assumes that new elements only start at new lines?
  for (var element of tree) {
    if (element.w3name == "OptionalClause" || element.w3name == "UnionClause") {
      if (element['children']) {
        element['children'][0].w3name = "WhereClause";
      }
    } else if (element.w3name == "SolutionModifier") {

      var j = 0;
      var tempSubString = "";

      while (j < element.content.length) {

        tempSubString += element.content[j];
        if (/ORDER BY $/i.test(tempSubString)) {

          var elementContent = "";
          while (j < element.content.length && !elementContent.endsWith('\n')) {
            elementContent += element.content[j];
            j++;
          }
          if ('children' in element) {
            element['children'].push({ w3name: 'OrderCondition', suggestInSameLine: true, start: j + element.start - elementContent.length, end: j + element.start + 1 - (elementContent.split("\n").length - 1), content: elementContent });
          } else {
            element['children'] = [{ w3name: 'OrderCondition', suggestInSameLine: true, start: j + element.start - elementContent.length, end: j + element.start + 1 - (elementContent.split("\n").length - 1), content: elementContent }];
          }
          j--;
          tempSubString = "";

        }
        if (/GROUP BY $/i.test(tempSubString)) {

          var elementContent = "";
          var start = element.start + j;
          while (j < element.content.length && !elementContent.endsWith('\n')) {
            elementContent += element.content[j];
            j++;
          }
          if ('children' in element) {
            element['children'].push({ w3name: 'GroupCondition', suggestInSameLine: true, start: j + element.start - elementContent.length, end: j + element.start + 1 - (elementContent.split("\n").length - 1), content: elementContent });
          } else {
            element['children'] = [{ w3name: 'GroupCondition', suggestInSameLine: true, start: j + element.start - elementContent.length, end: j + element.start + 1 - (elementContent.split("\n").length - 1), content: elementContent }];
          }
          j--;
          tempSubString = "";

        }

        j++;
      }
    }
  }


  return tree;

}

function printQueryTree(tree, absPosition, prefix) {
  var logString = "";
  for (var element of tree) {
    logString += prefix + ">>> " + element.w3name + ' [' + element.start + ' to ' + element.end + ']\n';
    if (element.children) {
      logString += printQueryTree(element.children, absPosition, prefix + "    ");
    }
  }
  return logString;
}

// Get the context (see `CONTEXTS` from sparql.js) of the given
// position.
function getCurrentContext(absPosition) {
  var tree = buildQueryTree(editor.getValue(), 0);
  log("\n" + printQueryTree(tree, absPosition, ""), 'parsing');
  return searchTree(tree, absPosition);
}

// TODO: This function appears to be unused.
function getNextContext(absPosition) {
  var tree = buildQueryTree(editor.getValue(), 0);
  var current = searchTree(tree, absPosition);
  for (var i = absPosition; i < editor.getValue().length + 1; i++) {
    var found = searchTree(tree, i);
    if (current != found && found != undefined) {
      // console.log('Found ' + found.w3name);
      return found;
    }
  }
  return false;
}

// For the given query tree, find the element (each element is a "context" from
// sparql.js:CONTEXTS) that contains the given position and return it.
function searchTree(tree, absPosition) {
  // Iterate over all elements in the tree and return the first one that
  // contains the given `absPosition`. If that position is contained within the
  // children of an element, recurse (so that, effectively, we only return
  // leaf elements).
  for (var element of tree) {
    if (absPosition >= element.start && absPosition <= element.end) {
      if (element.children && absPosition >= element.children[0].start && absPosition <= element.children[element.children.length - 1].end) {
        child = searchTree(element.children, absPosition);
        if (child) {
          if (child.w3name == "PrefixDecl") {
            if (element.w3name == 'SolutionModifier') {
              return { w3name: 'SolutionModifier', content: "" };
            } else {
              return { w3name: 'SubQuery', content: "" };
            }
          }
          return child
        } else {
          if (element.w3name == 'SolutionModifier') {
            return { w3name: 'SolutionModifier', content: "" };
          } else {
            return { w3name: 'SubQuery', content: "" };
          }
        }
      } else {
        return element;
      }
    }
  }
  log("Could not find context for position " + absPosition, 'parsing');
  return undefined;
}

// Find the *first* occurrence of the given context (for example, `WhereClause`,
// see `CONTEXTS` in sparql.js) in the content of the editor window.
//
// TODO: Why is it OK to always only find the first match? This is used a lot in
// sparql.js:`COMPLEXTYPES` and seems to be central for the query parsing.
function getContextByName(name) {
  var editorContent = editor.getValue()
  var foundContext = undefined;

  // TODO: Should not `CONTEXTS` be an associative array if we use it like this?
  $(CONTEXTS).each(function (index, context) {

    if (context.w3name == name) {

      context.definition.lastIndex = 0;
      var match = context.definition.exec(editorContent);

      if (match && match.length > 1) {

        foundContext = context;
        foundContext['start'] = match.index;
        foundContext['end'] = match.index + match[0].length;
        foundContext['content'] = getValueOfContext(context);
        return false;

      }
    }

  });
  return foundContext;
}

function getPrefixLines() {
  var editorContent = editor.getValue()
  var prefixContent;

  $(CONTEXTS).each(function (index, context) {

    if (context.w3name == 'PrefixDecl') {

      context.definition.lastIndex = 0;
      var match = context.definition.exec(editorContent);

      if (match && match.length > 1) {
        prefixContent = getValueOfContext(context).split('\n');
        return false;

      }
    }

  });
  return prefixContent;
}

/**

Returns the value of the given context

@params context - the current context

- Excludes duplicate definitions if told to do so

**/
function getValueOfContext(context) {
  var editorContent = editor.getValue();

  context.definition.lastIndex = 0;
  var relevantPart = context.definition.exec(editorContent);

  if (relevantPart.length > 1) {
    return relevantPart[1];
  }
  return "";
}

/**

Returns prefixes to suggest

@params context - the current context
@params excludeAggregationVariables - excludes variables that are the result of an aggregation (SUM(?x) as ?aggregate_variable)
@params variableType - can be "text" for text variables, "normal" for normal variables or "both" for both
@params predicateResultType - only return variables of given type or higher

- Excludes duplicate definitions if told to do so
- Add list with all unused variables as one suggestion

**/
function getVariables(context, excludeAggregationVariables, variableType, predicateResultType) {
  var variables = [];
  var editorContent = editor.getValue();

  if (variableType === undefined) {
    variableType = "normal";
  }

  if (predicateResultType === undefined) {
    predicateResultType = ENTITY;
  }

  filter = '.CodeMirror .cm-variable';
  if (excludeAggregationVariables) {
    filter = ".CodeMirror .cm-variable:not('.cm-aggregate-variable')";
  }

  // get the variables
  $(filter).each(function (key, variable) {
    if (variables.indexOf(variable.innerHTML) == -1 && variable.innerHTML.length > 1) {
      var cleanedVar = variable.innerHTML.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var isTextVariable = RegExp(cleanedVar + "\\s+ql:contains-(entity|word)", "i").test(editorContent);
      if (variableType == "normal" && isTextVariable || variableType == "text" && !isTextVariable) {
        return "continue";
      }
      if (predicateResultType !== ENTITY) {
        var match = editorContent.match(RegExp("\\S+[^\\S\\n]+(\\S+)[^\\S\\n]+" + cleanedVar + "(\\W|$)"));
        if (!match) {  // Variable is no object so we don't want it
          return "continue";
        }
        if (predicateResultTypes[match[1]] !== undefined && predicateResultTypes[match[1]] < predicateResultType) {
          return "continue";
        }
      }
      variables.push(variable.innerHTML);

    }
  });

  if (context['w3name'] == 'SelectClause' && variables.length > 1) {
    // remove duplicates
    var varlist = "";
    var listlength = 0
    for (variable of variables) {
      if (getContextByName('SelectClause').content.indexOf(variable) == -1) {
        varlist += variable + ' ';
        listlength++;
      }
    }
    if (varlist != "" && listlength > 1) {
      variables.push(varlist);
    }
  }

  return variables;
}

/**

Returns prefixes to suggest

@params context - the prefix context

- Excludes duplicate definitions

**/
function getPrefixSuggestions(context) {
  var prefixes = []

  // get content of current context
  var testAgainst = (context) ? context['content'] : false;
  for (var key in COLLECTEDPREFIXES) {
    var prefix = key + ': <' + COLLECTEDPREFIXES[key] + '>';
    if (testAgainst && testAgainst.indexOf(prefix) != -1) {
      continue;
    }
    prefixes.push(prefix);
  }
  return prefixes;
}

function getPrefixNameSuggestions() {
  var prefixes = []

  for (var key in COLLECTEDPREFIXES) {
    if (word) {
      prefixes.push(key + ":");
    }
  }
  return prefixes;
}

// eats the string from the right side, returning
// tokens that are separated by whitespace
function getLastLineToken(line) {
  var fullLength = line.length;
  line = line.replace(/\s*$/, "");
  var end = line.length;
  var start = 0;
  for (var i = line.length - 1; i >= 0; i--) {
    if (line[i].match(/\s/)) {
      start = i + 1;
      break;
    }
  }
  return { start: start, end: end, string: line.slice(start, end), endsInWhitespace: (fullLength != end) }
}
