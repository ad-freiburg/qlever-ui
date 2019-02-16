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
    function addMatches(result, addedSuggestions, context) {
	    log('Found  '+addedSuggestions.length+' suggestions for this position','suggestions');
	    // current line
	    var cursor = editor.getCursor();
	    var line = editor.getLine(cursor.line).slice(0, cursor.ch);
	    var curChar = line[line.length-1];
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
		        if(type.requiresEmptyLine == true && (fullLineContent != "" && !word.startsWith(fullLineContent))){
			        continue;
		        }
				
				// check if the type already exists
				if(type.onlyOnce == true){
				    // get content to test with
				    var content = (context) ? context['content'] : editor.getValue();
				    
				    if(type.definition){
					    type.definition.lastIndex = 0;
					    var match = content.match(type.definition) || [];
						alreadyExists = match.length;
					}
			    }
			    
		        if (j == 0 && type.suggestOnlyWhenMatch != true && alreadyExists == 0) {
				    allSuggestions.push(suggestion.word);
		        }
		        
		        if(word.toLowerCase().startsWith(token.toLowerCase()) && token.trim().length > 0 && word != token){
			    	    
			        // if the type already exists but it is within the token we just typed: continue suggesting it
			        // if it is outside of what we typed: don't suggest it
			        if (alreadyExists == 1){
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
			log('Could not determine any limits - showing all suggestions','suggestions');
		    if((context && context.suggestInSameLine == true) || line == undefined || line.match(/^\s+$/)){
			    for (var suggestion of allSuggestions) {
				    result.push(suggestion);
			    }
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
		
		log('Position: '+absolutePosition,'suggestions');
		if(context){
			log('Context: '+context.w3name,'suggestions');
		} else {
			log('Context: None','suggestions');
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
			for (var suggestion of getTypeSuggestions(types[i], context)) {
				if(context && context.forceLineBreak && !suggestion.endsWith('\n')){
					suggestion += "\n";
				}
				allTypeSuggestions.push({word: suggestion, type: i});
			}
		}
		
		addMatches(suggestions, allTypeSuggestions, context);

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
    
    word = getLastLineToken(line.slice(0,cur.ch));
    if(word.endsInWhitespace){ word = ""; } else { word = word.string; }
    
    // get current line
    var words = line.slice(0,cur.ch).trimLeft().replace('  ', ' ').split(" ");
	    
	// collect prefixes (as string and dict)
    var prefixes = "";
    var prefixesRelation = {};
    var lines = getPrefixLines();

    for (var prefLine of lines) {
        if (prefLine.trim().startsWith("PREFIX")) {
            var match = /PREFIX (.*): ?<(.*)>/g.exec(prefLine.trim());
            if (match) {
                prefixes += prefLine.trim()+'\n';
                prefixesRelation[match[1]] = match[2];
            }
        }
    }
	
	var lines = context['content'].split('\n');
	for(var i = 0; i < lines.length; i++){
		if(lines[i] == line){
			lines.splice(i,1);
			break
		}	
	}
	
    // replace the prefixes
    var replacedRelations = false;
    $.each(prefixesRelation,function(key,value){
        newWord = word.replace(key+':',value)
        if(newWord != word){
            word = '<'+newWord;
            replacedRelations = true;
            return true;
        }
    });
	
    if (words.length < 1) {
        
        var response = [];
        var variables = getVariables(context, undefined, "both");
        for(var i = 0; i < variables.length; i++){
	        response.push(variables[i]+' ');
        }
        return response;
        
    } else {
	    
	    // find connected lines in given select clause
		variableRegex = /(\?.+?)\s/g
		variable = line.match(variableRegex);
		if(variable){
			// at first we know only the variable in our current line
			var seenVariables = [variable];
			// and do not use any other lines
			var linesTaken = [];
			// for each line
			for(var i = 0; i < lines.length; i++){
				// check for each already seen variable
				for(var j = 0; j < seenVariables.length; j++){
					// if the variable occurs in this line and the line is not taken alread
					if(linesTaken.indexOf(lines[i]) == -1 && lines[i].indexOf(seenVariables[j]) != -1){
						linesTaken.push(lines[i]);
						var allLineVariables = variableRegex.exec(lines[i]);
						// search for variables
						while(allLineVariables != null){
							for(var k = 0; k < allLineVariables.length; k++){
								// if not take all new variables to the list
								if(seenVariables.indexOf(allLineVariables[1]) == -1){
									// take the variable and the line because they are connected
									seenVariables.push(allLineVariables[1]);
									// restart because the seen variable list changed
									i = 0;
								}
							}
							allLineVariables = variableRegex.exec(lines[i]);
						}
					}
				}
			}
			lines = [];
			for (var line of linesTaken) {
				lines.push(line.trim());
			}
		}

		sparqlQuery = "";
		var sendSparql = !(word.startsWith('?'));
		var sparqlLines = "";
		var nameClause;
		var suggestVariables;
		var appendToSuggestions = "";
		var nameList;
		var response = [];
		if (suggestionMode > 0) {
			if (words.length == 1) {
				suggestVariables = "both";
				appendToSuggestions = " ";
				if (SUGGESTSUBJECTS.length > 0 && word.length > 0 && word != "<") {
					sparqlLines = SUGGESTSUBJECTS.replace(/\n/g, "\n        ").trim() + ' .';
					nameClause = SUBJECTNAME;
					nameList = subjectNames;
				} else {
					sendSparql = false;
				}
			} else if (words.length == 2) {
				nameClause = PREDICATENAME;
				suggestVariables = word.startsWith('?') ? "normal" : false;
				appendToSuggestions = " ";
				nameList = predicateNames;
				response = ['ql:contains-entity ', 'ql:contains-word '];
				if (suggestionMode == 1) {
					sparqlLines = "?qleverui_subject ql:has-predicate ?qleverui_entity .";
		        } else if (suggestionMode == 2) {
			        lines.push(words[0] + " ql:has-predicate ?qleverui_entity .");
			        sparqlLines = lines.join("\n        ");
			    }
			} else if (words.length == 3) {
				nameClause = OBJECTNAME;
				suggestVariables = "normal";
				appendToSuggestions = ' .';
				nameList = objectNames;
				if (suggestionMode == 1) {
					if (SUGGESTOBJECTS.length > 0) {
						sparqlLines = SUGGESTOBJECTS.replace(/\n/g, "\n        ").trim() + ' .';
					} else {
						sendSparql = false;
					}
		        } else if (suggestionMode == 2) {
		            lines.push(words[0] + " " + words[1] + " ?qleverui_entity .");
		            sparqlLines = lines.join("\n        ");
				}
				
				var lastWord = (predicateNames[words[1]] != "" && predicateNames[words[1]] != undefined) ? predicateNames[words[1]] : words[1];
				if (typeof(lastWord) == "object") {
					lastWord = String(lastWord);
				}
				if (lastWord == "ql:contains-entity") {
					sendSparql = false;
				} else if (lastWord == "ql:contains-word") {
					sendSparql = false;
					suggestVariables = false;
				} else {
					var subject = (subjectNames[words[0]] != "" && subjectNames[words[0]] != undefined) ? subjectNames[words[0]] : words[0];
					var subjectVarName = subject.split(/[.\/\#:]/g).slice(-1)[0].replace(/@\w*$/, '').replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g,'').toLowerCase();
					var objectVarName = lastWord.split(/[.\/\#:]/g).slice(-1)[0].replace(/@\w*$/, '').replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g,'').toLowerCase();

					response.push('?'+objectVarName+' .');
					response.push('?'+subjectVarName+'_'+objectVarName+' .');
				}
			} else {
				console.warn('Skipping every suggestions based on current position...');
				return [];
			}
			
			if (sendSparql) {
				// find all entities whose ids match what we typed
				var entityNameWord = ((word.startsWith("<")) ? "" : "<") + word.replace(/"/g, '\\"');
	            var entityQuery =
	            "    {\n" +
	            "      SELECT ?qleverui_entity (COUNT(?qleverui_entity) AS ?qleverui_count) WHERE {\n" +
	            "        " + sparqlLines + "\n" +
	            "      }\n" +
	            "      GROUP BY ?qleverui_entity\n" + ((word.length > 0 && word != "<") ?
	            "      HAVING regex(?qleverui_entity, \"^" + entityNameWord + "\")\n" : "") +
	            "    }\n" + ((nameClause.length > 0) ?  // get entity names if we know how to query them
	            "    OPTIONAL {\n" +
	            "      " + nameClause.replace(/\n/g, "\n      ") + "\n" +
	            "    }\n" : "" );

				sparqlQuery = prefixes;
				if (nameClause.length > 0) {
					sparqlQuery +=
					"SELECT ?qleverui_entity ?qleverui_name ?qleverui_count WHERE {\n";
					if (word.length > 0) {
						// find all entities whose names match what we typed and UNION it with entityQuery
						sparqlQuery +=
						"  {\n" +
						entityQuery +
						"  }\n" +
			            "  UNION\n" +
			            "  {\n" +
					    "    {\n" +
			            "      SELECT ?qleverui_entity (COUNT(?qleverui_entity) AS ?qleverui_count) WHERE {\n" +
			            "        " + sparqlLines + "\n" +
			            "      }\n" +
			            "      GROUP BY ?qleverui_entity\n" +
			            "    }\n" +
			            "    " + nameClause.replace(/\n/g, "\n    ") + "\n" +
			            "    FILTER regex(?qleverui_name, '^\"" + word + "')\n" +
			            "  }\n";
			        } else {
				    	// There was no input that we can search for -> just do entityQuery
				        sparqlQuery += entityQuery;
			        }
				} else {
					// We don't know how to get entity names -> just do entityQuery
			        sparqlQuery +=
					"SELECT ?qleverui_entity ?qleverui_count WHERE {\n" +
					entityQuery;
		        }
		        sparqlQuery +=
		        "}\n" +
		        "ORDER BY DESC(?qleverui_count)";
		        
		        getQleverSuggestions(sparqlQuery, prefixesRelation, appendToSuggestions, nameList);
		    }

			if (suggestVariables) {
				var variables = getVariables(context, undefined, suggestVariables);
		        for(var variable of variables){
			        response.push(variable+appendToSuggestions);
		        }
			}
	        
	        if(replacedRelations == false){
		        for(var prefix in prefixesRelation){
			     	response.push(prefix+':');
				}
			}
	        return (!requestExtension) ? response : [];
			
		}
    }
    console.warn('Skipping every suggestions based on current position...');
    return [];
}


function getQleverSuggestions(sparqlQuery,prefixesRelation,appendix, nameList){
	
	try {
        
        // show the loading indicator and badge
        activeLineBadgeLine = $('.CodeMirror-activeline-background');
        activeLine = $('.CodeMirror-activeline-gutter .CodeMirror-gutter-elt');
        activeLineNumber = activeLine.html();
        activeLine.html('<img src="/static/img/ajax-loader.gif">');
        $('#aBadge').remove();

        // do the limits for the scrolling feature
        sparqlQuery += "\nLIMIT " + size + "\nOFFSET " + lastSize;

        log('Getting suggestions from QLever:','requests');
        log(sparqlQuery,'requests');
        
        lastUrl = BASEURL + "?query=" + encodeURIComponent(sparqlQuery);
        var dynamicSuggestions = [];
        
        sparqlTimeout = window.setTimeout(function(){
	         
		    sparqlRequest = $.ajax({ url: lastUrl }).done(function(data) {

		        try {
		        	data = $.parseJSON(data);
		        } catch(err) {}
		        
			    log("Got suggestions from QLever.",'other');
				log("Query took " + data.time.total + ".",'requests');
		        
		        if(data.res){
		            for (var result of data.res) {
		                
		                // add back the prefixes
		                for (var prefix in prefixesRelation) {
		                    if (result[0].indexOf(prefixesRelation[prefix]) > 0) {
		                        result[0] = result[0].replace("<" + prefixesRelation[prefix], prefix + ':').slice(0, -1);
		                    }
		                }
		                for (var prefix in COLLECTEDPREFIXES) {
			                if (result[0].indexOf(COLLECTEDPREFIXES[prefix]) > 0) {
		                        result[0] = result[0].replace("<" + COLLECTEDPREFIXES[prefix], prefix + ':').slice(0, -1);
		                    }
		                }
		                var nameIndex = data.selected.indexOf("?qleverui_name");
		                var entityName = (nameIndex != -1) ? result[nameIndex] : "";
		                nameList[result[0]] = entityName;
		                dynamicSuggestions.push({displayText: result[0]+appendix, completion: result[0]+appendix, name: entityName});
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
			
				console.error(e);
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
		content = (context) ? context['content'] : editor.getValue();
		
		// ignore DISTINCT keywords when detecting duplicates
		content = content.replace(/DISTINCT /g,'');

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
   
   Build a query tree
  
**/    
function buildQueryTree(content,start){
	
	var tree = [];
	var i = 0;
	
	var tempString = "";
	var tempElement = {w3name: 'PrefixDecl',start: start}
	
	while(i < content.length){
		tempString += content[i];
		
		if(tempString.endsWith('SELECT ')){
			
			// shorten the end of prefix decl by what we needed to add to match SELECT 
			tempElement['content'] = tempString.slice(0,tempString.length-7);
			tempElement['end'] = i+start-6;
			tree.push(tempElement);
			tempString = "";
			
			tempElement = { w3name: 'SelectClause', suggestInSameLine: true, start: i+start }
		
		} else if(tempString.endsWith('WHERE {')){
			
			// shorten the end of the select clause by what we needed to add to match WHERE {
			tempElement['content'] = tempString.slice(0,tempString.length-7);
			tempElement['end'] = i+start-6;
			tree.push(tempElement);
			tempString = "";
			
			tempElement = { w3name: 'WhereClause', suggestInSameLine: true, start: i+start }
		
		} else if(tempString.endsWith('{')){
			
			// fast forward recursion
			var depth = 1;
			var subStart = i;
			var subString = "";
			while(depth != 0){
				i++;
				if(content[i] == '}'){
					depth -= 1;
				} else if(content[i] == '{'){
					depth += 1;
				} 
				if(depth != 0){
					subString += content[i];
					tempString += content[i];
				}
			}
			
			tempElement['children'] = buildQueryTree(subString,subStart);
			
		} else if(tempString.endsWith('}') || ((tempElement.w3name == "OrderCondition" || tempElement.w3name == "GroupCondition") && tempString.endsWith('\n'))){
			
			// shorten the whereclause by what we needed to add to match the }
			tempElement['content'] = tempString.slice(0,tempString.length-1);
			tempElement['end'] = i+start-1;
			tree.push(tempElement);
			tempString = "";
			
			tempElement = { w3name: 'SolutionModifier', suggestInSameLine: true, start: i+start }
		
		}
		
		i++;
	}
	
	tempElement['content'] = tempString;
	tempElement['end'] = content.length+start;
	tree.push(tempElement);
	
	for(var element of tree){
		if(element.w3name == "SolutionModifier"){
			
			var j = 0;
			var tempSubString = "";
		  
			while(j < element.content.length){
				
		        tempSubString += element.content[j];
			    if(tempSubString.endsWith('ORDER BY ')){
					
					var elementContent = "";
					while(j < element.content.length && !elementContent.endsWith('\n')){
						elementContent += element.content[j];
						j++;
					}
					if('children' in element){
						element['children'].push({ w3name: 'OrderCondition', suggestInSameLine: true, start: j+element.start-elementContent.length, end: j+element.start+1-(elementContent.split("\n").length - 1), content: elementContent });
					} else {
						element['children'] = [{ w3name: 'OrderCondition', suggestInSameLine: true, start: j+element.start-elementContent.length, end: j+element.start+1-(elementContent.split("\n").length - 1), content: elementContent }];
					}
					j--;
					tempSubString = "";
				
				} 
				if(tempSubString.endsWith('GROUP BY ')){
					
					var elementContent = "";
					var start = element.start + j;
					while(j < element.content.length && !elementContent.endsWith('\n')){
						elementContent += element.content[j];
						j++;
					}
					if('children' in element){
						element['children'].push({ w3name: 'GroupCondition', suggestInSameLine: true, start: j+element.start-elementContent.length, end: j+element.start+1-(elementContent.split("\n").length - 1), content: elementContent });
					} else {
						element['children'] = [{ w3name: 'GroupCondition', suggestInSameLine: true, start: j+element.start-elementContent.length, end: j+element.start+1-(elementContent.split("\n").length - 1), content: elementContent }];
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

function printQueryTree(tree,absPosition,prefix){
	var logString = "";
	for(var element of tree){
		logString += prefix+">>> "+element.w3name+' ['+element.start+' to '+element.end+']\n';
		if(element.children){
		  logString += printQueryTree(element.children,absPosition,prefix+"    ");
		}
	}
	return logString;
}

/**
   
   Returns the current context
   
   @params absPosition - absolute position in text
    
**/    
function getCurrentContext(absPosition){ 
    var tree = buildQueryTree(editor.getValue(),0);
	log("\n"+printQueryTree(tree,absPosition,""),'parsing');
    return searchTree(tree,absPosition);
}

function searchTree(tree,absPosition){
	for(var element of tree){
	    if(absPosition >= element.start && absPosition <= element.end){
		    if(element.children && absPosition >= element.children[0].start && absPosition <= element.children[element.children.length-1].end){
			    child = searchTree(element.children,absPosition);
			    if(child) {
				    if(child.w3name == "PrefixDecl"){
					    if(element.w3name == 'SolutionModifier'){
						    return { w3name: 'SolutionModifier', content: "" };
						} else {
						    return { w3name: 'SubQuery', content: "" };
						}
				    }
				    return child
			    } else {
				    if(element.w3name == 'SolutionModifier'){
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

function getPrefixLines() {
	var editorContent = editor.getValue()
    var prefixContent;
    
    $(CONTEXTS).each(function(index,context){
	    
	    if(context.w3name == 'PrefixDecl'){
		    
		    context.definition.lastIndex = 0;
		    var match = context.definition.exec(editorContent);
		    
			if(match && match.length > 1){
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
   @params excludeAggregationVariables - excludes variables that are the result of an aggregation (SUM(?x) as ?aggregate_variable)
   @params variableType - can be "text" for text variables, "normal" for normal variables or "both" for both
   
   		- Excludes duplicate definitions if told to do so
   		- Add list with all unused variables as one suggestion
    
**/
function getVariables(context, excludeAggregationVariables, variableType){
    var variables = [];
    var editorContent = editor.getValue();
    
    if (variableType === undefined) {
	    variableType = "normal";
    }
    
    filter = '.CodeMirror .cm-variable';
	if(excludeAggregationVariables){
    	filter = ".CodeMirror .cm-variable:not('.cm-aggregate-variable')";
    }
    
    // get the variables
    $(filter).each(function(key,variable){
		if(variables.indexOf(variable.innerHTML) == -1 && variable.innerHTML.length > 1){
			var cleanedVar = variable.innerHTML.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			var isTextVariable = RegExp(cleanedVar + "\\s+ql:contains-(entity|word)", "i").test(editorContent);
			if (variableType == "normal" && isTextVariable || variableType == "text" && !isTextVariable) {
				return "continue";
			}
		    variables.push(variable.innerHTML);
		}
    });
		
	if(context['w3name'] == 'SelectClause' && variables.length > 1){
		// remove duplicates
		var varlist = "";
		var listlength = 0
		for(variable of variables){
			if(getContextByName('SelectClause').content.indexOf(variable) == -1){
				varlist += variable+' ';
				listlength++;
			}
		}
		if(varlist != "" && listlength > 1){
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
function getPrefixSuggestions(context){
	var prefixes = []

    // get content of current context
    var testAgainst = (context) ? context['content'] : false;
    for (var key in COLLECTEDPREFIXES) {
	    var prefix = key + ': <' + COLLECTEDPREFIXES[key] + '>';
	    if (testAgainst && testAgainst.indexOf(prefix) != -1){
			continue;
	    }
	    prefixes.push(prefix);
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
    for(var i = line.length-1; i >= 0; i--) {
	    if (line[i].match(/\s/)) {
		    start = i + 1;
			break;
		}
    }
	return {start: start, end: end, string: line.slice(start, end), endsInWhitespace: (fullLength != end)}
}