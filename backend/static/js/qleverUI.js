var example = 0;
var activeState = 1;
var runtime_info;
var subjectNames = {};
var predicateNames = {};
var objectNames = {};
var high_query_time_ms = 100;
var very_high_query_time_ms = 1000;
var runtime_log = [];
var query_log = [];
var lastQueryUpdate = { queryId: null, updateTimeStamp: 0 };

$(window).resize(function (e) {
  if (e.target == window) {
    editor.setSize($('#queryBlock').width());
  }
});

$(document).ready(function () {
  
  // Initialize the editor.
  editor = CodeMirror.fromTextArea(document.getElementById("query"), {
    mode: "application/sparql-query", indentWithTabs: true, smartIndent: false,
    lineNumbers: true, matchBrackets: true, autoCloseBrackets: true,
    autofocus: true, styleSelectedText: true, styleActiveLine: true,
    extraKeys: {
      "Ctrl-Enter": function (cm) { $("#exebtn").trigger('click'); },
      "Space": function (cm) {
        var cursor = editor.getDoc().getCursor();
        var pos = { line: cursor.line, ch: cursor.ch }
        editor.replaceRange(" ", pos);
        CodeMirror.commands.autocomplete(editor);
      },
      "Tab": function (cm) { switchStates(cm); },
      "Ctrl-Space": "autocomplete",
      "Ctrl-F": "findPersistent",
      "Ctrl-R": "replace"
    },
  });
  
  // Set the width of the editor window.
  editor.setSize($('#queryBlock').width(), 350);
  
  // Make the editor resizable.
  $('.CodeMirror').resizable({
    resize: function () {
      // fix the "help"-box position on resize
      editor.setSize($(this).width(), $(this).height());
    }
  });
  
  // Initialize the tooltips.
  $('[data-toggle="tooltip"]').tooltip();
  
  // If there is a theme cookie: use it!
  if (getCookie("theme") != "") {
    changeTheme(getCookie("theme"));
  }
  
  // Load the backends statistics.
  handleStatsDisplay();
  
  // Initialize the name hover.
  if (SUBJECTNAME || PREDICATENAME || OBJECTNAME) {
    $('.cm-entity').hover(showRealName);
  }
  
  // Initialization done.
  log('Editor initialized', 'other');
  
  // Do some custom activities on cursor activity
  editor.on("cursorActivity", function (instance) {
    $('[data-tooltip=tooltip]').tooltip('hide');
    cleanLines(instance);
  });
  
  editor.on("update", function (instance, event) {
    $('[data-tooltip=tooltip]').tooltip('hide');
    
    // (re)initialize the name hover
    if (SUBJECTNAME || PREDICATENAME || OBJECTNAME) {
      $('.cm-entity').hover(showRealName);
    }
  });
  
  // Do some custom activities (overwrite codemirror behaviour)
  editor.on("keyup", function (instance, event) {
    
    // For each prefix in COLLECTEDPREFIXES, check whether it occurs somewhere
    // in the query and if so, add it before the first SELECT (and move
    // the cursor accordingly).
    if (FILLPREFIXES) {
      let queryString = editor.getValue();
      let newCursor = editor.getCursor();
      let linesAdded = 0;
      for (var prefix in COLLECTEDPREFIXES) {
        const fullPrefix = "PREFIX " + prefix + ": <" + COLLECTEDPREFIXES[prefix] + ">";
        if (doesQueryFragmentContainPrefix(queryString, prefix) &&
             queryString.indexOf(fullPrefix) == -1) {
          queryString = queryString.replace(/(^| )(SELECT)/m, fullPrefix + "\n$1$2");
          linesAdded += 1;
        }
      }
      if (linesAdded > 0){
        editor.setValue(queryString);
        newCursor.line += linesAdded;
        editor.setCursor(newCursor);
      }
    }

    var cur = instance.getCursor();
    var line = instance.getLine(cur.line);
    var token = instance.getTokenAt(cur);
    var string = '';
    
    // do not overwrite ENTER inside an completion window
    // esc - 27
    // arrow left - 37
    // arrow up - 38
    // arrow right - 39
    // arrow down - 40
    if (instance.state.completionActive || event.keyCode == 27 || (event.keyCode >= 37 && event.keyCode <= 40)) {
      
      // for for autocompletions opened unintented
      if (line[cur.ch] == "}" || line[cur.ch + 1] == "}" || line[cur.ch - 1] == "}") {
        if(instance && instance.state && instance.state.completionActive){
          instance.state.completionActive.close();
        }
      }
      return;
    }
    
    if (token.string.match(new RegExp('^[.`\w?<@]\w*$'))) {
      string = token.string;
    }
    // do not suggest anything inside a word
    
    if ((line[cur.ch] == " " || line[cur.ch + 1] == " " || line[cur.ch + 1] == undefined) && line[cur.ch] != "}" && line[cur.ch + 1] != "}" && line[cur.ch - 1] != "}") {
      // invoke autocompletion after a very short delay
      window.setTimeout(function () {
        if (example == 1) { example = 0; } else {
          CodeMirror.commands.autocomplete(instance);
        }
      }, 150);
    } else {
      console.warn('Skipped completion due to cursor position');
    }
  });
  
  // when completion is chosen - remove the counter badge
  editor.on("endCompletion", function () { $('#aBadge').remove(); });
  
  function showRealName(element) {
    
    // collect prefixes (as string and dict)
    // TODO: move this to a function. Also use this new function in sparql-hint.js
    var prefixes = "";
    var lines = getPrefixLines();
    
    for (var line of lines) {
      if (line.trim().startsWith("PREFIX")) {
        var match = /PREFIX (.*): ?<(.*)>/g.exec(line.trim());
        if (match) {
          prefixes += line.trim() + '\n';
        }
      }
    }
    
    // TODO: move this "get current element with its prefix" to a function. Also use this new function in sparql-hint.js
    values = $(this).parent().text().trim().split(' ');
    element = $(this).text().trim();
    domElement = this;
    
    if ($(this).prev().hasClass('cm-prefix-name') || $(this).prev().hasClass('cm-string-language')) {
      element = $(this).prev().text() + element;
    }
    
    if ($(this).next().hasClass('cm-entity-name')) {
      element = element + $(this).next().text();
    }
    
    index = values.indexOf(element.replace(/^\^/, ""));
    
    if (index == 0) {
      if (SUBJECTNAME != "") {
        addNameHover(element, domElement, subjectNames, SUBJECTNAME, prefixes);
      }
    } else if (index == 1 || index == -1 && values.length > 1 && values[1].indexOf(element) != -1) {  // entity in property path
      if (PREDICATENAME != "") {
        addNameHover(element, domElement, predicateNames, PREDICATENAME, prefixes);
      }
    } else if (index == 2) {
      if (OBJECTNAME != "") {
        addNameHover(element, domElement, objectNames, OBJECTNAME, prefixes);
      }
    }
    
    return true;
  }

  // When clicking "Execute", do the following:
  //
  // 1. Call processQuery (sends query to backend + displays results).
  // 2. Add query hash to URL.
  //
  $("#exebtn").click(async function() {
    log("Start processing", "other");
    $("#suggestionErrorBlock").parent().hide();
    await processQuery(parseInt($("#maxSendOnFirstRequest").html()));

    // Add query hash to URL (we need Django for this, hence the POST request),
    // unless this is a URL with ?query=...
    $.post("/api/share", { "content": editor.getValue() }, function (result) {
      log("Got pretty link from backend", "other");
      if (window.location.search.indexOf(result.queryString) == -1) {
        const newUrl = window.location.origin
                        + window.location.pathname.split("/")
                                         .slice(0, 2).join("/") + "/" + result.link;
        window.history.pushState("html:index.html", "QLever", newUrl);
      }
    }, "json");

    if (editor.state.completionActive) { editor.state.completionActive.close(); }
    $("#exebtn").focus();
  });

  // CSV download (create link element, click on it, and remove the #csv from
  // the URL, which is added by clicking; see index.html).
  $("#csvbtn").click(async function () {
    log('Download CSV', 'other');
    const query = await rewriteQuery(editor.getValue(), {"name_service": "if_checked"});
    var download_link = document.createElement("a");
    download_link.href = getQueryString(query) + "&action=csv_export";
    download_link.setAttribute("download",
        window.location.pathname.replace(/^\//, "").replace(/\//, "_") + ".csv");
    download_link.click();
    // $.ajax({
    //   url: BASEURL + "?query=" + encodeURIComponent(query),
    //   headers: { "Content-Disposition": "attachment; filename=\"xxx.csv\"" },
    //   // dataType: "json",
    //   success: function (result) { console.log("DONE"); }
    // });
    // window.location.href = await getQueryString(query) + "&action=csv_export";
  });
  
  // TSV report: like for CSV report above.
  $("#tsvbtn").click(async function () {
    log('Download TSV', 'other');
    const query = await rewriteQuery(editor.getValue(), {"name_service": "if_checked"});
    var download_link = document.createElement("a");
    download_link.href = getQueryString(query) + "&action=tsv_export";
    download_link.setAttribute("download",
        window.location.pathname.replace(/^\//, "").replace(/\//, "_") + ".tsv");
    download_link.click();
    // window.location.href = await getQueryString(query) + "&action=tsv_export";
  });
  
  // Generating the various links for sharing.
  $("#sharebtn").click(async function () {
    // Rewrite the query, normalize it, and escape quotes.
    //
    // TODO: The escaping of the quotes is simplistic and currently fails when
    // the query already contains some escaping itself.
    const queryRewritten = await rewriteQuery(
      editor.getValue(), {"name_service": "if_checked"});
    const queryRewrittenAndNormalizedAndWithEscapedQuotes =
      normalizeQuery(queryRewritten).replace(/"/g, "\\\"");

    // POST request to Django, for the query hash.
    $.post('/api/share', { "content": queryRewritten }, function (result) {
      log('Generating links for sharing ...', 'other');
      var baseLocation = window.location.origin + window.location.pathname.split('/').slice(0, 2).join('/') + '/';

      // The default media type for the curl command line link is TSV, but for
      // CONSTRUCT queries use Turtle.
      var mediaType = "text/tab-separated-values";
      var apiCallCommandLineLabel = "Command line for TSV export (using curl)";
      if (queryRewrittenAndNormalizedAndWithEscapedQuotes.match(/CONSTRUCT \{/)) {
        mediaType = "text/turtle";
        apiCallCommandLineLabel = apiCallCommandLineLabel.replace(/TSV/, "Turtle");
      }
      $("#apiCallCommandLineLabel").html(apiCallCommandLineLabel);

      $(".ok-text").collapse("hide");
      $("#share").modal("show");
      $("#prettyLink").val(baseLocation + result.link);
      $("#prettyLinkExec").val(baseLocation + result.link + '?exec=true');
      $("#queryStringLink").val(baseLocation + "?" + result.queryString);
      $("#apiCallUrl").val(BASEURL + "?" + result.queryString);
      $("#apiCallCommandLine").val("curl -s " + BASEURL.replace(/-proxy$/, "")
        + " -H \"Accept: " + mediaType + "\""
        + " -H \"Content-type: application/sparql-query\""
        + " --data \"" + queryRewrittenAndNormalizedAndWithEscapedQuotes + "\"");
      $("#queryStringUnescaped").val(queryRewrittenAndNormalizedAndWithEscapedQuotes);
    }, "json");
    
    if (editor.state.completionActive) { editor.state.completionActive.close(); }
  });
  
  $(".copy-clipboard-button").click(function () {
    var link = $(this).parent().parent().find("input")[0];
    link.select();
    link.setSelectionRange(0, 99999); /*For mobile devices*/
    document.execCommand("copy");
    $(this).parent().parent().parent().find(".ok-text").collapse("show");
  });
  
});

function addNameHover(element, domElement, list, namepredicate, prefixes) {
  element = element.replace(/^(@[a-zA-Z-]+@|\^)/, "");
  
  if ($(domElement).data('tooltip') == 'tooltip') {
    return;
  }
  if (list[element] != undefined) {
    if (list[element] != "") {
      $(domElement).attr('data-title', list[element]).attr('data-container', 'body').attr('data-tooltip', 'tooltip').tooltip();
      if ($(domElement).is(":hover")) {
        $(domElement).trigger('mouseenter');
      }
    }
  } else {
    query = prefixes + "SELECT ?qleverui_name WHERE {\n" + "  " + namepredicate.replace(/\n/g, "\n  ").replace(/\?qleverui_entity/g, element) + "\n}";
    log("Retrieving name for " + element + ":", 'requests');
    log(query, 'requests');
    // $.getJSON(BASEURL + '?query=' + encodeURIComponent(query), function (result) {
    $.ajax({ url: BASEURL + "?query=" + encodeURIComponent(query),
             headers: { Accept: "application/qlever-results+json" },
             dataType: "json",
             success: function (result) {
      if (result['res'] && result['res'][0]) {
        list[element] = result['res'][0];
        $(domElement).attr('data-title', result['res'][0]).attr('data-container', 'body').attr('data-tooltip', 'tooltip').tooltip();
        if ($(domElement).is(":hover")) {
          $(domElement).trigger('mouseenter');
        }
      } else {
        list[element] = "";
      }
    }});
  }
}


function getResultTime(resultTimes) {
  let timeList = [
    parseFloat(resultTimes.total.replace(/[^\d\.]/g, "")),
    parseFloat(resultTimes.computeResult.replace(/[^\d\.]/g, ""))
  ];
  timeList.push(timeList[0] - timeList[1]);  // time for resolving and sending
  
  for (const i in timeList) {
    const time = timeList[i];
    let timeAmount = Math.round(time);
    if (!isNaN(timeAmount)) {
      if (timeAmount == 0) {
        timeAmount = time.toPrecision(2);
      }
      timeAmount = tsep(timeAmount.toString());
      timeList[i] = `${timeAmount}ms`;
    }
  }
  return timeList;
}

// Process the given query.
async function processQuery(sendLimit=0, element=$("#exebtn")) {
  
  log('Preparing query...', 'other');
  log('Element: ' + element, 'other');
  if (sendLimit >= 0) { displayStatus("Waiting for response..."); }
  
  $(element).find('.glyphicon').addClass('glyphicon-spin glyphicon-refresh');
  $(element).find('.glyphicon').removeClass('glyphicon-remove');
  $(element).find('.glyphicon').css('color', $(element).css('color'));
  log('Sending request...', 'other');

  // A negative value for `sendLimit` has the special meaning: clear the cache
  // (without issuing a query). This is used in `backend/templates/index.html`,
  // in the definition of the `oncklick` action for the "Clear cache" button.
  // TODO: super ugly, find a better solution.
  let nothingToShow = false;
  var params = {};
  if (sendLimit >= 0) {
    var original_query = editor.getValue();
    var query = await rewriteQuery(original_query, { "name_service": "if_checked" });
    params["query"] = query;
    if (sendLimit > 0) {
      params["send"] = sendLimit;
    }
  } else {
    params["cmd"] = "clear-cache";
    nothingToShow = true;
  }
  const queryId = crypto.randomUUID();
  const ws = new WebSocket(`${BASEURL.replaceAll(/^http/g, "ws")}/watch/${queryId}`);
  const startTimeStamp = Date.now();
  ws.onopen = () => {
    log("Waiting for live updates", "other");
  };
  ws.onmessage = (message) => {
    if (typeof message.data !== "string") {
      log("Unexpected message format", "other");
    } else {
      appendRuntimeInformation(
        {
          query_execution_tree: JSON.parse(message.data),
          meta: {}
        },
        params["query"],
        {
          computeResult: Date.now() - startTimeStamp,
          total: Date.now() - startTimeStamp
        },
        {
          queryId,
          updateTimeStamp: Date.now()
        }
      );
      visualise(false);
    }
  };
  ws.onerror = () => {
    log("Live updates not supported", "other");
  };
  $.ajax({ method: "POST",
           url: BASEURL,
           data: $.param(params),
           headers: {
             "Content-type": "application/x-www-form-urlencoded",
             "Accept": "application/qlever-results+json",
             "Query-Id": queryId,
           },
           success: function (result) {
    log('Evaluating and displaying results...', 'other');
    
    $(element).find('.glyphicon').removeClass('glyphicon-spin');

    // For non-query commands like "cmd=clear-cache" just remove the "Waiting
    // for response box" and that's it.
    if (nothingToShow) {
      $("#infoBlock").hide();
      return;
    }

    if (result.status == "ERROR") { displayError(queryId, result); return; }
    if (result["warnings"].length > 0) { displayWarning(result); }

    // Show some statistics (on top of the table).
    //
    // NOTE: The result size reported by QLever (in the
    // application/qlever-results+json format) is the result size without
    // without LIMIT.
    var nofRows = result.res.length;
    const [totalTime, computeTime, resolveTime] = getResultTime(result.time);
    let resultSize = result.resultsize;
    let limitMatch = result.query.match(/\bLIMIT\s+(\d+)\s*$/);
    if (limitMatch) { resultSize = parseInt(limitMatch[1]); }
    let resultSizeString = tsep(resultSize.toString());
    $('#resultSize').html(resultSizeString);
    $('#totalTime').html(totalTime);
    $('#computationTime').html(computeTime);
    $('#jsonTime').html(resolveTime);

    const columns = result.selected;

    // If more than predefined number of results, create "Show all" button
    // (onclick action defined further down). 
    let showAllButton = "";
    if (nofRows < parseInt(resultSize)) {
      showAllButton = "<a id=\"show-all\" class=\"btn btn-default\">"
        + "<i class=\"glyphicon glyphicon-sort-by-attributes\"></i> "
        + "Limited to " + nofRows + " results; show all " + resultSizeString + " results</a>";
    }

    // If the last column of the first result row contains a WKT literal,
    // create "Map View" buttons.
    let mapViewButtonVanilla = '';
    let mapViewButtonPetri = '';
    if (result.res.length > 0 && /wktLiteral/.test(result.res[0][columns.length - 1])) {
      let mapViewUrlVanilla = 'http://qlever.cs.uni-freiburg.de/mapui/index.html?';
      let mapViewUrlPetri = 'http://qlever.cs.uni-freiburg.de/mapui-petri/?';
      let params = $.param({ query: normalizeQuery(query), backend: BASEURL });
      // var query_escaped = query.replace(/"/g, "\\\"");
      // console.log("QUERY:", `'${query}'`);
      // var query_escaped = encodeURIComponent(query);
      // mapViewButtonVanilla = `<form method="post" action="${mapViewUrlVanilla}" class="inline" target="_blank" ><input type="text" name="backend" value="${BASEURL}"><input type="text" name="query" value='PREFIX osm: <https://www.openstreetmap.org> SELECT * WHERE { ?s ?p ?o } LIMIT 10'><button type="submit" class="btn btn-default"><i class="glyphicon glyphicon-map-marker"></i> Map view</button></form>`;
      mapViewButtonVanilla = `<a class="btn btn-default" href="${mapViewUrlVanilla}${params}" target="_blank"><i class="glyphicon glyphicon-map-marker"></i> Map view</a>`;
      mapViewButtonPetri = `<a class="btn btn-default" href="${mapViewUrlPetri}${params}" target="_blank"><i class="glyphicon glyphicon-map-marker"></i> Map view</a>`;
    }

    // Show the buttons (if there are any).
    //
    // TODO: Exactly which "MapView" buttons are shown depends on the
    // instance. How is currently hard-coded. This should be configurable (in
    // the Django configuration of the respective backend).
    var res = "<div id=\"res\">";
    if (showAllButton || (mapViewButtonVanilla && mapViewButtonPetri)) {
      if (BASEURL.match("wikidata|osm-")) {
        res += `<div class="pull-right" style="margin-left: 1em;">${showAllButton} ${mapViewButtonPetri}</div>`;
        // res += `<div class="pull-right" style="margin-left: 1em;">${showAllButton} ${mapViewButtonVanilla} ${mapViewButtonPetri}</div>`;
      } else {
        res += `<div class="pull-right" style="margin-left: 1em;">${showAllButton}</div>`;
      }
    }

    // Optionally show links to other SPARQL endpoints.
    // NOTE: we want the *original* query here, as it appears in the editor,
    // without the QLever-specific rewrites (see above).
    if (SLUG.startsWith("wikidata")) {
      const queryEncoded = encodeURIComponent(original_query);
      wdqsUrl = "https://query.wikidata.org/";
      wdqsParams = "#" + queryEncoded;
      wdqsButton = `<a class="btn btn-default" href="${wdqsUrl}${wdqsParams}" target="_blank"><i class="glyphicon glyphicon-link"></i> Query WDQS</a>`;
      virtuosoUrl = "http://wikidata.demo.openlinksw.com/sparql?";
      virtuosoParams = $.param({ "default-graph-uri": "http://www.wikidata.org/",
                                 "qtxt": original_query, // use "query" instead of "qtxt" to execute query directly
                                 "format": "text/html", "timeout": 0, "signal_void": "on" });
      virtuosoButton = `<a class="btn btn-default" href="${virtuosoUrl}${virtuosoParams}" target="_blank"><i class="glyphicon glyphicon-link"></i> Query Virtuoso</a>`;
      res += `<div class="pull-right">${wdqsButton}</div>`;
      res += `<div class="pull-right">${virtuosoButton}</div>`;
    }
    if (SLUG.startsWith("uniprot")) {
      const queryEncoded = encodeURIComponent(original_query);
      virtuosoUrl = "http://sparql.uniprot.org/sparql?";
      virtuosoParams = $.param({ "qtxt": original_query,
                                 "format": "text/html", "timeout": 0, "signal_void": "on" });
      virtuosoButton = `<a class="btn btn-default" href="${virtuosoUrl}${virtuosoParams}" target="_blank"><i class="glyphicon glyphicon-link"></i> Query Virtuoso</a>`;
      res += `<div class="pull-right">${virtuosoButton}</div>`;
    }
    if (SLUG.startsWith("dbpedia")) {
      const queryEncoded = encodeURIComponent(original_query);
      virtuosoUrl = "https://dbpedia.org/sparql?";
      virtuosoParams = $.param({ "default-graph-uri": "http://dbpedia.org",
                                 "qtxt": original_query, // use "query" instead of "qtxt" to execute query directly
                                 "format": "text/html", "timeout": 0, "signal_void": "on"  });
      virtuosoButton = `<a class="btn btn-default" href="${virtuosoUrl}${virtuosoParams}" target="_blank"><i class="glyphicon glyphicon-link"></i> Query Virtuoso</a>`;
      res += `<div class="pull-right">${virtuosoButton}</div>`;
    }

    // Leave some space to the actual result table.
    res += "</div><br><br>";

    $("#answer").html(res);
    $("#show-all").click(async function() {
      await processQuery();
    });

    var tableHead = $('#resTable thead');
    var head = "<tr><th></th>";
    for (var column of columns) {
      if (column) { head += "<th>" + column + "</th>"; }
    }
    head += "</tr>";
    tableHead.html(head);
    var tableBody = $('#resTable tbody');
    tableBody.html("");
    var i = 1;
    for (var resultLine of result.res) {
      var row = "<tr>";
      row += "<td>" + i + "</td>";
      var j = 0;
      for (var resultEntry of resultLine) {
        // GROUP_CONCAT
        /*if ($('#resTable thead tr').children('th')[j + 1].innerHTML.startsWith('(GROUP_CONCAT')) {
          match = (/separator[\s]?=[\s]?\"(.*)\"/g).exec($('#resTable thead tr').children('th')[j + 1].innerHTML);
          (match && match[1]) ? sep = match[1] : sep = "";
          results = resultColumn.split(sep);
          row += "<td><span data-toggle='tooltip' title=\"" + htmlEscape(resultColumn).replace(/\"/g, "&quot;") + "\">"
          for (var resultColumnValues of results) {
            row += htmlEscape(getShortStr(resultColumnValues, 50, j)) + "<br>";
          }
          if (results.length > 5) {
            row += "<a onclick=\"showAllConcats(this,'" + sep + "','" + j + "')\">... and " + (results.length - 5) + " more.</a>";
          }
          row += "</span></td>";
        } else {*/
          if (resultEntry) {
            // console.log("COL ENTRY:", resultColumn);
            const [formattedResultEntry, rightAlign] = getFormattedResultEntry(resultEntry, 50, j);
            const tooltipText = htmlEscape(resultEntry).replace(/\"/g, "&quot;");
            row += "<td" + (rightAlign ? " align=\"right\"" : "") + ">"
                   + "<span data-toggle=\"tooltip\" title=\"" + tooltipText + "\">"
                   + formattedResultEntry + "</span></td>";
          } else {
            row += "<td><span>-</span></td>";
          }
          //}
          j++;
        }
        row += "</tr>";
        tableBody.append(row);
        i++;
      }
      $('[data-toggle="tooltip"]').tooltip();
      $('#infoBlock,#errorBlock').hide();
      $('#answerBlock').show();
      $("html, body").animate({
        scrollTop: $("#resTable").scrollTop() + 500
      }, 500);
      
      // MAX_VALUE ensures this always has priority over the websocket updates
      appendRuntimeInformation(result.runtimeInformation, result.query, result.time, { queryId, updateTimeStamp: Number.MAX_VALUE });
    }})
    .fail(function (jqXHR, textStatus, errorThrown) {
      $(element).find('.glyphicon').removeClass('glyphicon-spin glyphicon-refresh');
      $(element).find('.glyphicon').addClass('glyphicon-remove');
      $(element).find('.glyphicon').css('color', 'red');
      console.log("JQXHR", jqXHR);
      if (!jqXHR.responseJSON) {
        if (errorThrown = "Unknown error") {
          errorThrown = "No reply from backend, "
            + "for details check the development console (F12)";
        }
        jqXHR.responseJSON = {
          "exception" : errorThrown,
          "query": query
        };
      }
      var statusWithText = jqXHR.status && jqXHR.statusText
          ? (jqXHR.status + " (" + jqXHR.statusText + ")") : undefined;
      displayError(queryId, jqXHR.responseJSON, statusWithText);
    });
    
  }
  
  function handleStatsDisplay() {
    log('Loading backend statistics...', 'other');
    $('#statsButton span').html('Loading information...');
    $('#statsButton').attr('disabled', 'disabled');
    
    $.getJSON(BASEURL + "?cmd=stats", function (result) {
      log('Evaluating and displaying stats...', 'other');
      $("#kbname").html(result.kbindex ?? result["name-index"]);
      if (result["name-text-index"]) {
        $("#nrecords").html(tsep(result["num-text-records"] ?? result["nofrecords"]));
        $("#nwo").html(tsep(result["num-word-occurrences"] ?? result["nofwordpostings"]));
        $("#neo").html(tsep(result["num-entity-occurrences"] ?? result["nofentitypostings"]));
        $("#textname").html(result["name-text-index"]);
      } else {
        $("#textname").closest("div").hide();
      }
      $("#ntriples").html(tsep(result["num-triples-normal"] ?? result["nofActualTriples"]))
      $("#permstats").html(result["num-permutations"] ?? result["permutations"]);
      if ((result["num-permutations"] ?? result["permutations"]) == "6") {
        $("#kbstats").html("Number of subjects: <b>" +
          tsep(result["num-subjects-normal"] ?? result["nofsubjects"]) + "</b><br>" +
        "Number of predicates: <b>" +
          tsep(result["num-predicates-normal"] ?? result["nofpredicates"]) + "</b><br>" +
        "Number of objects: <b>" +
          tsep(result["num-objects-normal"] ?? result["nofobjects"]) + "</b>");
      }
      $('#statsButton').removeAttr('disabled');
      $('#statsButton span').html('Index Information');
    }).fail(function () {
      $('#statsButton span').html('<i class="glyphicon glyphicon-remove" style="color: red;"></i> Unable to connect to backend');
    });
  }
  
  function visualise(show, number) {
    if (show) {
      $("#visualisation").modal("show");
    }

    // Get the right entries from the runtime log.
    runtime_log_index = number ? number - 1 : runtime_log.length - 1;
    let runtime_info = runtime_log[runtime_log_index];
    let resultQuery = query_log[runtime_log_index];

    // Show meta information (if it exists).
    const meta_info = runtime_info["meta"]
    const time_query_planning = "time_query_planning" in meta_info
                                  ? formatInteger(meta_info["time_query_planning"]) + " ms"
                                  : "[not available]";
    const time_index_scans_query_planning = "time_index_scans_query_planning" in meta_info
                                  ? formatInteger(meta_info["time_index_scans_query_planning"]) + " ms"
                                  : "[not available]";
    const total_time_computing = formatInteger(meta_info["total_time_computing"]);
    $("#meta-info").html(
      "<p>Time for query planning: " + time_query_planning +
      "<br/>Time for index scans during query planning: " + time_index_scans_query_planning +
      "<br/>Total time for computing the result: " + total_time_computing + " ms</p>"
    );

    // Show the query.
    resultQuery = resultQuery
                    .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
                    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
                    .replace(/'/g, "&#039;");
    $("#result-query").html("<pre>" + resultQuery + "</pre>");

    // Show the query execution tree (using Treant.js).
    addTextElementsToQueryExecutionTreeForTreant(runtime_info["query_execution_tree"]);
    var treant_tree = {
      chart: {
        container: "#result-tree",
        rootOrientation: "NORTH",
        connectors: { type: "step" },
      },
      nodeStructure: runtime_info["query_execution_tree"]
    }
    var treant_chart = new Treant(treant_tree);

    // For each node, on mouseover show the details.
    $("div.node").hover(function () {
      $(this).children(".node-details").show();
    }, function () {
      $(this).children(".node-details").hide();
    });

    $("p.node-time").
    filter(function () { return $(this).html().replace(/,/g, "") >= high_query_time_ms }).
    parent().addClass("high");
    $("p.node-time").
    filter(function () { return $(this).html().replace(/,/g, "") >= very_high_query_time_ms }).
    parent().addClass("veryhigh");
    $("p.node-cache-status").filter(function () { return $(this).html() === "cached_not_pinned" })
                            .parent().addClass("cached-not-pinned").addClass("cached");
    $("p.node-cache-status").filter(function () { return $(this).html() === "cached_pinned" })
                            .parent().addClass("cached-pinned").addClass("cached");
    $("p.node-cache-status").filter(function () { return $(this).html() === "ancestor_cached" })
                            .parent().addClass("ancestor-cached").addClass("cached");
    $("p.node-status").filter(function() { return $(this).text() === "fully materialized"}).addClass("fully-materialized");
    $("p.node-status").filter(function() { return $(this).text() === "lazily materialized"}).addClass("lazily-materialized");
    $("p.node-status").filter(function() { return $(this).text() === "failed"}).addClass("failed");
    $("p.node-status").filter(function() { return $(this).text() === "failed because child failed"}).addClass("child-failed");
    $("p.node-status").filter(function() { return $(this).text() === "not started"}).addClass("not-started");
    $("p.node-status").filter(function() { return $(this).text() === "optimized out"}).addClass("optimized-out");
    
    if ($('#logRequests').is(':checked')) {
      select = "";
      for (var i = runtime_log.length; i > runtime_log.length - 10 && i > 0; i--) {
        select = '<li class="page-item"><a class="page-link" href="javascript:void(0)" onclick="visualise(true, ' + i + ')">[' + i + ']</a></li>' + select;
      }
      select = '<ul class="pagination">' + select + '</ul>';
      $('#lastQueries').html(select);
    }
  }
