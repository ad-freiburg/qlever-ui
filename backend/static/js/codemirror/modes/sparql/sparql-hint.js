var lastUrl; // remark url for autocomplete call
var requestExtension = false; // append autocompletion or create new widget
var lastSize = 0; // size of last auto completion call (increases over the time)
var size = 40; // size for next auto completion call
var resultSize = 0; // result size for counter badge
var lastWidget = undefined; // last auto completion widget instance
var activeLine; // the current active line that holds loader / counter badge
var activeLineBadgeLine; // the bade holder in the current active line
var activeLineNumber; // the line number of the active line (replaced by loader)

var sparqlCallback;
var sparqlFrom;
var sparqlTo;
var sparqlTimeout;
var sparqlRequest;
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

  CodeMirror.registerHelper("hint", "sparql", function (editor, callback, options) {


    // ************************************************************************************
    //
    //
    //                        CORE LOGIC OF QLEVER UI SUGGESTIONS
    //
    //
    // ************************************************************************************

    // skip everything that is running by now
    window.clearTimeout(sparqlTimeout);
    if (sparqlRequest) { sparqlRequest.abort(); }

    // reset the previous loader
    if (activeLine) {
      activeLine.html(activeLineNumber);
    }

    var cur = editor.getCursor(); // current cursor position
    var absolutePosition = editor.indexFromPos((cur)); // absolute cursor position in text
    var context = getCurrentContext(absolutePosition); // get current context
    suggestions = [];

    log('Position: ' + absolutePosition, 'suggestions');
    if (context) {
      log('Context: ' + context.w3name, 'suggestions');
    } else {
      log('Context: None', 'suggestions');
    }

    // get current token
    var line = editor.getLine(cur.line).slice(0, cur.ch);
    var token = getLastLineToken(line);
    var start, end;
    if (token.endsInWhitespace) {
      start = end = cur.ch;
    } else {
      start = token.start;
      end = token.end;

    }

    types = getAvailableTypes(context);

    sparqlCallback = callback;
    sparqlFrom = Pos(cur.line, start);
    sparqlTo = Pos(cur.line, end);

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

  // check for complex types that are valid in this context
  for (var i = 0; i < COMPLEXTYPES.length; i++) {
    if (COMPLEXTYPES[i].availableInContext.indexOf(contextName) != -1) {
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

function getDynamicSuggestions(context) {
  var cur = editor.getCursor();
  var line = editor.getLine(cur.line);
  var suggestionMode = parseInt($("#dynamicSuggestions").val() + '');

  word = getLastLineToken(line.slice(0, cur.ch));
  if (word.endsInWhitespace) { word = ""; } else { word = word.string; }

  // get current line
  var words = line.slice(0, cur.ch).trimLeft().replace('  ', ' ').split(" ");

  // Find words that are separated by whitespace but seem to be belong together
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

  // collect prefixes (as string and dict)>
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

  // Get editor lines and remove current line
  var lines = context['content'].split('\n');
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

    // find connected lines in given select clause
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
        mode1Query = SUGGESTOBJECTS_CONTEXT_INSENSITIVE;
        mode2Query = SUGGESTOBJECTS;
        // replace the prefixes
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
          var objectVarName = lastWord.split(/[.\/\#:]/g).slice(-1)[0].replace(/@\w*$/, '').replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

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

  word = word.replace('.','\\\\.').replace('*','\\\\*').replace('^','\\\\^').replace('?','\\\\?').replace('[','\\\\[').replace(']','\\\\]')
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
    // <pred1>|<pred2> in object completion.
    words[1] = words[1].replace(/^([^ \/]+)\/([^ \/]+)\*$/, "$1|$2");
    log("CURRENT_PREDICATE -> ", words[1], 'suggestions');

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

function getUrlFromSparqlQuery(sparqlQuery, timeout) {
  if (!sparqlQuery) return false;
  // do the limits for the scrolling feature
  sparqlQuery += "\nLIMIT " + size + "\nOFFSET " + lastSize;

  // HACK(Hannah 14.08.2020): query rewrite for KEYWORDS from
  // helper.js also for completion queries.
  sparqlQuery = sparqlQuery.replace(
    /FILTER\s+keywords\((\?[\w_]+),\s*(\"[^\"]+\")\)\s*\.?\s*/ig,
    '?kwm ql:contains-entity $1 . ?kwm ql:contains-word $2 . ');

    // show the loading indicator and badge
    activeLineBadgeLine = $('.CodeMirror-activeline-background');
    activeLine = $('.CodeMirror-activeline-gutter .CodeMirror-gutter-elt');
    if(activeLine.html().length < 10){
      activeLineNumber = activeLine.html();
    }
    activeLine.html('<img src="/static/img/ajax-loader.gif">');
    $('#aBadge').remove();
    $('#suggestionErrorBlock').parent().hide()
    log('Getting suggestions from QLever:\n' + sparqlQuery, 'requests');

  let url = BASEURL + "?query=" + encodeURIComponent(sparqlQuery);
  if (timeout) {
    url += "&timeout=" + timeout;
  }
  return url;
}


function getQleverSuggestions(sparqlQuery, prefixesRelation, appendix, nameList, predicateForObject, word, mixedModeQuery) {
  /* mixedModeQuery is the case-insensitive query that is sent additionally to the case-sensitive query when mixed mode is enabled. */


  // show the loading indicator and badge
  activeLineBadgeLine = $('.CodeMirror-activeline-background');
  activeLine = $('.CodeMirror-activeline-gutter .CodeMirror-gutter-elt');
  activeLineNumber = activeLine.html();
  activeLine.html('<img src="/static/img/ajax-loader.gif">');
  $('#aBadge').remove();
  $('#suggestionErrorBlock').parent().hide()

  const lastUrl = getUrlFromSparqlQuery(sparqlQuery, timeout=MIXED_MODE_TIMEOUT);
  const mixedModeUrl = getUrlFromSparqlQuery(mixedModeQuery);
  var dynamicSuggestions = [];

  sparqlTimeout = window.setTimeout(async function () {
    try {
      let mixedModeQuery;
      if (mixedModeUrl) {
        mixedModeQuery = fetch(mixedModeUrl);  // start the mixed mode query, but async
      }
      const response = await fetch(lastUrl);  // start the main query and wait for it to return
      let data = await response.json();
      let mainQueryHasTimedOut = false;
      if (mixedModeUrl && data.status === "ERROR" && data.exception.toLowerCase().indexOf("timeout") !== -1) {
        // the main query timed out.
        // get the mixedModeQuery's response and continue with that
        mainQueryHasTimedOut = true;
        const mixedModeResponse = await mixedModeQuery;
        data = await mixedModeResponse.json();
      }

      if ($('#logRequests').is(':checked')) {
        runtime_log[runtime_log.length] = data.runtimeInformation;
        query_log[query_log.length] = data.query;
        if (runtime_log.length - 10 >= 0) {
          runtime_log[runtime_log.length - 10] = null;
          query_log[query_log.length - 10] = null;
        }
      }

      log("Got suggestions from QLever.", 'other');
      if (mainQueryHasTimedOut) {
        log("The main query timed out. Using the context-insensitive suggestions.", 'requests')
      }
      log("Query took " + data.time.total + " and found " + data.resultsize + " lines\nRuntime info is saved as [" + (query_log.length) + "]", 'requests');

      if (data.res) {
        var entityIndex = data.selected.indexOf(SUGGESTIONENTITYVARIABLE);
        var suggested = {};
        for (var result of data.res) {
          var entity = result[entityIndex];

          if (suggested[entity]) {
            continue
          }
          suggested[entity] = true;

          if (predicateForObject !== undefined) {
            var resultType = LITERAL;
            if (/^<.*>$/.test(entity)) {
              resultType = ENTITY;
            } else if (/@[\w-_]+$/.test(entity)) {
              resultType = LANGUAGELITERAL;
            }
          }

          // add back the prefixes
          var replacePrefix = "";
          var prefixName = "";
          for (var prefix in prefixesRelation) {
            if (entity.indexOf(prefixesRelation[prefix]) > 0 && prefixesRelation[prefix].length > replacePrefix.length) {
              replacePrefix = prefixesRelation[prefix];
              prefixName = prefix;
            }
          }
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
          var reversed = (reversedIndex != -1 && result[reversedIndex] == 1);
          dynamicSuggestions.push({
            displayText: (reversed ? "^" : "") + entity + appendix,
            completion: (reversed ? "^" : "") + entity + appendix,
            name: entityName + (reversed ? " (reversed)" : ""),
            altname: altEntityName,
            isMixedModeSuggestion: mainQueryHasTimedOut,
          });
        }

        activeLine.html(activeLineNumber);

      } else {
        activeLine.html('<i class="glyphicon glyphicon-remove" style="color:red; cursor: pointer;" onclick="$(\'#suggestionErrorBlock\').parent().show()"></i>');
        $('#suggestionErrorBlock').html('<strong>Error while collecting suggestions:</strong><br><pre>' + data.exception + '</pre>')
        console.error(data.exception);
      }
      // reset loading indicator
      
      $('#aBadge').remove();

      // add badge
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

      return []
    } catch (err) {
      // things went terribly wrong...
      console.error('Failed to load suggestions from QLever', err);
      activeLine.html('<i class="glyphicon glyphicon-remove" style="color:red;">');
      activeLine.html(activeLineNumber);
      return [];
    }

  }, 500);


}


/**
 
Returns the suggestions defined for a given complex type
 
**/
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

/**
 
Build a query tree
 
**/
function buildQueryTree(content, start) {

  var tree = [];
  var i = 0;

  var tempString = "";
  var tempElement = { w3name: 'PrefixDecl', start: start }

  while (i < content.length) {
    tempString += content[i];

    if (/SELECT $/i.test(tempString)) {

      // shorten the end of prefix decl by what we needed to add to match SELECT 
      tempElement['content'] = tempString.slice(0, tempString.length - 7);
      tempElement['end'] = i + start - 6;
      tree.push(tempElement);
      tempString = "";

      tempElement = { w3name: 'SelectClause', suggestInSameLine: true, start: i + start }

    } else if (/WHERE \{$/i.test(tempString)) {

      // shorten the end of the select clause by what we needed to add to match WHERE {
      tempElement['content'] = tempString.slice(0, tempString.length - 7);
      tempElement['end'] = i + start - 6;
      tree.push(tempElement);
      tempString = "";

      tempElement = { w3name: 'WhereClause', suggestInSameLine: true, start: i + start }

    } else if (/OPTIONAL \{$/i.test(tempString)) {

      // shorten the end of the previous clause by what we needed to add to match OPTIONAL {
      tempElement['content'] = tempString.slice(0, tempString.length - 7);
      tempElement['end'] = i + start - 3;
      tree.push(tempElement);
      tempString = "";

      tempElement = { w3name: 'OptionalClause', suggestInSameLine: true, start: i + start }

    } else if (/VALUES $/i.test(tempString)) {

      // shorten the end of the previous clause by what we needed to add to match VALUES {
      tempElement['content'] = tempString.slice(0, tempString.length - 7);
      tempElement['end'] = i + start - 6;
      tree.push(tempElement);
      tempString = "";

      tempElement = { w3name: 'ValuesClause', suggestInSameLine: true, start: i + start }

    } else if (tempElement.w3name == 'ValuesClause' && /{$/i.test(tempString)) {

      // shorten the end of the previous clause by what we needed to add to match VALUES {
      tempElement['content'] = tempString.slice(0, tempString.length - 7);
      tempElement['end'] = i + start;
      tree.push(tempElement);
      tempString = "";

      tempElement = { w3name: 'DataBlock', suggestInSameLine: true, start: i + start }

    } else if (/UNION \{$/i.test(tempString)) {

      // shorten the end of the previous clause by what we needed to add to match UNION {
      tempElement['content'] = tempString.slice(0, tempString.length - 7);
      tempElement['end'] = i + start - 6;
      tree.push(tempElement);
      tempString = "";

      tempElement = { w3name: 'UnionClause', suggestInSameLine: true, start: i + start }

    } else if (tempString.endsWith('{')) {

      // fast forward recursion
      var depth = 1;
      var subStart = i;
      var subString = "";
      while (depth != 0 && i <= content.length) {
        i++;
        if (content[i] == '}') {
          depth -= 1;
        } else if (content[i] == '{') {
          depth += 1;
        }
        if (depth != 0) {
          subString += content[i];
          tempString += content[i];
        }
      }

      if (tempElement['children']) {
        tempElement['children'] = tempElement['children'].concat(buildQueryTree(subString, subStart));
      } else {
        tempElement['children'] = buildQueryTree(subString, subStart);
      }

    } else if (tempString.endsWith('}') || ((tempElement.w3name == "OrderCondition" || tempElement.w3name == "GroupCondition") && tempString.endsWith('\n'))) {

      // shorten the whereclause by what we needed to add to match the }
      tempElement['content'] = tempString.slice(0, tempString.length - 1);
      tempElement['end'] = i + start - 1;
      tree.push(tempElement);
      tempString = "";

      tempElement = { w3name: 'SolutionModifier', suggestInSameLine: true, start: i + start }

    }

    i++;
  }

  tempElement['content'] = tempString;
  tempElement['end'] = content.length + start;
  tree.push(tempElement);

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

/**
 
Returns the current context
 
@params absPosition - absolute position in text
 
**/
function getCurrentContext(absPosition) {
  var tree = buildQueryTree(editor.getValue(), 0);
  log("\n" + printQueryTree(tree, absPosition, ""), 'parsing');
  return searchTree(tree, absPosition);
}

function getNextContext(absPosition) {
  var tree = buildQueryTree(editor.getValue(), 0);
  var current = searchTree(tree, absPosition);
  for (var i = absPosition; i < editor.getValue().length + 1; i++) {
    var found = searchTree(tree, i);
    if (current != found && found != undefined) {
      console.log('Found ' + found.w3name);
      return found;
    }
  }
  return false;
}

function searchTree(tree, absPosition) {
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
  return undefined;
}

/**
 
Returns the context by its name
 
@params absPosition - absolute position in text
 
**/
function getContextByName(name) {
  var editorContent = editor.getValue()
  var foundContext = undefined;

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
