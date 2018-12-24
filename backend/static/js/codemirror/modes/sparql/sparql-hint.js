// Distributed under an MIT license: http://codemirror.net/LICENSE

var lastUrl; // remark url for autocomplete call
var requestExtension = false; // append autocompletion or create new widget
var lastSize = 0; // size of last auto completion call (increases over the time)
var size = 40; // size for next auto completion call
var resultSize = 0; // result size for counter badge
var lastWidget = undefined; // last auto completion widget instance

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
        mod(require("../../lib/codemirror"), require("../../mode/sparql/sparql"));
    else if (typeof define == "function" && define.amd) // AMD
        define(["../../lib/codemirror", "../../mode/sparql/sparql"], mod);
    else // Plain browser env
        mod(CodeMirror);
})(function(CodeMirror) {
    "use strict";


    var timeoutCompletion; // holds the window.timeout of the completion - needed to stop requests
    var sparqlQuery; // holds the sparql query that is executed
    var activeLine; // the current active line that holds loader / counter badge
    var activeLineBadgeLine; // the bade holder in the current active line
    var activeLineNumber; // the line number of the active line (replaced by loader)

    var suggestions; // language keywords

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
    function addMatches(result, wordlist, formatter) {
		var token = editor.getTokenAt(editor.getCursor(), true)

        for (var i = 0; i < wordlist.length; i++) {
	        var word = formatter(wordlist[i]);
	        if(word.toLowerCase().indexOf(token.string.toLowerCase()) != -1 || token.string.length < 2){
	            result.push(word);
	        }
        }
    }
	
    CodeMirror.registerHelper("hint", "sparql", function(editor, callback, options) {


        // ************************************************************************************
        //
        //
        //                        CORE LOGIC OF QLEVER UI SUGGESTIONS
        //
        //
        // ************************************************************************************

		var suggestions = [];

        var cur = editor.getCursor(); // current cursor position
        var absolutePosition = getAbsolutePosition(cur); // absolute cursor position in text
        var context = getCurrentContext(absolutePosition); // get current context

		console.log('Starting suggestion');
		console.log('--------------------------');
		console.log('Position: '+absolutePosition);
		if(context){
			console.log('Context: '+context.w3name);
		} else {
			console.log('Context: None');
		}
		
		// get current token
        var token = editor.getTokenAt(cur, true),
            start, end, search;
        if (token.end > cur.ch) {
            token.end = cur.ch;
            token.string = token.string.slice(0, cur.ch - token.start);
        }

		// parse prefixes (reals ones and ql: prefixes)
        var prefixName = '';
        if (token.string.match(/^[?!.`"\w<_:@-]*$/)) {
            search = token.string.split(':');
            if (search.length > 1 && search[0] != 'ql') {
                prefixName = search[0] + ':';
            }
            search = search[search.length - 1];
            start = token.start;
            end = token.end;
        } else {
            start = end = cur.ch;
            search = "";
        }




        types = getAvailableTypes(context);
         
		for(var i = 0; i < types.length; i++){
	        addMatches(suggestions, getTypeSuggestions(types[i], context), identity);
		}
			
		callback({
            list: suggestions,
            from: Pos(cur.line, start),
            to: Pos(cur.line, end)
        });
        
        return false;
        
        
        
        
        

		/*****************
		/  WhereClause
		*****************/
        if(context.w3name == 'WhereClause'){

                // detect line position (subj / predicate / object)
                var j = cur.ch;
                while (j < line.length) {
                    if (line.charAt(j) != " ") { j++; } else { break; }
                }

                var k = cur.ch;
                while (k >= 0) {
                    if (line.charAt(k) != " ") { k--; } else { break; }
                }

                word = editor.getRange({ 'line': cur.line, 'ch': k + 1 }, 
                	{ 'line': cur.line, 'ch': j
                });
                
                // TODO: the sample above could be replaced by using the
                // token variable as long as soon as the tokenizer knows
                // that prefixes are part of words.
                 
                var words = line.trimLeft().replace('  ', ' ').split(" ");

				// do not suggest anything behind the "."
                if (words.length < 4) {
	                
                    // detect full query parameters
                    re = new RegExp(/WHERE \{([\s\S\n\w]*)}/g, 'g');
                    match = re.exec(content);

                    // things that are only relevant if WHERE clause exists
                    if (match != null && match[1]) {

                        var clause = match[1].trim().split('\n');

                        var skipLines = 0;
                        var prefixes = "";
                        var prefixesRelation = {};
                        var countEmptyLines = true;
                        var lines = editor.getValue().split('\n');
                        var suggestionMode = document.getElementById("dynamicSuggestions").value;

                        for (var k = 0; k < lines.length; k++) {
                            if (lines[k].trim().startsWith("PREFIX")) {
                                skipLines++;
                                prefixes += lines[k].trim();

                                var prefixesRegex = /PREFIX (.*): ?<(.*)>/g;
                                var match = prefixesRegex.exec(lines[k].trim());
                                if (match) {
                                    prefixesRelation[match[1]] = match[2];
                                }
                            }
                            if (lines[k].trim().startsWith("SELECT")) {
                                skipLines++;
                                countEmptyLines = false;
                            }
                            if (countEmptyLines == true && lines[k].trim() == "") {
                                skipLines++;
                            }
                        }
                        var cursorLine = cur.line - skipLines;

                        if (clause.length > cursorLine) {
                            if (clause[cursorLine]) {
                                var parameters = clause[cursorLine].trim().split(' ');
                            }
                            clause = clause.slice(0, cursorLine);

                            if (search.indexOf('<') != 0 && search.indexOf('"') != 0) {
                                search = "<" + search;
                            }

                            var searchEnd = search.slice(0, -1) + String.fromCharCode(search.charCodeAt(search.length - 1) + 1);

                            if (words.length > 0 && words[0] == word) {
                                parameter = 'subject';
                            }

                            if (words.length > 1 && words[1].trim() == word) {
                                parameter = 'predicate';
                                var variables = false;


                                if (suggestionMode == 1) {
                                    sparqlQuery = prefixes +
                                        "\nSELECT ?qleverui_predicate WHERE {" +
                                        "\n  ?qleverui_predicate ql:entity-type ql:predicate .";
                                    if (search != undefined && search.length > 1) {
                                        sparqlQuery += "\n  FILTER regex(?qleverui_predicate, \"^" + search + "\")";
                                    }
                                    if (scorePredicate.length > 0) {
                                        sparqlQuery += "\n  ?qleverui_predicate " + scorePredicate + " ?qleverui_score ." +
                                            "\n}\nORDER BY DESC(?qleverui_score)";
                                    } else {
                                        sparqlQuery += "\n}";
                                    }
                                } else if (suggestionMode == 2) {
                                    parameter = 'has-predicate';
                                    var subject = parameters[0];

                                    /* remove unrelated constraints */
                                    /*var connected = false;
                                    for(var i = 0; i < clause.length; i++){
                                        if(clause.indexOf(subject) != -1){
                                            connected = true;
                                            break;
                                        }
                                    }

                                    if(connected == false){
                                        clause = [];
                                    }*/

                                    clause[cursorLine] = subject + " ql:has-predicate ?qleverui_predicate .";
                                    sparqlQuery = prefixes +
                                        "\nSELECT ?qleverui_predicate (COUNT(?qleverui_predicate) as ?count) WHERE {\n  " +
                                        clause.join('\n  ') +
                                        "\n}\nGROUP BY ?qleverui_predicate" +
                                        "\nORDER BY DESC(?count)";
                                    if (search != undefined && search.length > 1) {
                                        sparqlQuery += "\n  HAVING regex(?qleverui_predicate, \"^" + search + "\")";
                                    }
                                }
                            }

                            if (words.length > 2 && words[2] == word) {
                                parameter = 'object';
                                if (suggestionMode == 1) {
                                    sparqlQuery = prefixes +
                                        "\nSELECT ?qleverui_object WHERE {\n  " +
                                        "?qleverui_object ql:entity-type ql:object .";
                                    if (search != undefined && search.length > 1) {
                                        sparqlQuery += "\n  FILTER regex(?qleverui_object, \"^" + search + "\")";
                                    }
                                    if (scorePredicate.length > 0) {
                                        sparqlQuery += "\n  ?qleverui_object " + scorePredicate + " ?qleverui_score ." +
                                            "\n}\nORDER BY DESC(?qleverui_score)";
                                    } else {
                                        sparqlQuery += "\n}";
                                    }
                                } else if (suggestionMode == 2) {
                                    var subject = parameters[0];
                                    var predicate = parameters[1];
                                    clause[cursorLine] = subject + " " + predicate + " ?qleverui_object .";
                                    sparqlQuery = prefixes +
                                        "\nSELECT ?qleverui_object WHERE {\n  " +
                                        clause.join('\n  ');
                                    if (search != undefined && search.length > 1) {
                                        sparqlQuery += "\n  FILTER regex(?qleverui_object, \"^" + search + "\")";
                                    }
                                    sparqlQuery += "\n}";
                                    sparqlQuery += "\nGROUP BY ?qleverui_object";
                                    sparqlQuery += "\nORDER BY DESC((COUNT(?qleverui_object) AS ?count))";
                                }
                            }

                        } else {
                            parameter = 'subject';
                        }

                    }

                    keywords = [];
                    if (parameter == 'predicate' || parameter == 'has-predicate') {
                        keywords = ['ql:contains-entity ', 'ql:contains-word '];
                    }

                } else {
                    console.warn('Skipping every suggestions based on current position...')
                    return false;
                }
        } else {
            keywords.push("WHERE {\n}");
        }

        ////////////////////////////////////////////////////////////////////////
        //
        // Detection of contexts is done by reaching this line.
        // Starting here we will evaluate the suggestions based
        // on our detection
        //
        ////////////////////////////////////////////////////////////////////////

        var result = [];

        ////////////////////////////////////////////
        // add the variables if activated
        ////////////////////////////////////////////

        if (variables != false && !requestExtension) {
            // Add suggestions for variables starting with ?
            var word = options && options.word || /\?[\w\d]+/g;
            var range = options && options.range || 500;
            var cur = editor.getCursor(),
                curLine = editor.getLine(cur.line);

            while (end < curLine.length && word.test(curLine.charAt(end))) ++end;
            while (start && word.test(curLine.charAt(start - 1))) --start;
            var curWord = start != end && curLine.slice(start, end);

            var list = [],
                seen = {},
                list2 = [];

            if (mode == 'params' && parameter == 'object') {
                var variableCandidate = curLine.trim().split(/[\s,.\-\/:]+/).slice(-1)[0].replace('>', '').replace('<', '').replace('?', '');
                if (variableCandidate != '<' && variableCandidate != '') {
                    seen['?' + variableCandidate.toLowerCase()] = true;
                    list.push('?' + variableCandidate.toLowerCase() + ' .');
                }
            }

            var prefix = '';

            function scan(dir) {
                var line = cur.line,
                    end = Math.min(Math.max(line + dir * range, editor.firstLine()), editor.lastLine()) + dir;
                for (; line != end; line += dir) {
                    var text = editor.getLine(line),
                        m;
                    var testPrefix = /((PREFIX (.*))(<.+>))/g.exec(text)
                    if (testPrefix) {
                        prefix = testPrefix[4];
                    }
                    word.lastIndex = 0;
                    while (m = word.exec(text)) {
                        if ((!curWord || m[0].indexOf(curWord) == 0) && !seen.hasOwnProperty(m[0])) {
                            seen[m[0]] = true;
                            if (mode == 'values' && lastCharEmpty) {
                                re = new RegExp("\\" + m[0] + " ql:contains-", 'g');
                                match = re.exec(content)
                                if (match != null) {
                                    // space after variables only if not in brackets
                                    var l = editor.getLine(cur.line);
                                    list2.push('SCORE(' + m[0].trim() + ')');
                                    list2.push('TEXT(' + m[0].trim() + ')');
                                }
                                list2.push('(COUNT(' + m[0].trim() + ') AS )');
                                list2.push('(SAMPLE(' + m[0].trim() + ') AS )');
                                list2.push('(MIN(' + m[0].trim() + ') AS )');
                                list2.push('(MAX(' + m[0].trim() + ') AS )');
                                list2.push('(AVG(' + m[0].trim() + ') AS )');
                                list2.push('(GROUP_CONCAT(' + m[0].trim() + ';separator=",") AS )');
                            }
                            if (mode == 'order') {
                                re = new RegExp("\\" + m[0] + " ql:contains-", 'g');
                                match = re.exec(content)
                                if (match != null) {
                                    list.push('SCORE(' + m[0].trim() + ')');
                                }
                            }
                            if (mode == 'group') {
                                list.push(m[0].trim() + "\n");
                            }
                            if (mode == 'params' && parameter == 'object') {
                                list.push(m[0].trim() + " .");
                            } else if (mode != 'group') {
                                // space after variables only if not in brackets
                                var l = editor.getLine(cur.line);
                                if (l[cur.ch - 1] == "(" || l[cur.ch] == ' ') {
                                    list.push(m[0].trim());
                                } else {
                                    list.push(m[0].trim() + " ");
                                }
                            }
                        }
                    }
                }
            }
            scan(-1);
            scan(1);
        }

        ////////////////////////////////////////////
        // DYNAMIC (backend) suggestions follow here
        ////////////////////////////////////////////

        // reset loading indicator
        if (activeLine)  {
            activeLine.html(activeLineNumber);
        }
        if (document.getElementById("dynamicSuggestions").value > 0) {
            try {
                // add a little delay for reducing useless queries
                window.clearTimeout(timeoutCompletion);
                timeoutCompletion = window.setTimeout(function(search, prefix, mode, parameter, result) {
                    var result2 = JSON.parse(JSON.stringify(result));

                    if (mode != 'params' || mode == 'params' && parameter == undefined || parameter == 'subject') {
                        return true;
                    }

                    // show the loading indicator
                    activeLineBadgeLine = $('.CodeMirror-activeline-background');
                    activeLine = $('.CodeMirror-activeline-gutter .CodeMirror-gutter-elt');
                    activeLineNumber = activeLine.html();
                    activeLine.html('<img src="/static/img/ajax-loader.gif">');
                    $('#aBadge').remove();
                    if (document.getElementById("dynamicSuggestions").value > 0) {

                        if (sparqlQuery != undefined && mode == 'params' && (parameter == 'object' || parameter == 'predicate' || parameter == 'has-predicate')) {

                            sparqlQuery += "\nLIMIT " + size + "\nOFFSET " + lastSize;

                            console.log('Getting suggestions from QLever:');
                            console.log(sparqlQuery);
                            lastUrl = BASEURL + "?query=" + encodeURIComponent(sparqlQuery);
                            $.ajax({
                                url: lastUrl,
                                search: search,
                                result2: result2,
                            }).done(function(data) {
	                            try {
	                            	data = $.parseJSON(data);
	                            } catch(err) {}
                                console.log("Got suggestions from QLever.");
                                console.log("Query took " + data.time.total + ".");

                                resultSize = data.resultsize;

                                var suggestions = [];
                                if(data.res){
	                                for (var result of data.res) {
	                                    suggestions.push(result[0]);
	                                }
                                } else {
	                                console.error(data.exception);
                                }
                                addMatches(result2, search, suggestions, function(w) {

                                    for (prefix in prefixesRelation) {
                                        if (w.indexOf(prefixesRelation[prefix]) > 0) {
                                            w = w.replace("<" + prefixesRelation[prefix], prefix + ':').slice(0, -1);
                                        }
                                    }

                                    if (w.length > 0) {
                                        if (parameter == 'object') {
                                            return w + " .";
                                        }
                                        return w + " ";
                                    }
                                });

                                console.log("Showing hints popup.");
                                callback({
                                    list: result2,
                                    from: Pos(cur.line, start + prefixName.length),
                                    to: Pos(cur.line, end)
                                });

                                // reset loading indicator
                                console.log("Resetting load indicator & showing badge.");
                                activeLine.html(activeLineNumber);
                                $('#aBadge').remove();
                                if (resultSize != undefined && resultSize != null) {
                                    activeLineBadgeLine.prepend('<span class="badge badge-success pull-right" id="aBadge">' + resultSize + '</span>');
                                }

                            }).fail(function(e) {

                                // things went terribly wrong...
                                console.error('Failed to load suggestions from QLever (step 2)', e);
                                activeLine.html('<i class="glyphicon glyphicon-remove" style="color:red;">');

                            });

                        } else {
                            console.warn('Skipping step 2 suggestions based on current position...')
                        }
                    }

                }, 500, search, prefix, mode, parameter, result);
            } catch (err) {
                console.error(err);
                activeLine.html(activeLineNumber);
            }

        }

        ////////////////////////////////////////////
        // It's over, it's done ...
        ////////////////////////////////////////////

    });
    CodeMirror.hint.sparql.async = true;
    
});

 /**
	    
    Find the complex types that still have the chance to match
	https://stackoverflow.com/questions/22483214/regex-check-if-input-still-has-chances-to-become-matching/22489941#22489941
    
    @params context - the current context
    
**/
function getAvailableTypes(context){
    types = [];
    
    contextName = "undefined";
    if(context){
	    contextName = context.w3name;
    }
    
    // check for complex types that are valid in this context
	for(var i = 0; i < COMPLEXTYPES.length; i++){
		if(COMPLEXTYPES[i].availableInContext.indexOf(contextName) != -1){
			types.push(COMPLEXTYPES[i]);
		}
	}
	
	return types;
}

/**
   
   Returns the suggestions defined for a given complex type
    
**/
function getTypeSuggestions(type, context){
    
    suggestions = []
    
    if(type.onlyOnce){
	    
	    // get content to test with
		content = "";
		if(context){
			content = context['content']
		}
		content = editor.getValue();
	    
	    type.definition.lastIndex = 0;
	    var match = type.definition.exec(content);
	    
	    // this should occur only once and is already found once
		if(match && match.length > 1){
			return [];
		}
    }
    
    for(var i = 0; i < type.suggestions.length; i++){
		
	    var suggestion = type.suggestions[i];
	    var dynString = "";
		var placeholders = [];
	    
	    // evaluate placeholders in definition
	    for(var j = 0; j < suggestion.length; j++){
		    
			// concat dyn string
			if(typeof suggestion[j] == 'object'){
			    if(suggestion[j] && suggestion[j].length > 0){
				    dynString += '{{'+placeholders.length+'}}';
				    placeholders.push(suggestion[j]);
				}
		    } else if(typeof suggestion[j] == 'function'){
			    if(suggestion[j] && suggestion[j].length > 0){
				    dynString += '{{'+placeholders.length+'}}';
				    placeholders.push(suggestion[j](context));
				}
		    } else {
			    dynString += suggestion[j]
			}
			
		}
		
		// no multiplying placeholders - simply use the string with no value
		if(placeholders.length == 0){
			suggestions.push(dynString);
		} else if(placeholders[0].length != 0 && placeholders[0] != false){
			// mulitply the suggestiony by placeholders
			tempStrings = [];
			for(var k = 0; k < placeholders.length; k++){
				// there are no valid values for this placeholder. Skip.
				if(placeholders[k].length != 0 && placeholders[k] != false)	{
					// multiply by each valid value for each placeholder
					for(var l = 0; l < placeholders[k].length; l++){
						if(k == 0){
							// first iteration is different
							tempStrings.push(dynString.replace('{{'+k+'}}',placeholders[k][l]));
						} else {
							// second iteration mulitplies the solutions already found
							newTempStrings = $.extend([],tempStrings);
							tempStrings = [];
							for(var m = 0; m < newTempStrings.length; m++){
								tempStrings.push(newTempStrings[m].replace('{{'+k+'}}',placeholders[k][l]));
							}
						}
					}
				} else {
					tempStrings = [];
				}
			}
			
			$.extend(suggestions,tempStrings);
		
		}
	}
	
	if(type.onlyOncePerVariation){

		// get content to test with
		content = "";
		if(context){
			content = context['content']
		}
		content = editor.getValue();

		var tempSuggestions = $.extend([],suggestions);
		suggestions = [];
		// check if this combination is already in use in this context
		for(var i = 0; i < tempSuggestions.length; i++){
			if(content.indexOf(tempSuggestions[i]) == -1){
				suggestions.push(tempSuggestions[i]);
			}
		}	

	}
	return suggestions;

}

/**
   
   Returns absolute cursor position inside editor.getValue()
   
   @params cur - position object of current position
    
**/
function getAbsolutePosition(cur){
    var absolutePosition = 0;
    $('.CodeMirror-line').each(function(i) {
        if (i < cur.line) {
            // count line breaks as chars
            absolutePosition += $(this).text().length+1;
        } else {
            absolutePosition += cur.ch;
            return false;
        }
    });
    return absolutePosition;
}

/**
   
   Returns the current context
   
   @params absPosition - absolute position in text
    
**/    
function getCurrentContext(absPosition){
    var editorContent = editor.getValue()
    var foundContext = undefined;
    
    $(CONTEXTS).each(function(index,context){
	    
	    context.definition.lastIndex = 0;
	    var match = context.definition.exec(editorContent);
	    
		if(match && match.length > 1){
		    
		    // we are inside the outer match of the whole context group
		    if(absPosition >= match.index && absPosition <= match.index+match[0].length){
			   foundContext = context;
			   foundContext['start'] = match.index;
			   foundContext['end'] = match.index+match[0].length;
			   foundContext['content'] = getValueOfContext(context);
			   return false;
		    }
		}
    });
    
    return foundContext;
}

/**
   
   Returns the context by its name
   
   @params absPosition - absolute position in text
    
**/    
function getContextByName(name){
    var editorContent = editor.getValue()
    var foundContext = undefined;
    
    $(CONTEXTS).each(function(index,context){
	    
	    if(context.w3name == name){
		    
		    context.definition.lastIndex = 0;
		    var match = context.definition.exec(editorContent);
		    
			if(match && match.length > 1){
			    
				foundContext = context;
				foundContext['start'] = match.index;
				foundContext['end'] = match.index+match[0].length;
				foundContext['content'] = getValueOfContext(context);
				return false;
				
			}
		}
		
    });
    
    return foundContext;
}

/**
   
   Returns the value of the given context
   
   @params context - the current context
   
   		- Excludes duplicate definitions if told to do so
    
**/
function getValueOfContext(context){
    var editorContent = editor.getValue();
	
	context.definition.lastIndex = 0;
    var relevantPart = context.definition.exec(editorContent);
    
    if(relevantPart.length > 1){
	    return relevantPart[1];
    }
    return "";
}

/**
   
   Returns prefixes to suggest
   
   @params context - the current context
   @params allowDuplicatesInContext - allow variables to be suggested when they are already set
   @params suggestListOfAllUnusedVariables - generate a list with all variables in it
   
   		- Excludes duplicate definitions if told to do so
   		- Add list with all unused variables as one suggestion
    
**/
function getVariables(context, suggestListOfAllUnusedVariables){
        
    var variables = [];
    
    
    // get the variables
    $('.CodeMirror .cm-variable').each(function(key,variable){
	    
	    if(variables.indexOf(variable.innerHTML) == -1){
		    variables.push(variable.innerHTML);
		}

    });
		
	if(suggestListOfAllUnusedVariables && variables.length > 1){
		variables.push(variables.join(' '));
	}
	
	return variables;
}

/**
   
   Returns prefixes to suggest
   
   @params context - the prefix context
   
   		- Excludes duplicate definitions 
    
**/
function getPrefixSuggestions(context){
    
    if(context){
	    
    	var prefixes = []

	    // get content of current context
	    var testAgainst = context['content'];
	    
	    // get the prefixes
	    $(collectedPrefixes).each(function(prefix){
		    
		    if(testAgainst.indexOf(prefix) != -1){
				return true;
		    }
		    
		    prefixes.push(prefix);
	    });
	    
	} else {
		
		var prefixes = collectedPrefixes;
		
	}
    
    return prefixes;   
    
}

function identity(x){
	return x
}