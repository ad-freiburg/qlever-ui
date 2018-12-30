// Distributed under an MIT license: http://codemirror.net/LICENSE

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
    function addMatches(result, wordlist) {
	    
	    // current line
	    var cursor = editor.getCursor();
	    var line = editor.getLine(cursor.line).slice(0, cursor.ch);
	    var curChar = line[line.length-1];
	    var lineTokens = [];
	    var token = "";
	    
	    // split line by brackets and white spaces
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
	    for (var j = 0; j < lineTokens.length; j++) {
		    var currentTokens = lineTokens.slice(j);
		    var token = "";
		    for (var subToken of currentTokens) {
			    token += subToken.string;
			    if (subToken.endsInWhitespace) {
				    token += " ";
			    }
		    }
		    for (var i = 0; i < wordlist.length; i++) {
		        var word = wordlist[i];
		        if(word.toLowerCase().startsWith(token.toLowerCase()) || token.trim().length < 1){
			        for (var subToken of currentTokens) {
				        if (subToken.endsInWhitespace) {
					        word = word.replace(RegExp(subToken.string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i"), "").replace(/^\s*/, "");
				        }
			        }
		            result.push(word);
		            foundSuggestions = true;
		            j = lineTokens.length;
		        }
	        }
	    }
	    
	    // suggest everything if we didn't find any suggestion and didn't start typing a word
	    if (!foundSuggestions && curChar && curChar.match(/\s/)) {
		    for (var i = 0; i < wordlist.length; i++) {
		        var word = wordlist[i];
		        result.push(word);
	        }
	    }
    }
    
    // eats the string from the right side, returning the index
    // of groups in parentheses or white space
    function getLastLineToken(line) {
	    var fullLength = line.length;
	    line = line.replace(/\s*$/, "");
	    var end = line.length;
	    var start = 0;
	    for(var i = line.length-1; i >= 0; i--) {
		    if (line[i].match(/\s/)) {
			    start = i + 1;
				break;
			}
	    }
		return {start: start, end: end, string: line.slice(start, end), endsInWhitespace: (fullLength != end)}
    }
	
    CodeMirror.registerHelper("hint", "sparql", function(editor, callback, options) {


        // ************************************************************************************
        //
        //
        //                        CORE LOGIC OF QLEVER UI SUGGESTIONS
        //
        //
        // ************************************************************************************

		 // skip everything that is running by now
        window.clearTimeout(sparqlTimeout);
        if(sparqlRequest) { sparqlRequest.abort(); }
		
		// reset the previous loader
		if (activeLine)  {
	        activeLine.html(activeLineNumber);
	    }
    
    
        var cur = editor.getCursor(); // current cursor position
        var absolutePosition = getAbsolutePosition(cur); // absolute cursor position in text
        var context = getCurrentContext(absolutePosition); // get current context
		suggestions = [];
		
		console.log('Starting suggestion');
		console.log('--------------------------');
		console.log('Position: '+absolutePosition);
		if(context){
			console.log('Context: '+context.w3name);
		} else {
			console.log('Context: None');
		}
		
		// get current token
        var line = editor.getLine(cur.line).slice(0, cur.ch);
        var token = getLastLineToken(line);
        var start, end;
        if (token.endsInWhitespace) {
	        start = end = cur.ch;
        } else  {
	        start = token.start;
			end = token.end;
			
        }

        types = getAvailableTypes(context);
        
        
		sparqlCallback = callback;
		sparqlFrom = Pos(cur.line, start);
		sparqlTo = Pos(cur.line, end);
        
        var allTypeSuggestions = [];
		for(var i = 0; i < types.length; i++){
	        allTypeSuggestions = allTypeSuggestions.concat(getTypeSuggestions(types[i], context));
		}
		addMatches(suggestions, allTypeSuggestions);
		
		sparqlCallback({
            list: suggestions,
            from: sparqlFrom,
            to: sparqlTo
        });
        
        return false;
        
    });
    CodeMirror.hint.sparql.async = true;
    
});

 /**
	    
    Find the complex types
    
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


function getDynamicSuggestions(context){
	
	var cur = editor.getCursor();
	var line = editor.getLine(cur.line);	
	var suggestionMode = parseInt($("#dynamicSuggestions").val()+'');
    
    word = editor.getTokenAt(cur);
    var types = [];
    if(word.type){
 	   types = word.type.split(' ');
 	}
    // used tokenizer data to find the current word with its prefix
    if(types.indexOf('prefixed-entity') != -1){
	    if(types.indexOf('entity-name') != -1){
		    word = editor.getTokenAt({ch:word.start-1 ,line: cur.line}).string+word.string;
		} else if(types.indexOf('prefix-name') != -1){
			word = word.string+editor.getTokenAt({ch:word.end+1 ,line: cur.line}).string;
		}
    } else {
	    word = word.string;
    }
     
    // get current line
    var words = line.slice(0,cur.ch).trimLeft().replace('  ', ' ').split(" ");
	    
	// collect prefixes (as string and dict)
    var prefixes = "";
    var prefixesRelation = {};
    var lines = getContextByName('PrefixDecl')['content'].split('\n');

    for (var k = 0; k < lines.length; k++) {
        if (lines[k].trim().startsWith("PREFIX")) {
            var match = /PREFIX (.*): ?<(.*)>/g.exec(lines[k].trim());
            if (match) {
                prefixes += lines[k].trim()+'\n';
                prefixesRelation[match[1]] = match[2];
            }
        }
    }

	var lines = context['content'].split('\n');
	for(var i = 0; i < lines.length; i++){
		if(lines[i] == line){
			lines = lines.slice(0,i);
			break
		}	
	}
	lines = lines.join('\n');

	// TODO: Use only connected triples
	// IDEA: Go through all lines until you see a line that contains a variable you know
	// If this line contains another variable add this to your list of known variables
	// Go through the list again and repeat until all variables / lines are eaten.
	
    // replace the prefixes
    $.each(prefixesRelation,function(key,value){
        newWord = word.replace(key+':',value)
        if(newWord != word){
            word = '<'+newWord+'>';
            return true;
        }
    });
	
    if (words.length < 2) {
        
        var response = [];
        var variables = getVariables(context)
        for(var i = 0; i < variables.length; i++){
	        response.push(variables[i]+' ');
        }
        return response;
        
    } else if (words.length == 2 && suggestionMode > 0) {
        
        if (suggestionMode == 1) {
        
        	// Build SPARQL query without context
            sparqlQuery = prefixes +
                "\nSELECT ?qleverui_predicate WHERE {" +
                "\n  ?qleverui_predicate ql:entity-type ql:predicate .";
            if (word.length > 1) {
                sparqlQuery += "\n  FILTER regex(?qleverui_predicate, \"^" + word + "\")";
            }
            if (SCOREPREDICATE.length > 0) {
                sparqlQuery += "\n  ?qleverui_predicate " + SCOREPREDICATE + " ?qleverui_score ." +
                    "\n}\nORDER BY DESC(?qleverui_score)";
            } else {
                sparqlQuery += "\n}";
            }
        
        } else if (suggestionMode == 2) {
                            
			// Build SPARQL query with context
            lines += "\n"+words[0] + " ql:has-predicate ?qleverui_predicate .";
            sparqlQuery = prefixes +
                "\nSELECT ?qleverui_predicate (COUNT(?qleverui_predicate) as ?count) WHERE {" +
                lines +
                "\n}\nGROUP BY ?qleverui_predicate" +
                "\nORDER BY DESC(?count)";
            if (word.length > 1) {
                sparqlQuery += "\nHAVING regex(?qleverui_predicate, \"^" + word + "\")";
            }
        }
        
        getQleverSuggestions(sparqlQuery,prefixesRelation,' ');
        if(!requestExtension){
			return ['ql:contains-entity ','ql:contains-word '];
		} else {
			return [];
		}
    }

    if (words.length == 3 && suggestionMode > 0) {

        if (suggestionMode == 1) {
	        
        	// Build SPARQL query without context
            sparqlQuery = prefixes +
                "\nSELECT ?qleverui_object WHERE {\n  " +
                "?qleverui_object ql:entity-type ql:object .";
            if (word.length > 1) {
                sparqlQuery += "\n  FILTER regex(?qleverui_object, \"^" + word + "\")";
            }
            if (SCOREPREDICATE.length > 0) {
                sparqlQuery += "\n  ?qleverui_object " + SCOREPREDICATE + " ?qleverui_score ." +
                    "\n}\nORDER BY DESC(?qleverui_score)";
            } else {
                sparqlQuery += "\n}";
            }
            
        } else if (suggestionMode == 2) {
	        
			// Build SPARQL query with context
            lines += "\n"+words[0] + " " + words[1] + " ?qleverui_object .";
            sparqlQuery = prefixes +
                "\nSELECT ?qleverui_object WHERE {\n  " +
                lines;
            if (word.length > 1) {
                sparqlQuery += "\n  FILTER regex(?qleverui_object, \"^" + word + "\")";
            }
            sparqlQuery += "\n}";
            sparqlQuery += "\nGROUP BY ?qleverui_object";
            sparqlQuery += "\nORDER BY DESC((COUNT(?qleverui_object) AS ?count))";
        }
        
        var response = [];
        var variables = getVariables(context)
        for(var i = 0; i < variables.length; i++){
	        response.push(variables[i]+' .');
        }
        
        getQleverSuggestions(sparqlQuery,prefixesRelation,' .');
        if(!requestExtension){
			return response;
		} else {
			return [];
		}
    }
    
    console.warn('Skipping every suggestions based on current position...');
    return [];

}


function getQleverSuggestions(sparqlQuery,prefixesRelation,appendix){
	
	try {
        
        // show the loading indicator and badge
        activeLineBadgeLine = $('.CodeMirror-activeline-background');
        activeLine = $('.CodeMirror-activeline-gutter .CodeMirror-gutter-elt');
        activeLineNumber = activeLine.html();
        activeLine.html('<img src="/static/img/ajax-loader.gif">');
        $('#aBadge').remove();
        
        // do the limits for the scrolling feature
        sparqlQuery += "\nLIMIT " + size + "\nOFFSET " + lastSize;

        console.info('Getting suggestions from QLever:');
        console.log(sparqlQuery);
        
        lastUrl = BASEURL + "?query=" + encodeURIComponent(sparqlQuery);
        var dynamicSuggestions = [];
        
        sparqlTimeout = window.setTimeout(function(){
	         
		    sparqlRequest = $.ajax({ url: lastUrl }).done(function(data) {
		                
		        try {
		        	data = $.parseJSON(data);
		        } catch(err) {}
		        
		        console.log("Got suggestions from QLever.");
		        console.log("Query took " + data.time.total + ".");
		
		        if(data.res){
		            for (var result of data.res) {
		                
		                // add back the prefixes
		                for (prefix in prefixesRelation) {
		                    if (result[0].indexOf(prefixesRelation[prefix]) > 0) {
		                        result[0] = result[0].replace("<" + prefixesRelation[prefix], prefix + ':').slice(0, -1);
		                    }
		                }
		                
		                dynamicSuggestions.push(result[0]+appendix);
		            }
		            
		        } else {
		            console.error(data.exception);
		        }
		        
		        // reset loading indicator
		        activeLine.html(activeLineNumber);
		        $('#aBadge').remove();
		        
		        // add badge
		        if (data.resultsize != undefined && data.resultsize != null) {
			        resultSize = data.resultsize;
		            activeLineBadgeLine.prepend('<span class="badge badge-success pull-right" id="aBadge">' + data.resultsize + '</span>');
		        }
		        
		        sparqlCallback({
		            list: suggestions.concat(dynamicSuggestions),
		            from: sparqlFrom,
		            to: sparqlTo
		        });
		        
		        return []
		        
		    }).fail(function(e) {
			
				console.log(e);
		        // things went terribly wrong...
		        console.error('Failed to load suggestions from QLever (step 2)', e);
		        activeLine.html('<i class="glyphicon glyphicon-remove" style="color:red;">');
		
		    });
        
    }, 500);
        
    } catch (err) {
        activeLine.html(activeLineNumber);
        return [];
    }
}


/**
   
   Returns the suggestions defined for a given complex type
    
**/
function getTypeSuggestions(type, context){
    
    typeSuggestions = []
    
    if(type.onlyOnce == true){
	    
	    // get content to test with
		if(!context || type.availableInContext.length > 1){
			var content = editor.getValue();
		} else {
			var content = context['content'];
	    }
	    
	    if(type.definition){
		    type.definition.lastIndex = 0;
		    var match = type.definition.exec(content);
		    
		    // this should occur only once and is already found once
			if(match && match.length > 1){
				return [];
			}
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
				    dynString += '{['+placeholders.length+']}';
				    placeholders.push(suggestion[j]);
				}
		    } else if(typeof suggestion[j] == 'function'){
			    if(suggestion[j] && suggestion[j].length > 0){
				    dynString += '{['+placeholders.length+']}';
				    placeholders.push(suggestion[j](context));
				}
		    } else {
			    dynString += suggestion[j]
			}
			
		}
		
		// no multiplying placeholders - simply use the string with no value
		if(placeholders.length == 0){
			typeSuggestions.push(dynString);
		} else if(placeholders[0].length != 0 && placeholders[0] != false){
			// mulitply the suggestiony by placeholders
			tempStrings = [];
			for(var k = 0; k < placeholders.length; k++){
				// there are no valid values for this placeholder. Skip.
				if(placeholders[k].length != 0 && placeholders[k] != false)	{
					// multiply by each valid value for each placeholder
					newTempStrings = $.extend([],tempStrings);
					tempStrings = [];
					for(var l = 0; l < placeholders[k].length; l++){
						if(k == 0){
							// first iteration is different
							placeholders[k][l] = ''+placeholders[k][l];
							var replacement = dynString.replace('{['+k+']}',placeholders[k][l]).replace('{['+k+']}',(placeholders[k][l]).replace('?',''));
							tempStrings.push(replacement);
						} else {
							// second iteration mulitplies the solutions already found
							for(var m = 0; m < newTempStrings.length; m++){
								placeholders[k][l] = ''+placeholders[k][l];
								var replacement = newTempStrings[m].replace('{['+k+']}',placeholders[k][l]).replace('{['+k+']}',(placeholders[k][l]).replace('?',''));
								tempStrings.push(replacement);
							}
						}
					}
				} else {
					tempStrings = [];
				}
			}
			
			$.extend(typeSuggestions,tempStrings);
		
		}
	}
		
	if(type.onlyOncePerVariation != false){

		// get content to test with
		content = "";
		if(context){ content = context['content'] }
		
		// ignore DISTINCT keywords when detecting duplicates
		content = editor.getValue().replace(/DISTINCT /g,'');

		var tempSuggestions = $.extend([],typeSuggestions);
		typeSuggestions = [];
		// check if this combination is already in use in this context
		for(var i = 0; i < tempSuggestions.length; i++){
			if(content.indexOf(tempSuggestions[i].replace('DISTINCT ','')) == -1){
				typeSuggestions.push(tempSuggestions[i]);
			}
		}	

	}
	
	return typeSuggestions;

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
    var editorContent = $.trim(editor.getValue());
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
    
    if(foundContext == undefined && absPosition > editorContent.length){
		foundContext = getContextByName('SolutionModifier');
	}
    
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
function getVariables(context, excludeAggregationVariables, suggestListOfAllUnusedVariables){
        
    var variables = [];
    
    filter = '.CodeMirror .cm-variable';
	if(excludeAggregationVariables){
    	filter = ".CodeMirror .cm-variable:not('.cm-aggregate-variable')";
    }
    
    // get the variables
    $(filter).each(function(key,variable){
		if(variables.indexOf(variable.innerHTML) == -1 && variable.innerHTML.length > 1){
		    variables.push(variable.innerHTML);
		}
    });
		
	if(suggestListOfAllUnusedVariables && variables.length > 1){
		// remove duplicates
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
	    $(COLLECTEDPREFIXES).each(function(key,prefix){
		    if(testAgainst.indexOf(prefix) != -1){
				return true;
		    }
		    prefixes.push(prefix);
	    });
	    
	} else {
		var prefixes = $.extend([],COLLECTEDPREFIXES);	
	}
    
    return prefixes;   
}