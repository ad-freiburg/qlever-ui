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

// NEW Hannah 03.05.2020: Rewrite query to allow syntactic sugar in the UI like
// FILTER KEYWORDS(...) or ql:contains .
function rewriteQuery(query) {

  console.log("Rewriting query (looking for \"FILTER CONTAINS\" or \"ogc:contains\" ...");
  var query_rewritten = query;

  // HACK(Hannah 03.05.2020): allow a construct such as FILTER
  // keywords(?title, "info* retr*")
  var m_var = "?qlm_";
  var filter_contains_re = /FILTER\s+CONTAINS\((\?[\w_]+),\s*(\"[^\"]+\")\)\s*\.?\s*/i;
  while (query_rewritten.match(filter_contains_re)) {
    query_rewritten = query_rewritten.replace(filter_contains_re,
         m_var + ' ql:contains-entity $1 . ' + m_var + ' ql:contains-word $2 . ');
    m_var = m_var + "i";
  }

  // HACK(Hannah 30.03.2021): rewrite ql:contains using ogc:contains and
  // ogc:contains_area. Repeat if it occurs several times.
  var ogc_contains_match = /ogc:contains([^_])/;
  var ogc_contains_replace = /\{(\s*)([^{}]*)ogc_tmp:contains([^{}]*[^{}\s])(\s*)\}/;
  while (query_rewritten.match(ogc_contains_match)) {
    if (!query_rewritten.includes("PREFIX ogc:")) query_rewritten =
      'PREFIX ogc: <http://www.opengis.net/rdf#>\n' + query_rewritten
    m_var = m_var + "i";
    // Replace first occurrence by ql_ogc:contains and check that it is indeed
    // gone. That way, we can be sure that we do not enter an infinite loop in
    // case the regex from the large replace does not match.
    query_rewritten = query_rewritten.replace(ogc_contains_match,
      'ogc_tmp:contains$1');
    query_rewritten = query_rewritten.replace(ogc_contains_replace,
      '{ {$1$2osm2rdf:contains_area+ ' + m_var + ' . ' + m_var + ' osm2rdf:contains_nonarea$3\n' +
      '  } UNION {$1$2osm2rdf:contains_area+|osm2rdf:contains_nonarea$3$4} }');
    // console.log("Version with " + m_var + ":\n" + query_rewritten);
    if (query_rewritten.includes('ogc_tmp:contains ')) {
      throw "Leftover ogc_tmp:contains, this should not happen";
    }
  }

  return query_rewritten;
}


function getQueryString() {

  q = editor.getValue();

  // Rewrite query, see rewriteQueryHack above.
  q = rewriteQuery(q);

  log("getQueryString:\n" + q, 'requests');
  q = encodeURIComponent(q);
  // var q = encodeURIComponent(editor.getValue());

  var queryString = "?query=" + q;
  if ($("#name_service").prop('checked')) {
    queryString += "&name_service=true";
  }
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

function showAllConcats(element, sep, column) {
  data = $(element).parent().data('original-title');
  html = "";
  results = data.split(sep);
  for (var k = 0; k < results.length; k++) {
    html += getShortStr(results[k], 50, column) + "<br>";
  }
  $(element).parent().html(html);
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

function getShortStr(str, maxLength, column = undefined) {

  // HACK Hannah 16.09.2021: Remove xsd:decimal.
  str = str.replace(/\^\^<.*>/, "");
  // str = str.replace(/\^\^<http:\/\/www.w3.org\/2001\/XMLSchema#decimal>/, "");

  str = str.replace(/_/g, ' ');
  var pos;
  var cpy = str;
  var veryLongLength = 500;
  var maxLinkLength = 50;
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
  } else {
    // Always abbreviate very long texts.
    if (cpy.length > veryLongLength) {
      half_length = veryLongLength / 2 - 3;
      str = cpy.substring(0, half_length) + " [...] " + cpy.substring(cpy.length - half_length);
    }
  }
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith('\"') && str.endsWith('\"'))) {
    str = str.slice(1, -1);
  }
  if (str.startsWith('<') && str.endsWith('>')) {
    str = str.slice(1, -1);
  }

  // HACK Hannah 16.09.2021: Fixed-precision float depending on variable name.
  var var_name = $($("#resTable").find("th")[column + 1]).html();
  // console.log("Check if \"" + str + "\" in column \"" + var_name + "\" is a float ...");
  if (var_name == "?note" || var_name.endsWith("_note")) str = parseFloat(str).toFixed(2).toString();
  if (var_name == "?lp_proz") str = parseFloat(str).toFixed(0).toString();
  if (var_name == "?gesamt_score") str = parseFloat(str).toFixed(1).toString();
  if (var_name == "?lehrpreis") str = parseFloat(str).toFixed(0).toString();

  pos = cpy.lastIndexOf("^^")
  pos_http = cpy.indexOf("http");
  let isLink = false;
  let linkStart = "";
  let linkEnd = "";
  if (pos > 0) {
    cpy = cpy.replace(/ /g, '_');
    link = cpy.substring(pos).match(/(https?:\/\/[a-zA-Z0-9.:%/#\?_-]+)/g)[0];
    columnHTML = $($('#resTable').find('th')[column + 1]);
    content = '<a href="' + link + '" target="_blank"><i class="glyphicon glyphicon-list-alt" data-toggle="tooltip" title="' + link + '"></i></a> ';
    if (columnHTML.html().indexOf(content) < 0) {
      columnHTML.html(content + columnHTML.html());
    }
  } else if (pos_http > 0) {
    isLink = true;
    cpy = cpy.replace(/ /g, '_');
    link = cpy.match(/(https?:\/\/[a-zA-Z0-9.:%/#\?_-]+)/g)[0];
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
  str = htmlEscape(str);
  if (isLink) {
    if (str.length > maxLinkLength) str = str.substring(0, maxLinkLength - 4) + " ...";
    str = `${linkStart}${str}${linkEnd}`;
  }
  return str
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
