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


$(document).ready(initialize);
function initialize() {

  // Load the backends statistics.
  handleStatsDisplay();

  // CSV download (create link element, click on it, and remove the #csv from
  // the URL, which is added by clicking; see index.html).
  $("#csvbtn").click(async function() {
    log('Download CSV', 'other');
    const query = await rewriteQuery(editor.getValue(), { "name_service": "if_checked" });
    var download_link = document.createElement("a");
    download_link.href = getQueryString(query) + "&action=csv_export";
    download_link.setAttribute("download",
      window.location.pathname.replace(/^\//, "").replace(/\//, "_") + ".csv");
    download_link.click();
  });

  // TSV report: like for CSV report above.
  $("#tsvbtn").click(async function() {
    log('Download TSV', 'other');
    const query = await rewriteQuery(editor.getValue(), { "name_service": "if_checked" });
    var download_link = document.createElement("a");
    download_link.href = getQueryString(query) + "&action=tsv_export";
    download_link.setAttribute("download",
      window.location.pathname.replace(/^\//, "").replace(/\//, "_") + ".tsv");
    download_link.click();
    // window.location.href = await getQueryString(query) + "&action=tsv_export";
  });

  // Generating the various links for sharing.
  $("#sharebtn").click(async function() {
    try {
      // Rewrite the query, normalize it, and escape quotes.
      //
      // TODO: The escaping of the quotes is simplistic and currently fails when
      // the query already contains some escaping itself.
      const queryRewritten = await rewriteQuery(
        editor.getValue(), { "name_service": "if_checked" });
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
        var mediaTypePost = "application/sparql-results+json";
        var mediaTypeGet = "application/qlever-results+json";
        if (queryRewrittenAndNormalizedAndWithEscapedQuotes.match(/CONSTRUCT \{/)) {
          mediaTypePost = "text/turtle";
          mediaTypeGet = "text/turtle";
        }
        var apiCallCommandLineLabelPost =
          "cURL command line for POST request (" + mediaTypePost + "):";
        var apiCallCommandLineLabelGet =
          "cURL command line for GET request (" + mediaTypeGet + "):";
        $("#apiCallCommandLineLabelPost").html(apiCallCommandLineLabelPost);
        $("#apiCallCommandLineLabelGet").html(apiCallCommandLineLabelGet);

        $(".ok-text").collapse("hide");
        $("#share").modal("show");
        $("#prettyLink").val(baseLocation + result.link);
        $("#prettyLinkExec").val(baseLocation + result.link + '?exec=true');
        $("#queryStringLink").val(baseLocation + "?" + result.queryString);
        $("#apiCallUrl").val(BASEURL + "?" + result.queryString);
        $("#apiCallCommandLinePost").val("curl -s " + BASEURL.replace(/-proxy$/, "")
          + " -H \"Accept: " + mediaTypePost + "\""
          + " -H \"Content-type: application/sparql-query\""
          + " --data \"" + queryRewrittenAndNormalizedAndWithEscapedQuotes + "\"");
        $("#apiCallCommandLineGet").val("curl -s " + BASEURL.replace(/-proxy$/, "")
          + " -H \"Accept: " + mediaTypeGet + "\""
          + " --data-urlencode \"query=" + queryRewrittenAndNormalizedAndWithEscapedQuotes + "\"");
        $("#queryStringUnescaped").val(queryRewrittenAndNormalizedAndWithEscapedQuotes);
      }
    } catch (error) {
      log(error.message, 'requests');
    }
  });

  $(".copy-clipboard-button").click(function() {
    var link = $(this).parent().parent().find("input")[0];
    link.select();
    link.setSelectionRange(0, 99999); /*For mobile devices*/
    document.execCommand("copy");
    $(this).parent().parent().parent().find(".ok-text").collapse("show");
  });

  const accessToken = $("#access_token");

  function updateBackendCommandVisibility() {
    if (accessToken.val().trim() === "") {
      $("#backend_commands").hide();
    } else {
      $("#backend_commands").show();
    }
  }

  updateBackendCommandVisibility();
  accessToken.on("input", function() {
    updateBackendCommandVisibility();
  });

}

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

function resetIndicator(element) {
  const icon = $(element).find('.glyphicon');
  icon.addClass('glyphicon-refresh');
  icon.removeClass('glyphicon-remove');
  icon.css('color', '');
}

function setRunningIndicator(element) {
  const icon = $(element).find('.glyphicon');
  icon.addClass('glyphicon-spin glyphicon-refresh');
  icon.removeClass('glyphicon-remove');
  icon.css('color', $(element).css('color'));
}

function removeRunningIndicator(element) {
  const icon = $(element).find('.glyphicon');
  icon.removeClass('glyphicon-spin');
  if (icon.css("color") !== 'rgb(255, 0, 0)') {
    icon.css('color', '');
  }
}

function setErrorIndicator(element) {
  const icon = $(element).find('.glyphicon');
  icon.removeClass('glyphicon-refresh');
  icon.addClass('glyphicon-remove');
  icon.css('color', 'red');
}

// Executes a backend command (e.g. `clear-cache`).
async function executeBackendCommand(command, element) {
  log("Executing command: " + command);
  let headers = {};
  const access_token = $.trim($("#access_token").val());
  if (access_token.length > 0)
    headers["Authorization"] = `Bearer ${access_token}`;
  const params = { "cmd": command };
  setRunningIndicator(element);
  try {
    await fetchQleverBackend(params, headers);
  } catch (error) {
    setErrorIndicator(element)
  } finally {
    removeRunningIndicator(element);
  }
}

// Process the given query.
async function processQuery(original_query, operationType, sendLimit = 0, element = $("#exebtn")) {
  log('Preparing query...', 'other');
  log('Element: ' + element, 'other');
  if (sendLimit >= 0) { displayStatus("Waiting for response..."); }

  setRunningIndicator(element);
  log('Sending request...', 'other');

  let params = {};
  let headers = {};
  console.assert(sendLimit >= 0);
  var query = await rewriteQuery(original_query, { "name_service": "if_checked" });
  console.log(`Determined operation type: ${operationType}`);
  switch (operationType) {
    // If we don't know the operation type, we assume it's a query.
    case "Unknown":
    case "Query":
      params["query"] = query;
      break;
    case "Update":
      params["update"] = query;
      const access_token = $.trim($("#access_token").val());
      if (access_token.length > 0) headers["Authorization"] = `Bearer ${access_token}`;
      break
    default:
      console.log("Unknown operation type");
      disp = "<h4><strong>Error processing operation</strong></h4>";
      disp += "This should not happen. Please <a href='https://github.com/ad-freiburg/qlever-ui/issues/new'>report</a> this with the operation that triggered it.";
      displayInErrorBlock(disp);
      setErrorIndicator(element);
      removeRunningIndicator(element);
      return;
  }
  if (sendLimit > 0) {
    params["send"] = sendLimit;
  }

  let ws = null;
  let queryId = undefined;
  if (currentlyActiveQueryWebSocket !== null) {
    throw new Error("Started a new query before previous one finished!");
  }
  queryId = generateQueryId();
  const startTimeStamp = Date.now();
  signalQueryStart(queryId, startTimeStamp, params["query"]);
  ws = createWebSocketForQuery(queryId, startTimeStamp, params["query"]);
  currentlyActiveQueryWebSocket = ws;
  headers["Query-Id"] = queryId;

  try {
    let result = await fetchQleverBackend(params, headers);

    log('Evaluating and displaying results...', 'other');

    if (result.status === "ERROR") {
      displayError(result, queryId);
      return;
    }

    switch (operationType) {
      case "Update":
        if (!Array.isArray(result)) {
          result = [result];
        }
        // Collect warnings from all updates and display the unique ones.
        const uniqueWarnings = [...new Set(result.map(result => result["warnings"]).flat())];
        displayWarningsIfPresent(uniqueWarnings);

        const operationMetadata = result.map(result => result["delta-triples"].operation);
        $('#answerBlock, #infoBlock, #errorBlock').hide();
        const totalInserted = operationMetadata.reduce((acc, elem) => acc + elem.inserted, 0);
        const totalDeleted = operationMetadata.reduce((acc, elem) => acc + elem.deleted, 0);
        let updateMessage = `Update successful (insert triples: ${totalInserted}, delete triples: ${totalDeleted}`;
        if (result.length > 1) {
          updateMessage += `, aggregated from ${result.length} updates)`;
        } else {
          updateMessage += ")";
        }
        $('#updateMetadata').html(updateMessage);
        $('#updatedBlock').show();
        $("html, body").animate({
          scrollTop: $("#updatedBlock").scrollTop() + 500
        }, 500);

        // MAX_VALUE ensures this always has priority over the websocket updates
        if (result.length > 0) {
          appendRuntimeInformation(result.at(-1).runtimeInformation, result.at(-1).update, result.at(-1).time, {
            queryId,
            updateTimeStamp: Number.MAX_VALUE
          });
        } else {
          appendRuntimeInformation({}, query, {}, {
            queryId,
            updateTimeStamp: Number.MAX_VALUE
          }, true);
        }
        renderRuntimeInformationToDom();
        // Reset any error state of the backend command buttons
        resetIndicator($("#btnClearDeltaTriples"));
        resetIndicator($("#btnClearCacheComplete"));
        break
      // The operation type wasn't detected. It was most likely syntactically invalid and resulted in an error while parsing. Display the result anyway in case some valid queries were not identified.
      case "Unknown":
        if (Array.isArray(result["warnings"])) {
          result["warnings"].push("Could not determine operation type, defaulting to \"query\"");
        }
      case "Query":
        // Display warnings.
        displayWarningsIfPresent(result["warnings"]);

        // Show some statistics (on top of the table).
        //
        // NOTE: The result size reported by QLever (in the
        // application/qlever-results+json format) is the result size without
        // LIMIT.
        var nofRows = result.res.length;
        const [totalTime, computeTime, resolveTime] = getResultTime(result.time);
        let resultSize = result.resultsize;
        let limitMatch = result.query.match(/\bLIMIT\s+(\d+)\s*$/);
        if (limitMatch) {
          resultSize = parseInt(limitMatch[1]);
        }
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
          if (column) {
            head += "<th>" + column + "</th>";
          }
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
        $('#infoBlock,#errorBlock,#updatedBlock').hide();
        $('#answerBlock').show();
        $("html, body").animate({
          scrollTop: $("#resTable").scrollTop() + 500
        }, 500);

        // MAX_VALUE ensures this always has priority over the websocket updates
        appendRuntimeInformation(result.runtimeInformation, result.query, result.time, { queryId, updateTimeStamp: Number.MAX_VALUE });
        renderRuntimeInformationToDom();
    }
  } catch (error) {
    setErrorIndicator(element);
    const errorContent = {
      "exception": error.message || "Unknown error",
      "query": query
    };
    displayError(errorContent, queryId);
  } finally {
    currentlyActiveQueryWebSocket = null;
    removeRunningIndicator(element);
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

let currentTree = null;

// Uses the information inside of request_log
// to populate the DOM with the current runtime information.
function renderRuntimeInformationToDom(entry = undefined) {
  if (request_log.size === 0) {
    return;
  }

  // Get the right entries from the runtime log.
  const {
    runtime_info,
    query,
    isNoop
  } = entry || Array.from(request_log.values()).pop();

  // When the last operation was a noop, no runtime info is available.
  if (isNoop) {
    $("#result-query").text("");
    $("#meta-info").text("");
    const resultTree = $("#result-tree");
    resultTree.text("No query analysis available, because the operation has no effect and was optimized out");
    resultTree.css("color", "green");
    return;
  }

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
  const total_time_computing = meta_info["total_time_computing"] ? formatInteger(meta_info["total_time_computing"]) : "N/A";
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
  // Make sure that we are not leaking memory
  if (currentTree !== null) {
    currentTree.destroy();
  }
  currentTree = new Treant(treant_tree);
  $("#visualisation").scrollTop(scrollTop);
  $("#result-tree").scrollLeft(scrollLeft);

  $("div.node").each(function() {
    const details_childs = $(this).children(".node-details");
    if (details_childs.length == 1) {
      const top_pos = parseFloat($(this).css('top'));
      $(this).attr("data-toggle", "tooltip");
      $(this).attr("data-html", "true");
      $(this).attr("data-placement", (top_pos > 100 ? "top" : "bottom"));
      let detail_html = '';
      const details = JSON.parse(details_childs[0].textContent);
      for (const key in details) {
        // Value with thousand separators if it is a number.
        value = details[key];
        if (typeof value === "number") {
          value = tsep(value.toString());
        }
        detail_html += `<span>${key}: <strong>${value}</strong></span><br>`
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
    filter(function() { return $(this).html().replace(/,/g, "") >= high_query_time_ms }).
    parent().addClass("high");
  $("p.node-time").
    filter(function() { return $(this).html().replace(/,/g, "") >= very_high_query_time_ms }).
    parent().addClass("veryhigh");
  $("p.node-cache-status").filter(function() { return $(this).html() === "cached_not_pinned" })
    .parent().addClass("cached-not-pinned").addClass("cached");
  $("p.node-cache-status").filter(function() { return $(this).html() === "cached_pinned" })
    .parent().addClass("cached-pinned").addClass("cached");
  $("p.node-cache-status").filter(function() { return $(this).html() === "ancestor_cached" })
    .parent().addClass("ancestor-cached").addClass("cached");
  $("p.node-status").filter(function() { return $(this).text() === "fully materialized" }).addClass("fully-materialized");
  $("p.node-status").filter(function() { return $(this).text() === "lazily materialized" }).addClass("lazily-materialized");
  $("p.node-status").filter(function() { return $(this).text() === "failed" }).addClass("failed");
  $("p.node-status").filter(function() { return $(this).text() === "failed because child failed" }).addClass("child-failed");
  $("p.node-status").filter(function() { return $(this).text() === "not yet started" }).parent().addClass("not-started");
  $("p.node-status").filter(function() { return $(this).text() === "optimized out" }).addClass("optimized-out");

  // For each <p>...</p> in #result-tree with class node-name or node-cols, add
  // a title tag with the content of the <p>...</p> (to show the full text on
  // hover).
  $("#result-tree p.node-name, #result-tree p.node-cols").each(function() {
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
