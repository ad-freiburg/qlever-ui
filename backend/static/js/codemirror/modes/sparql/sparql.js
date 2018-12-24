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
      "langMatches", "lang", "regex"
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
	            before = getBefore(stream, /[\sas]/i).trim();
                stream.match(/^[\w\d]*/);
                if (before.toLowerCase() == "as") {
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
	                return "prefix-declaration prefix-value"
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
                } else if (word.match(/[.|<|>|=]/)) {
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
