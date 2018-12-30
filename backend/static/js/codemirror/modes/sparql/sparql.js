/**********************************************************
	
	
	LANGUAGE DEFINITIONS
	
	
**********************************************************/

var CONTEXTS = [
    {
        w3name: 'PrefixDecl',
        definition: /^([\s\S]*)SELECT/g,
    },
    {
        w3name: 'SelectClause',
        definition: /SELECT ([\S\s]*) WHERE/g,
    },
    {
        w3name: 'WhereClause',
        definition: /\{([\s\S]*)\}/g,
    
    },
    {
        w3name: 'SolutionModifier',
        definition: /\}([\s\S]+)$/g,
    }
];

var COMPLEXTYPES = [
{
    name: 'PREFIX',
    definition: /PREFIX (.*)/g,
    suggestions: [['PREFIX ',function(c){ return getPrefixSuggestions(c); },'\n']],
    availableInContext: ['PrefixDecl','undefined'],
    
},
{
    name: 'SELECT',
    definition: /SELECT (.*)/g,
    suggestions: [[`SELECT  WHERE {
  
}\n`]],
    availableInContext: ['PrefixDecl','undefined'],
    onlyOnce: true,
    
},
{
    name: 'VARIABLE',
    definition: /\?([a-zA-Z]*)/g,
    suggestions: [[function(c){ var a = []; $(getVariables(c,true,true)).each(function(k,v){ a.push(v+' ')}); return a;}]],
    availableInContext: ['SelectClause'],
    
},
{
    name: 'TEXT',
    definition: /TEXT\((.*)\)/g,
    suggestions: [['TEXT(',function(c){ var a = []; $.each(getVariables(c,true),function(k,v){ if(getContextByName('WhereClause')['content'].indexOf(v+' ql:contains') != -1){ a.push(v); }}); return a; },') ']],
    availableInContext: ['SelectClause'],
    
},
{
    name: 'SCORE',
    definition: /SCORE\((.*)\)/g,
    suggestions: [['SCORE(',function(c){ var a = []; $.each(getVariables(c,true),function(k,v){ if(getContextByName('WhereClause')['content'].indexOf(v+' ql:contains') != -1){ a.push(v); }}); return a; },') ']],
    availableInContext: ['SelectClause'],
    
},
{
    name: 'MIN',
    definition: /\(MIN\((.*)\) as (.*)\)/g,
    suggestions: [['(MIN(',function(c){ if(getContextByName('SolutionModifier')['content'].indexOf('GROUP BY') != -1){ return getVariables(c,true); } else { return false; } },') as ?min_{[0]}) ']],
    availableInContext: ['SelectClause'],
    
},
{
    name: 'MAX',
    definition: /\(MAX\((.*)\) as (.*)\)/g,
    suggestions: [['(MAX(',function(c){ if(getContextByName('SolutionModifier')['content'].indexOf('GROUP BY') != -1){ return getVariables(c,true); } else { return false; } },') as ?max_{[0]}) ']],
    availableInContext: ['SelectClause'],
    
},
{
    name: 'SUM',
    definition: /\(SUM\((.*)\) as (.*)\)/g,
    suggestions: [['(SUM(',['DISTINCT ',''],function(c){ if(getContextByName('SolutionModifier')['content'].indexOf('GROUP BY') != -1){ return getVariables(c,true); } else { return false; } },') as ?sum_{[1]}) ']],
    availableInContext: ['SelectClause'],
    
},
{
    name: 'AVG',
    definition: /\(AVG\((.*)\) as (.*)\)/g,
    suggestions: [['(AVG(',['DISTINCT ',''],function(c){ if(getContextByName('SolutionModifier')['content'].indexOf('GROUP BY') != -1){ return getVariables(c,true); } else { return false; } },') as ?avg_{[1]}) ']],
    availableInContext: ['SelectClause'],
    
},
{
    name: 'SAMPLE',
    definition: /\(SAMPLE\((.*)\) as (.*)\)/g,
    suggestions: [['(SAMPLE(',function(c){ if(getContextByName('SolutionModifier')['content'].indexOf('GROUP BY') != -1){ return getVariables(c,true); } else { return false; } },') as ?sample_{[0]}) ']],
    availableInContext: ['SelectClause'],
    
},
{
    name: 'COUNT',
    definition: /\(COUNT\((.*)\) as (.*)\)/g,
    suggestions: [['(COUNT(',['DISTINCT ',''],function(c){ if(getContextByName('SolutionModifier')['content'].indexOf('GROUP BY') != -1){ return getVariables(c,true); } else { return false; } },') as ?count_{[1]}) ']],
    availableInContext: ['SelectClause'],
    
},
{
    name: 'GROUP_CONCAT',
    definition: /\(GROUP_CONCAT\((.*)\) as (.*)\)/g,
    suggestions: [['(GROUP_CONCAT(',['DISTINCT ',''],function(c){ if(getContextByName('SolutionModifier')['content'].indexOf('GROUP BY') != -1){ return getVariables(c,true); } else { return false; } },') as ?concat_{[1]}) ']],
    availableInContext: ['SelectClause'],
    
},
{
    name: 'LIMIT',
    definition: /LIMIT ([0-9+])/g,
    suggestions: [['LIMIT ',[1,10,100,1000],'\n']],
    availableInContext: ['SolutionModifier'],
    onlyOnce: true,
    
},
{
    name: 'TEXTLIMIT',
    definition: /TEXTLIMIT ([0-9+])/g,
    suggestions: [['TEXTLIMIT ',[2,5,10],'\n']],
    availableInContext: ['SolutionModifier'],
    onlyOnce: true,
    
},
{
    name: 'ORDER BY',
    definition: /ORDER BY ((DESC|ASC)\(.*\))/g,
    suggestions: [['ORDER BY ', ['DESC(','ASC('], function(c){ return getVariables(c);} ,')\n']],
    availableInContext: ['SolutionModifier'],
    onlyOnce: true,
    
},
{
    name: 'GROUP BY',
    definition: /GROUP BY \?(.+)/g,
    suggestions: [['GROUP BY ', function(c){ return getVariables(c);},'\n']],
    availableInContext: ['SolutionModifier'],
    onlyOnce: true,
    
},
{
    name: 'TRIPLE',
    suggestions: [[ function(c){ return getDynamicSuggestions(c); }]],
    availableInContext: ['WhereClause'],
    onlyOncePerVariation: false,
},
// TODO: Implement the suggestOnlyWhenMatch Variable
/*{
    name: 'FILTER',
    definition: /FILTER \((.*)/g,
    suggestions: [['FILTER (', getVariables,' ']],
    availableInContext: ['WhereClause'],
    suggestOnlyWhenMatch: true,
},
{
    name: 'FILTER LANGUAGE',
    definition: /FILTER langMatches(.*)/g,
    suggestions: [['FILTER langMatches(lang(', getVariables, ', ', ['"en"','"de"'] ,') .\n']],
    availableInContext: ['WhereClause'],
    suggestOnlyWhenMatch: true,
},
{
    name: 'SUBQUERY',
    suggestions: [['{\n SELECT WHERE {\n\n }\n}\n']],
    availableInContext: ['WhereClause'],
    suggestOnlyWhenMatch: true,
},
{
    name: 'OPTIONAL',
    suggestions: [['OPTIONAL {\n\n }\n']],
    availableInContext: ['WhereClause'],
    suggestOnlyWhenMatch: true,
},*/
];




/**********************************************************
	
	
	CodeMirror Language mode
	
	
**********************************************************/


// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE
(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
        mod(require("../../lib/codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
        define(["../../lib/codemirror"], mod);
    else // Plain browser env
        mod(CodeMirror);
})(function(CodeMirror) {
    "use strict";


	var keywordList = ["prefix", "select", "distinct", "where", "order", "limit",
      "offset", "optional", "by", "as", "having", "not", "textlimit",
      "contains-entity", "contains-word", "filter", "group", "union",
      "optional", "has-predicate"
  ];

  var functionList = ["asc", "desc", "avg", "values", "score", "text",
      "count", "sample", "min", "max", "average", "concat", "group_concat",
      "langMatches", "lang", "regex", "sum"
  ];

    CodeMirror.defineMode("sparql", function(config) {
        var indentUnit = config.indentUnit;
        var curPunc;

		// -----------------------------------------------------
		// 	   List and detect language keywords
		// -----------------------------------------------------

		function wordRegexp(words) {
            return new RegExp("^(?:" + words.join("|") + ")$", "i");
        }

        var keywords = wordRegexp(keywordList);
        var functions = wordRegexp(functionList);

		// -----------------------------------------------------
		// 	   Detect tokens and their types
		// -----------------------------------------------------
        function tokenBase(stream, state) {
            var ch = stream.next();
            var before = "";
            
            curPunc = null;
            
            if (ch == "?") {
	            before = getBefore(stream, /\s/);
	            var isAggregate = (before != "" && stream.peekback(before.length+3).match(/\s/) && stream.peekback(before.length+2) == "a" && stream.peekback(before.length+1) == "s");
                stream.match(/^[\w\d]*/);
                if (isAggregate) {
	                return "variable aggregate-variable";	
                }
                return "variable";
            } else if (ch == "\"" || ch == "'") {
                state.tokenize = tokenLiteral(ch);
                return state.tokenize(stream, state);
            } else if (/[{}\(\)\[\]]/.test(ch)) {
                curPunc = ch;
                return "bracket";
            } else if (/[,;]/.test(ch)) {
                curPunc = ch;
                return "control";
            } else if (ch == "<") {
	            before = getBefore(stream, /[\s:]/);
                stream.match(/^[\S]*>/);
                
                if (before.indexOf(":") != -1) {
	                return "prefix-declaration prefix-value";
                }
                return "entity";
            }  else if (ch == "@") {
                stream.match(/[\w-]*/);
                return "string string-language";
            } else  {
	            before = getBefore(stream, /:/);
                var match = stream.match(/[_\w\d\.-]*(:(\s*))?/);
                var word = stream.current();
                if (word.indexOf(":") != -1) {
	                if (match[2].length > 0) {
		                stream.backUp(match[2].length);
		                return "prefix-declaration prefix-name";
	                }
                    return "entity prefixed-entity prefix-name";
                } else if (word.match(/^[.|<|>|=]+$/)) {
                    return "control";
                } else if (keywords.test(word)) {
                    return "keyword";
                } else if (functions.test(word)) {
                    return "function";
                } else if (word.match(/[\d]+/)) {
	            	return "literal";
	            } else {
	                if (before.length > 0) {
		                return "entity prefixed-entity entity-name"
	                }
	                // console.warn("Could not tokenize word: " + word);
                    return "other";
                }
            }
        }

		
		function getBefore(stream, chars) {
			var before = "";
			var i = 1;
			var ch = stream.peekback(i);
			while (ch != null && ch.match(chars)) {
				before = ch + before;
				ch = stream.peekback(++i);
			}
			return before;
		}

		// support escaping inside strings
        function tokenLiteral(quote) {
            return function(stream, state) {
                var escaped = false;
                var ch;
                while ((ch = stream.next()) != null) {
	                if (ch == quote && !escaped) {
	                    state.tokenize = tokenBase;
	                    break;
	                }
                    escaped = !escaped && ch == "\\";
                }
                return "string string-value";
            };
        }

		// Go deeper into scope
        function pushContext(state, type, col) {
            state.context = {
                prev: state.context,
                indent: state.indent,
                col: col,
                type: type
            };
        }

		// Escape from scope
        function popContext(state) {
            state.indent = state.context.indent;
            state.context = state.context.prev;
        }

        return {

            startState: function() {
                return {
                    tokenize: tokenBase,
                    context: null,
                    indent: 0,
                    col: 0
                };
            },

            token: function(stream, state) {
                if (stream.sol()) {
                    if (state.context && state.context.align == null) state.context.align = false;
                    state.indent = stream.indentation();
                }
                if (stream.eatSpace()) return null;
                var style = state.tokenize(stream, state);

                if (style != "comment" && state.context && state.context.align == null && state.context.type != "pattern") {
                    state.context.align = true;
                }

                if (curPunc == "(") pushContext(state, ")", stream.column());
                else if (curPunc == "[") pushContext(state, "]", stream.column());
                else if (curPunc == "{") pushContext(state, "}", stream.column());
                else if (/[\]\}\)]/.test(curPunc)) {
                    while (state.context && state.context.type == "pattern") popContext(state);
                    if (state.context && curPunc == state.context.type) {
                        popContext(state);
                        if (curPunc == "}" && state.context && state.context.type == "pattern")
                            popContext(state);
                    }
                } else if (curPunc == "." && state.context && state.context.type == "pattern") popContext(state);
                else if (/atom|string|variable/.test(style) && state.context) {
                    if (/[\}\]]/.test(state.context.type))
                        pushContext(state, "pattern", stream.column());
                    else if (state.context.type == "pattern" && !state.context.align) {
                        state.context.align = true;
                        state.context.col = stream.column();
                    }
                }

                return style;
            },

            indent: function(state, textAfter) {
                var firstChar = textAfter && textAfter.charAt(0);
                var context = state.context;
                if (/[\]\}]/.test(firstChar))
                    while (context && context.type == "pattern") context = context.prev;

                var closing = context && firstChar == context.type;
                if (!context)
                    return 0;
                else if (context.type == "pattern")
                    return context.col;
                else if (context.align)
                    return context.col + (closing ? 0 : 1);
                else
                    return context.indent + (closing ? 0 : indentUnit);
            },

            lineComment: "#"

        };
    });

    CodeMirror.defineMIME("application/sparql-query", {
        name: "sparql",
        keywords: keywordList + functionList,
    });

});
