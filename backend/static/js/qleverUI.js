var example = 0;
var activeState = 1;
var runtime_info;
var subjectNames = {};
var predicateNames = {};
var objectNames = {};
var high_query_time_ms = 100;
var very_high_query_time_ms = 1000;
var request_log = new Map();
var currentlyActiveQueryWebSocket = null;

// Generates a random query id only known to this client.
// We don't use consecutive ids to prevent clashes between
// different instances of the Qlever UI running at the same time.
function generateQueryId() {
  if (window.isSecureContext) {
    return crypto.randomUUID();
  }
  log("WARNING: Site is not served in secure context. " +
      "Falling back to Math.random() for random value generation. " +
      "Make sure this is not happening in production.", "other")
  return Math.floor(Math.random() * 1000000000);
}

// Uses the BASEURL variable to build the URL for the websocket endpoint
function getWebSocketUrl(queryId) {
  return `${BASEURL.replace(/^http/g, "ws")}/watch/${queryId}`;
}

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
      // "Ctrl-R": "replace"
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
    const entities = $('.cm-entity:not([data-has-mouseenter-handler])');
    entities.on('mouseenter', showRealName);
    entities.data('has-mouseenter-handler', 'true');
  }

  // Initialization done.
  log('Editor initialized', 'other');

  // When cursor moves, make sure that tooltips are closed.
  editor.on("cursorActivity", function (instance) {
    $('[data-tooltip=tooltip]').tooltip('hide');
    // cleanLines(instance);
  });

  editor.on("update", function (instance, event) {
    $('[data-tooltip=tooltip]').tooltip('hide');

    // (re)initialize the name hover
    if (SUBJECTNAME || PREDICATENAME || OBJECTNAME) {
      const newEntities = $('.cm-entity:not([data-has-mouseenter-handler])');
      newEntities.on('mouseenter', showRealName);
      newEntities.data('has-mouseenter-handler', 'true');
    }
  });

  // Do some custom activities (overwrite codemirror behaviour)
  editor.on("keyup", function (instance, event) {

    // For each prefix in `COLLECTEDPREFIXES`, check whether it occurs
    // somewhere in the query and if so, add it before the first `SELECT` or
    // `CONSTRUCT` (and move the cursor accordingly). If there is no `SELECT`
    // or `CONSTRUCT`, do nothing.
    let select_or_construct_regex = /(^| )(SELECT|CONSTRUCT|DELETE|INSERT)/mi;
    if (FILLPREFIXES && select_or_construct_regex.test(editor.getValue())) {
      let queryString = editor.getValue();
      let newCursor = editor.getCursor();
      let linesAdded = 0;
      for (var prefix in COLLECTEDPREFIXES) {
        const fullPrefix = "PREFIX " + prefix + ": <" + COLLECTEDPREFIXES[prefix] + ">";
        if (doesQueryFragmentContainPrefix(queryString, prefix) &&
             queryString.indexOf(fullPrefix) == -1) {
          queryString = queryString.replace(select_or_construct_regex, fullPrefix + "\n$1$2");
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
        var match = /PREFIX (.*): ?<(.*)>/gi.exec(line.trim());
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

  // Attach format funtion to formatButton.
  const formatButton = $("#formatButton");
  formatButton.click(function() {
    editor.setValue(format(editor.getValue()));
  })

  // When clicking "Execute", do the following:
  //
  // 1. Call processQuery (sends query to backend + displays results).
  // 2. Add query hash to URL.
  //
  const exeButton = $("#exebtn");
  exeButton.click(function() {
    const buttonText = $("#exebtn > span");
    if (cancelActiveQuery()) {
      exeButton.prop("disabled", true);
      buttonText.text("Cancelling");
      return;
    } else {
      buttonText.text("Cancel");
    }
    log("Start processing", "other");
    $("#suggestionErrorBlock").parent().hide();

    // Add query hash to URL (we need Django for this, hence the POST request),
    // unless this is a URL with ?query=...
    const acquireShareLink = async () => {
      const response = await fetch("/api/share", {
        method: "POST",
        body: new URLSearchParams({
          "content": editor.getValue()
        })
      });
      if (response.ok) {
        const result = await response.json();
        log("Got pretty link from backend", "other");
        if (!window.location.search.includes(result.queryString)) {
          const path = NO_SLUG_MODE
            ? ""
            : window.location.pathname.split("/").slice(0, 2).join("/");
          window.history.pushState(window.history.state, "", `${path}/${result.link}`);
        }
      }
    };

    // Run the query and fetch the share link concurrently
    Promise.all([
      processQuery(parseInt($("#maxSendOnFirstRequest").html()))
        .finally(() => {
          exeButton.prop("disabled", false);
          buttonText.text("Execute");
        }),
      acquireShareLink()
    ]).catch(error => log(error.message, 'requests'));

    if (editor.state.completionActive) { editor.state.completionActive.close(); }
    exeButton.focus();
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
    try {
      // Rewrite the query, normalize it, and escape quotes.
      //
      // TODO: The escaping of the quotes is simplistic and currently fails when
      // the query already contains some escaping itself.
      const queryRewritten = await rewriteQuery(
        editor.getValue(), {"name_service": "if_checked"});
      const queryRewrittenAndNormalizedAndWithEscapedQuotes =
        normalizeQuery(queryRewritten).replace(/"/g, "\\\"");
      
      if (editor.state.completionActive) { editor.state.completionActive.close(); }

      // POST request to Django, for the query hash.
      const response = await fetch("/api/share", {
        method: "POST",
        body: new URLSearchParams({ "content": queryRewritten })
      });
      if (response.ok) {
        const result = await response.json();
        log('Generating links for sharing ...', 'other');
        const pathWithSlug = window.location.pathname
                                            .split('/').slice(0, 2).join('/');
        const baseLocation = window.location.origin
                              + (NO_SLUG_MODE ? '' : pathWithSlug) + '/';

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
      }
    } catch (error) {
      log(error.message, 'requests');
    }
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

    (async () => {
      const result = await fetchQleverBackend({ query: query });
      if (result['res'] && result['res'][0]) {
        list[element] = result['res'][0];
        $(domElement).attr('data-title', result['res'][0]).attr('data-container', 'body').attr('data-tooltip', 'tooltip').tooltip();
        if ($(domElement).is(":hover")) {
          $(domElement).trigger('mouseenter');
        }
      } else {
        list[element] = "";
      }
    })().catch(error => log(error.message, 'requests'));
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

// Makes the UI display a placeholder text
// indicating that the query started but
// we haven't heard back from it yet.
function signalQueryStart(queryId, startTimeStamp, query) {
  appendRuntimeInformation(
    {
      query_execution_tree: null,
      meta: {}
    },
    query,
    {
      computeResult: "0ms",
      total: `${Date.now() - startTimeStamp}ms`
    },
    {
      queryId: queryId,
      updateTimeStamp: startTimeStamp
    }
  );
  renderRuntimeInformationToDom();
}

function cancelActiveQuery() {
  if (currentlyActiveQueryWebSocket) {
    currentlyActiveQueryWebSocket.send("cancel");
    return true;
  }
  return false;
}

// Create a websocket object that listens for updates qlever
// broadcasts during computation and update the current
// runtime information in the log accordingly.
function createWebSocketForQuery(queryId, startTimeStamp, query) {
  const ws = new WebSocket(getWebSocketUrl(queryId));

  ws.onopen = () => {
    log("Waiting for live updates", "other");
    ws.send("cancel_on_close");
  };

  ws.onmessage = (message) => {
    if (typeof message.data !== "string") {
      log("Unexpected message format", "other");
    } else {
      const payload = JSON.parse(message.data);
      appendRuntimeInformation(
        {
          query_execution_tree: payload,
          meta: {}
        },
        query,
        {
          computeResult: `${payload["total_time"] || (Date.now() - startTimeStamp)}ms`,
          total: `${Date.now() - startTimeStamp}ms`
        },
        {
          queryId,
          updateTimeStamp: Date.now()
        }
      );
      renderRuntimeInformationToDom();
    }
  };

  ws.onerror = () => log("Live updates not supported", "other");

  return ws;
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

  const headers = {};
  let ws = null;
  let queryId = undefined;
  if (!nothingToShow) {
    if (currentlyActiveQueryWebSocket !== null) {
      throw new Error("Started a new query before previous one finished!");
    }
    queryId = generateQueryId();
    const startTimeStamp = Date.now();
    signalQueryStart(queryId, startTimeStamp, params["query"]);
    ws = createWebSocketForQuery(queryId, startTimeStamp, params["query"]);
    currentlyActiveQueryWebSocket = ws;
    headers["Query-Id"] = queryId;
  }
  
  try {
    const result = await fetchQleverBackend(params, headers);
    
    log('Evaluating and displaying results...', 'other');

    // For non-query commands like "cmd=clear-cache" just remove the "Waiting
    // for response box" and that's it.
    if (nothingToShow) {
      $("#infoBlock").hide();
        return;
    }

    if (result.status == "ERROR") {
      displayError(result, queryId);
      return;
    }
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
      let params = new URLSearchParams({ query: normalizeQuery(query), backend: BASEURL });
      mapViewButtonVanilla = `<a class="btn btn-default" href="${mapViewUrlVanilla}${params}" target="_blank"><i class="glyphicon glyphicon-map-marker"></i> Map view</a>`;
      mapViewButtonPetri = `<a class="btn btn-default" href="${MAP_VIEW_BASE_URL}/?${params}" target="_blank"><i class="glyphicon glyphicon-map-marker"></i> Map view</a>`;
    }

    // Show the buttons (if there are any).
    //
    // TODO: Exactly which "MapView" buttons are shown depends on the
    // instance. How is currently hard-coded. This should be configurable (in
    // the Django configuration of the respective backend).
    var res = "<div id=\"res\">";
    if (showAllButton || (mapViewButtonVanilla && mapViewButtonPetri)) {
      if (MAP_VIEW_BASE_URL.length > 0) {
        res += `<div class="pull-right" style="margin-left: 1em;">${showAllButton} ${mapViewButtonPetri}</div>`;
      } else {
        res += `<div class="pull-right" style="margin-left: 1em;">${showAllButton}</div>`;
      }
    }

    // Optionally show links to other SPARQL endpoints.
    // NOTE: we want the *original* query here, as it appears in the editor,
    // without the QLever-specific rewrites (see above).
    if (SLUG.startsWith("wikidata")) {
      const queryEncoded = encodeURIComponent(original_query);
      const wdqsUrl = `https://query.wikidata.org/#${queryEncoded}`;
      const wdqsButton = `<a class="btn btn-default" href="${wdqsUrl}" target="_blank"><i class="glyphicon glyphicon-link"></i> Query WDQS</a>`;
      const virtuosoUrl = "http://wikidata.demo.openlinksw.com/sparql?";
      const virtuosoParams = new URLSearchParams({
        "default-graph-uri": "http://www.wikidata.org/",
        "qtxt": original_query, // use "query" instead of "qtxt" to execute query directly
        "format": "text/html",
        "timeout": 0,
        "signal_void": "on"
      });
      const virtuosoButton = `<a class="btn btn-default" href="${virtuosoUrl}${virtuosoParams}" target="_blank"><i class="glyphicon glyphicon-link"></i> Query Virtuoso</a>`;
      res += `<div class="pull-right">${wdqsButton}</div>`;
      res += `<div class="pull-right">${virtuosoButton}</div>`;
    }
    if (SLUG.startsWith("uniprot")) {
      const virtuosoUrl = "http://sparql.uniprot.org/sparql?";
      const virtuosoParams = new URLSearchParams({
        "qtxt": original_query,
        "format": "text/html",
        "timeout": 0,
        "signal_void": "on"
      });
      const virtuosoButton = `<a class="btn btn-default" href="${virtuosoUrl}${virtuosoParams}" target="_blank"><i class="glyphicon glyphicon-link"></i> Query Virtuoso</a>`;
      res += `<div class="pull-right">${virtuosoButton}</div>`;
    }
    if (SLUG.startsWith("dbpedia")) {
      const virtuosoUrl = "https://dbpedia.org/sparql?";
      const virtuosoParams = new URLSearchParams({
        "default-graph-uri": "http://dbpedia.org",
        "qtxt": original_query, // use "query" instead of "qtxt" to execute query directly
        "format": "text/html",
        "timeout": 0,
        "signal_void": "on"
      });
      const virtuosoButton = `<a class="btn btn-default" href="${virtuosoUrl}${virtuosoParams}" target="_blank"><i class="glyphicon glyphicon-link"></i> Query Virtuoso</a>`;
      res += `<div class="pull-right">${virtuosoButton}</div>`;
    }

    // Leave some space to the actual result table.
    res += "</div><br><br>";

    $("#answer").html(res);
    $("#show-all").click(() => processQuery().catch(error => log(error.message, "requests")));

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
        if (resultEntry) {
          const [formattedResultEntry, rightAlign] = getFormattedResultEntry(resultEntry, 50, j);
          const tooltipText = htmlEscape(resultEntry).replace(/\"/g, "&quot;");
          row += "<td" + (rightAlign ? " align=\"right\"" : "") + ">"
                 + "<span data-toggle=\"tooltip\" title=\"" + tooltipText + "\">"
                 + formattedResultEntry + "</span></td>";
        } else {
          row += "<td><span>-</span></td>";
        }
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
    renderRuntimeInformationToDom();
  } catch (error) {
    $(element).find('.glyphicon').removeClass('glyphicon-refresh');
    $(element).find('.glyphicon').addClass('glyphicon-remove');
    $(element).find('.glyphicon').css('color', 'red');
    const errorContent = {
      "exception" : error.message || "Unknown error",
      "query": query
    };
    displayError(errorContent, nothingToShow ? undefined : queryId);
  } finally {
    currentlyActiveQueryWebSocket = null;
    $(element).find('.glyphicon').removeClass('glyphicon-spin');
    // Make sure we have no socket that stays open forever
    if (ws) {
      closeWebSocket(ws);
    }
  }
}
  
async function handleStatsDisplay() {
  try {
    log('Loading backend statistics...', 'other');
    $('#statsButton span').html('Loading information...');
    $('#statsButton').attr('disabled', 'disabled');
    
    try {
      const response = await fetch(`${BASEURL}?cmd=stats`);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status} ${response.statusText}.`);
      }
      const result = await response.json();
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
    } catch (error) {
      log(error.message, 'requests');
      $('#statsButton span').html('<i class="glyphicon glyphicon-remove" style="color: red;"></i> Unable to connect to backend');
    }
  } catch (error) {
    log(error, 'requests');
  }
}

// Shows the modal containing the current runtime information tree
// calls renderRuntimeInformationToDom() afterwards to render it.
// If entry is explicitly given, the entry specifically will be
// rendered.
function showQueryPlanningTree(entry = undefined) {
  // Modal needs to be visible for rendering to succeed
  $("#visualisation").modal("show");
  renderRuntimeInformationToDom(entry);
}

// Uses the information inside of request_log
// to populate the DOM with the current runtime information.
function renderRuntimeInformationToDom(entry = undefined) {
  if (request_log.size === 0) {
    return;
  }

  // Get the right entries from the runtime log.
  const {
    runtime_info,
    query
  } = entry || Array.from(request_log.values()).pop();

  if (runtime_info["query_execution_tree"] === null) {
    $("#result-query").text("");
    $("#meta-info").text("");
    const resultTree = $("#result-tree");
    resultTree.text("Query was started, waiting for status updates...");
    resultTree.css("color", "green");
    return;
  }

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
  $("#result-query").html($("<pre />", { text: query }));

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

  // Draw the (new) tree, but retain the scrollbar position.
  const scrollTop = $("#visualisation").scrollTop();
  const scrollLeft = $("#result-tree").scrollLeft();
  new Treant(treant_tree);
  $("#visualisation").scrollTop(scrollTop);
  $("#result-tree").scrollLeft(scrollLeft);

  $("div.node").each(function () {
    const details_childs = $(this).children(".node-details");
    if (details_childs.length == 1) {
      const top_pos = parseFloat($(this).css('top'));
      $(this).attr("data-toggle", "tooltip" );
      $(this).attr("data-html", "true" );
      $(this).attr("data-placement",(top_pos>100?"top":"bottom"));
      let detail_html = '';
      const details = JSON.parse(details_childs[0].textContent);
      for (const key in details) {
        detail_html += `<span>${key}: <strong>${details[key]}</strong></span><br>`
      }
      $(this).attr("title",
      `<div style="width: 250px">
          <h5> Details </h5>
          <hr style="margin-top: 0px; margin-bottom: 0px;">
          <div style="margin-top: 10px; margin-bottom: 10px;">
            ${detail_html}
          </div>
       </div>`);
      $(this).tooltip();
    }
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
  $("p.node-status").filter(function() { return $(this).text() === "not yet started"}).parent().addClass("not-started");
  $("p.node-status").filter(function() { return $(this).text() === "optimized out"}).addClass("optimized-out");

  // For each <p>...</p> in #result-tree with class node-name or node-cols, add
  // a title tag with the content of the <p>...</p> (to show the full text on
  // hover).
  $("#result-tree p.node-name, #result-tree p.node-cols").each(function () {
    $(this).attr("title", $(this).text());
  });

  if ($('#logRequests').is(':checked')) {
    const queryHistoryList = $("<ul/>", { class: "pagination" });
    // Note: when we later iterate over this `Map`, we get the key-value
    // pairs in the order in which the keys were first inserted.
    for (const [key, value] of request_log.entries()) {
      const link = $("<a/>", {
        class: "page-link",
        href: "#",
        // Trim id to keep it readable
        text: `[${key.substring(0, 5)}]`
      });
      link.on("click", () => showQueryPlanningTree(value));
      queryHistoryList.append($("<li/>", {
        class: "page-item",
        append: link
      }));
    }
    $('#lastQueries').html(queryHistoryList);
  }
}
