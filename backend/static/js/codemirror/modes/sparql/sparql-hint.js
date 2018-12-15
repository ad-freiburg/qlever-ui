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

    var keywords; // language keywords

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

	// extract text from non string types
    function getText(item) {
        if (item == undefined) {
            return ""
        }
        return typeof item == "string" ? item : item.text;
    }

	// add matches to result
    function addMatches(result, search, wordlist, formatter) {
        for (var i = 0; i < wordlist.length; i++) {
            result.push(formatter(wordlist[i]));
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

        //
        // Different modes:
        //    - 1: values - between "SELECT" and "WHERE"
        //    - 2: params - between "WHERE {" and "}"
        //    - 3: limit - after "LIMIT"
        //    - 4: order - after "ORDER BY"
        //    - 5: all   - everywhere else
		//    - TODO: add the others
		
        var mode = 'all'; // where am I in the query
        var parameter = 'undefined'; // where am I in the where clause

        var cur = editor.getCursor(); // current cursor position
        var line = editor.getLine(cur.line); // current line
        
        var absolutePosition = 0; // absolute cursor position in text
        var lastCharEmpty = false; // tells you if the position follows a whitespace
        var content = editor.getValue().replace('\r\n', '\n'); // editor content
        var match = null; // regex match
        var variables = true; // tell if variables should be suggested


        // detect the absolute position inside the query
        $('.CodeMirror-line').each(function(i) {
            if (i < cur.line) {
                absolutePosition += $(this).text().length;
            } else {
                absolutePosition += cur.ch;
                return false;
            }
        });

        // get given keywords
        keywords = getKeywords(editor);
        
        // detect if current char follows a white space or not
        if (line[cur.ch - 1] == " " && line.substr(0, cur.ch).slice(-3) != "AS ") {
            lastCharEmpty = true;
        } else {
            lastCharEmpty = false;
        }

        //////////////////////////////////////////////////////////////////////////////////
        //
        //    0. Input ist totally empty
        //
        //    We suggest SELECT (1. Step) and SELECT + PREFIXES in 2. Step
        //
        //////////////////////////////////////////////////////////////////////////////////

        var re = new RegExp(/SELECT/, 'g');
        match = re.exec(content)

        if (content == "" || content == " " || match == null) {
            $.ajax({
                url: "/api/prefixes",
            }).done(function(data) {
                data = $.parseJSON(data).suggestions;
                prefixes = [];
                
                // Started to write anything that can be completed to prefix but prefix not used yet
                $(data).each(function(key, value) {
                    if (content.indexOf(value) == -1 && 'prefix'.indexOf(line.toLowerCase()) == 0) {
                        prefixes.push(value);
                    }
                });

                // Do not suggest nonsense after incomplete PREFIX line
                if (line.startsWith("PREFIX ")) {

					// use empty list as a start and add only prefixes
                    keywords = [];
                    if (!requestExtension) {
                        addMatches(keywords, undefined, prefixes, function(w) { return w; });
                    }

                } else {

                    var select = `SELECT  WHERE {

}`;
                    // the default suggestion: SELECT + WHERE Clause and empty "PREFIX"
                    if ('prefix'.indexOf(line.toLowerCase()) == 0) {
                        keywords = ['PREFIX '];
                    } else {
                        keywords = [];
                    }

                    // add prefixes to select suggestion
                    if (!requestExtension) {
                        addMatches(keywords, undefined, prefixes, function(w) {
                            return w;
                        });
                        // it's still possible to type "select"
                        if ('select'.indexOf(line.toLowerCase()) == 0) {
                            keywords.push(select);
                        }
                    }
                }
                
                if (!requestExtension)
                    callback({
                        list: keywords,
                        from: Pos(cur.line, 0),
                        to: Pos(cur.line, end)
                    });

            });

            // no other suggestions needed
            return false;
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

        //////////////////////////////////////////////////////////////////////////////////
        //
        //    1. Select statement is present
        //
        //     We are possibly before or after the "SELECT" statement. Before SELECT prefixes
        //    are the only valid choice. After select it could be "values" or any other part
        //
        //////////////////////////////////////////////////////////////////////////////////

        if (match != null) {

            //////////////////////////////////////////////////////////////////////////////////
            //
            //    1.1 Before the select statement
            //
            //    The only valid suggestions here are prefixes
            //
            //////////////////////////////////////////////////////////////////////////////////
            if (absolutePosition < match.index) {

                $.ajax({
                    url: "/api/prefixes",
                }).done(function(data) {
                    // add prefixes to suggestion
                    keywords = [];
                    if ('prefix'.indexOf(line.toLowerCase()) == 0) {
                        keywords.push("PREFIX ");
                    }

                    if (!requestExtension) {
                        if ('prefix'.indexOf(line.toLowerCase()) == 0) {
                            addMatches(keywords, undefined, $.parseJSON(data).suggestions, function(w) { return w; });
                        }
                        callback({
                            list: keywords,
                            from: Pos(cur.line, 0),
                            to: Pos(cur.line, end)
                        });
                    }
                });

                // no other suggestions needed
                return false;

            }

            //////////////////////////////////////////////////////////////////////////////////
            //
            //    1.2 Behind the select statement
            //
            //    Valid suggestions are known variables and some (limited) keywords
            //
            //////////////////////////////////////////////////////////////////////////////////

            if (absolutePosition >= match.index) {

                mode = 'values';

                // show variables in thie situation
                variables = true;
				
				keywords = [];
				
				// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
				// TODO: activate REAL search behaviour
				// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
				if('distinct'.indexOf(token.string.toLowerCase()) != -1 || token.string == " "){
					keywords.push('distinct');
				}
				
				if('score()'.indexOf(token.string.toLowerCase()) != -1 || token.string == " "){
					keywords.push('score()');
				}
				
				if('text()'.indexOf(token.string.toLowerCase()) != -1 || token.string == " "){
					keywords.push('text()');
				}
            }

        } else {
            keywords.push(select);
        }

        //////////////////////////////////////////////////////////////////////////////////
        //
        //    2. WHERE is also present!
        //
        //    So the condition params will follow this statement ...
        //    No template suggestions in here ...
        //
        //////////////////////////////////////////////////////////////////////////////////

        re = new RegExp(/WHERE \{/gm, 'g');
        match = re.exec(content)
        if (match != null) {

			// after end of WHERE word
            if (absolutePosition > match.index + 5) {
                mode = 'params';

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
				// TODO: There are some new features in SPARQL with more
				// then four words in one line still being valid
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
            }
        } else {
            keywords.push("WHERE {\n}");
        }

        //////////////////////////////////////////////////////////////////////////////////
        //
        //    3. WHERE is not only present but also "closed" by the enclosing brackets
        //
        //    If we are behind the bracket there are some templating options again -
        //  we could either want to add a LIMIT or a ORDER BY - or both. Or none of them.
        //  Both should not be douplicated so the can occur only once
        //
        //////////////////////////////////////////////////////////////////////////////////

        re = new RegExp(/WHERE \{[\s\S\n\w\.]*}/g, 'g');
        match = re.exec(content)
        if (match != null) {

            var startIndex = match.index + match[0].length - cur.line - 1;

            if (absolutePosition > startIndex) {
                mode = 'afterParams';

                variables = false;

                keywords = [];
                re = new RegExp(/[^T]LIMIT /g, 'g');
                match = re.exec(content)
                if (match == null) {
                    keywords = keywords.concat(['LIMIT ', 'LIMIT 1\n', 'LIMIT 10\n', 'LIMIT 100\n', 'LIMIT 1000\n']);
                }
                re = new RegExp(/TEXTLIMIT /g, 'g');
                match = re.exec(content)
                if (match == null) {
                    keywords = keywords.concat(['TEXTLIMIT ', 'TEXTLIMIT 2\n', 'TEXTLIMIT 5\n', 'TEXTLIMIT 10\n']);
                }
                re = new RegExp(/ORDER BY /g, 'g');
                match = re.exec(content)
                if (match == null) {
                    keywords = keywords.concat(['ORDER BY ', 'ORDER BY DESC()', 'ORDER BY ASC()', 'ORDER BY SCORE()']);
                }
                re = new RegExp(/GROUP BY /g, 'g');
                match = re.exec(content)
                if (match == null) {
                    keywords = keywords.concat(['GROUP BY ']);
                }

                if (editor.getLine(cur.line)[cur.ch - 1] == '}') {
                    for (i = 0; i < keywords.length; i++) {
                        keywords[i] = '\n' + keywords[i];
                    }
                }

            }
        }

        //////////////////////////////////////////////////////////////////////////////////
        //
        //    4. LIMIT is present
        //
        //    Well ... we are directly behind a "limit" statement so we'd possibly like to
        //  type some numbers here. There are quite a few choices ...
        //
        //////////////////////////////////////////////////////////////////////////////////

        line = editor.getLine(cur.line)
        if (line.startsWith('LIMIT')) {
            mode = 'limit';

            variables = false;
            keywords = ["1\n", "5\n", "10\n", "25\n", "50\n", "100\n", "250\n", "500\n", "1000\n", "5000\n"];
        }

        if (line.startsWith('TEXTLIMIT')) {
            mode = 'textlimit';

            variables = false;
            keywords = ["2\n", "5\n", "10\n"];
        }

        //////////////////////////////////////////////////////////////////////////////////
        //
        //    5. ORDERING is present
        //
        //    We are directly behind a "ORDER BY" statement ... some variables and a few
        //  valid keywords will follow here
        //
        //////////////////////////////////////////////////////////////////////////////////

        if (line.startsWith('ORDER BY')) {

            mode = 'order';

            variables = true;
            keywords = ["desc()", "asc()", "score()"];

            if (line[cur.ch - 1] == ')') {
                keywords = [];
            }
            if (line[cur.ch - 1] == '(') {
                keywords = [];
                if (line[cur.ch - 2].toUpperCase() == 'C') {
                    keywords = ['score()'];
                }
            }
        }

        if (line.startsWith('GROUP BY')) {

            mode = 'group';

            variables = true;
            keywords = [];

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

            if (mode == 'values') {

                var variables = list;
                var list = [];
                var monsterquery = "";
                for (var i = 0; i < variables.length; i++) {
                    re = new RegExp("SELECT (.*)" + variables[i].trim().replace('?', '\\?').replace('(', '\\(').replace(')', '\\)') + "(.*) WHERE", 'g');
                    if (re.exec(content) == null) {
                        list.push(variables[i]);
                        if (!variables[i].startsWith('(')) {
                            monsterquery += variables[i] + ' ';
                        }
                    }
                }
                if (monsterquery.split(' ').length > 2) {
                    list.push(monsterquery.trim());
                }
            }

            list = list.concat(list2);

            addMatches(result, search, list, function(w) {
                return w;
            });
        }

        ////////////////////////////////////////////
        // add the static suggestions if available
        ////////////////////////////////////////////
        if (!requestExtension)
            addMatches(result, undefined, keywords, function(w) {
                if (w.indexOf('ql:') == -1) {
	                return w.toUpperCase();
	            } else {
		            return w;
	            }
            });

        ////////////////////////////////////////////
        // suggest what we have found so far ...
        ////////////////////////////////////////////
        callback({
            list: result,
            from: Pos(cur.line, start + prefixName.length),
            to: Pos(cur.line, end)
        });

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