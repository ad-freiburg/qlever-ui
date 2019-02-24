// UI helpers

function log(message,kind){
	if (kind == undefined) {
		kind = "other";
	}
	if((kind == 'parsing' && $('#logParsing').is(':checked')) ||
	   (kind == 'other' && $('#logOther').is(':checked')) ||
	   (kind == 'requests' && $('#logRequests').is(':checked')) ||
	   (kind == 'suggestions' && $('#logSuggestions').is(':checked'))){
		   console.log('['+kind+']: '+message);
	} 
}

function getQueryString(){
	var q = encodeURIComponent(editor.getValue());
    var queryString = "?query=" + q;
    if ($("#clear").prop('checked')) {
        queryString += "&cmd=clearcache";
    }
    return BASEURL + queryString
}

function cleanLines(cm) {
	var cursor = cm.getCursor();
	var selection = cm.listSelections()[0];
	var position = cm.getScrollInfo();
	var lastLine = undefined;
	var line = cm.getLine(0);
	for (var i = 0; i < cm.lastLine(); i++) {
		if(i != cursor.line && i != cursor.line-1){
			lastLine = line;
	        line = cm.getLine(i);
			if(line.trim() == ""){
				if(i == 0){ cm.setSelection({line: i, ch: 0},{line: i+1, ch: 0}) } else {
				cm.setSelection({line: i-1, ch: 999999999},{line: i, ch: line.length}); }
				cm.replaceSelection('');
				if(i < cursor.line){
					cursor.line -= 1;
					selection.head.line - 1;
				}
			}
			var startingWhitespaces = line.length - line.replace(/^\s+/,"").length;
			lineContent = line.slice(startingWhitespaces);
			if(lineContent != lineContent.replace(/\s{2,}/g,' ')){
				cm.setSelection({line: i, ch: startingWhitespaces},{line: i, ch: line.length});
				cm.replaceSelection(lineContent.replace(/\s{2,}/g,' '));
			}
		}
	}
	cm.scrollTo(position.left,position.top);
	cm.setCursor(cursor);
	cm.setSelection(selection.anchor,selection.head);
}

function switchStates(cm) {
	log('Switching between placeholders...','other');	
    if (activeState == 0) {
        // move to end of select clause
        for (var i = 0; i < cm.lastLine(); i++) {
            line = cm.getLine(i);
            if (line.trim().startsWith('SELECT')) {
                cm.setCursor(i, (line.length - 8));
                if(line[line.length - 9] != " "){
	                // add empty whitespace in select if not present
	                cm.setSelection({ 'line': i, 'ch': line.length - 8},{ 'line': i, 'ch': line.length - 7 });
	                cm.replaceSelection('  ');
					cm.setCursor(i, (line.length - 7));
                }
                break;
            }
        }
        activeState = 1;
    } else if (activeState == 1) {
        // move to end of query
        line = undefined;
        for (var i = 0; i <= cm.lastLine(); i++) {
            last = line
            line = cm.getLine(i);
            if (line.trim().startsWith('}')) {
                if (last.trim() != "") {
	                // add a new line at the end if not present
                    cm.setSelection({ 'line': i - 1, 'ch': last.length });
                    cm.replaceSelection('\n  ');
                    cm.setCursor(i, 2);
                } else {
	                // jump to the new line at the end
                    cm.setCursor(i - 1, 2);
                }
                break;
            }
        }
        activeState = 2;
    } else if (activeState == 2) {
        // move to "values"
        last = cm.lastLine();
        line = editor.getLine(last);
        if (line.trim() != "") {
            cm.setSelection({ 'line': last, 'ch': line.length });
            cm.replaceSelection('\n')
            cm.setCursor(last + 1, 0);
        } else {
            cm.setCursor(last, 0);
        }
        activeState = 0;
    }
    window.setTimeout(function() {
        CodeMirror.commands.autocomplete(editor);
    }, 100);
}

function changeTheme(theme = undefined) {
    if (editor.getOption("theme") == 'railscasts' || theme == 'default') {
		log('Setting theme to default...','other');
        editor.setOption('theme', 'default');
        $('body').css('background', '#FFFFFF');
        $('.well').css('background', '#F6F6F6');
        $('.navbar').css('background', '#262626');
        $('.navbar-default .navbar-nav>li>a,.navbar-default .navbar-brand').css('color', '#9d9d9d');
        $('.navbar').addClass('navbar-inverse');
        createCookie("theme", "default", 3);
    } else {
        log('Setting theme to dark...','other');
        editor.setOption('theme', 'railscasts');
        $('body').css('background', '#313131');
        $('.well,.navbar').css('background', '#D2D2D2');
        $('.navbar-default .navbar-nav>li>a,.navbar-default .navbar-brand').css('color', '#000');
        $('.navbar').removeClass('navbar-inverse');
        createCookie("theme", "railscasts", 3);
    }
}

function expandEditor() {
    if ($('.CodeMirror').width() < 800) {
        editor.setSize($('#queryBlock').width());
        $('#help').css({ 'margin-top': $('.CodeMirror').height() + 10});
        $('#uiHelp').hide();
    } else {
        editor.setSize($('.col-md-8').width());
        $('#help').css({ 'margin-top': 0 });
        $('#uiHelp').show();
    }
}

function displayError(result) {
    console.error('QLever returned an error while processing request', result);
    if (result["Exception-Error-Message"] == undefined || result["Exception-Error-Message"] == "") {
        result["Exception-Error-Message"] = "Unknown error";
    }
    disp = "<h3>Error:</h3><h4><strong>" + result["Exception-Error-Message"] + "</strong></h4>";
    disp += "Your query was: " + "<br><pre>" + result.query + "</pre>";
    if (result['exception']) {
        disp += "<small><strong>Exception: </strong><em>";
        disp += result['exception'];
        disp += "</em></small>";
    }
    $('#errorReason').html(disp);
    $('#errorBlock').show();
    $('#answerBlock, #infoBlock').hide();
}

function displayStatus(str) {
    $("#errorBlock,#answerBlock").hide();
    $("#info").html(str);
    $("#infoBlock").show();
}

function showAllConcats(element, sep, column) {
    data = $(element).parent().data('original-title');
    html = "";
    results = data.split(sep);
    for (var k = 0; k < results.length; k++) {
        html += htmlEscape(getShortStr(results[k], 50, column)) + "<br>";
    }
    $(element).parent().html(html);
}

function tsep(str) {
    var spl = str.split('.');
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
        .replace(/GT/g, ">")
        .replace(/LT/g, "<")
        .replace(/NBSP/g, "&nbsp;");
    // return $("<div/>").text(str).html();
}

function getShortStr(str, maxLength, column = undefined) {
    str = str.replace(/_/g, ' ');
    var pos;
    var cpy = str;
    if (cpy.charAt(0) == '<') {
        pos = cpy.lastIndexOf('/');
        var paraClose = cpy.lastIndexOf(')');
        if (paraClose > 0 && paraClose > pos) {
            var paraOpen = cpy.lastIndexOf('(', paraClose);
            if (paraOpen > 0 && paraOpen < pos) {
                pos = cpy.lastIndexOf('/', paraOpen);
            }
        }
        if (pos < 0) {
            pos += 1;
        }
        str = cpy.substring(pos + 1, cpy.length - 1);
        if (str.length > maxLength) {
            str = str.substring(0, maxLength - 1) + "[...]"
        }
    } else if (cpy.charAt(0) == '\"') {
        pos = cpy.lastIndexOf('\"');
        if (pos !== 0) {
            str = cpy.substring(0, pos + 1);
        }
        if (str.length > maxLength) {
            str = str.substring(0, maxLength - 1) + "[...]\""
        }
    }
    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith('\"') && str.endsWith('\"'))) {
        str = str.slice(1, -1);
    }
    if (str.startsWith('<') && str.endsWith('>')) {
        str = str.slice(1, -1);
    }
    pos = cpy.lastIndexOf("^^")
    if (pos > 0) {
        link = cpy.substring(pos).match(/(https?:\/\/[a-zA-Z0-9-./#?]+)/g)[0];
        columnHTML = $($('#resTable').find('th')[column + 1]);
        content = '<a href="' + link + '" target="_blank"><i class="glyphicon glyphicon-list-alt" data-toggle="tooltip" title="' + link + '"></i></a> ';
        if (columnHTML.html().indexOf(content) < 0) {
            columnHTML.html(content + columnHTML.html());
        }
    } else if (cpy.indexOf('http') > 0) {
        link = cpy.match(/(https?:\/\/[a-zA-Z0-9-.:%/#?]+)/g)[0]
        checkLink = link.toLowerCase()
		if(checkLink.endsWith('jpg') || checkLink.endsWith('png') || checkLink.endsWith('gif') || checkLink.endsWith('jpeg') || checkLink.endsWith('svg')){
	        str = 'LTa href="' + link + '" target="_blank"GTLTimg src="' + link + '" width="50" GTLT/aGT';
	    } else if(checkLink.endsWith('pdf') || checkLink.endsWith('doc') || checkLink.endsWith('docx')) {
		    str = 'LTspan style="white-space: nowrap;"GTLTa href="' + link + '" target="_blank"GTLTi class="glyphicon glyphicon-file"GTLT/iGTLT/aGTNBSP' + str + 'LT/spanGT';
	    } else {
		    str = 'LTspan style="white-space: nowrap;"GTLTa href="' + link + '" target="_blank"GTLTi class="glyphicon glyphicon-link"GTLT/iGTLT/aGTNBSP' + str + 'LT/spanGT';
	    }
    }

    return str
        // old code
    str = str.replace(/\"/g, '\\"')
    str = str.replace(/%/g, '%25')
    return decodeURIComponent(JSON.parse('"' + str + '"'));
}


// Cookie helpers
var createCookie = function(name, value, days) {
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
String.prototype.trimLeft = String.prototype.trimLeft || function() {
    var start = -1;
    while (this.charCodeAt(++start) < 33);
    return this.slice(start, this.length);
};