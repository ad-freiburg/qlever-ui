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

$(window).resize(function (e) {
  if (e.target == window) {
    editor.setSize($('#queryBlock').width());
  }
});

$(document).ready(function () {
  
  // initialize code mirror
  editor = CodeMirror.fromTextArea(document.getElementById("query"), {
    mode: "application/sparql-query", indentWithTabs: true, smartIndent: false,
    lineNumbers: true, matchBrackets: true, autoCloseBrackets: true,
    autofocus: true, styleSelectedText: true, styleActiveLine: true,
    extraKeys: {
      "Ctrl-Enter": function (cm) { $("#runbtn").trigger('click'); },
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
  
  // set the editor size
  editor.setSize($('#queryBlock').width(), 350);
  
  // make the editor resizable
  $('.CodeMirror').resizable({
    resize: function () {
      // fix the "help"-box position on resize
      editor.setSize($(this).width(), $(this).height());
    }
  });
  
  // initialize the tooltips
  $('[data-toggle="tooltip"]').tooltip();
  
  // if there is a theme cookie: use it!
  if (getCookie("theme") != "") {
    changeTheme(getCookie("theme"));
  }
  
  // load the backends statistics
  handleStatsDisplay();
  
  // initialize the name hover
  if (SUBJECTNAME || PREDICATENAME || OBJECTNAME) {
    $('.cm-entity').hover(showRealName);
  }
  
  // initializing done
  log('Editor initialized.', 'other');
  
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
    
    if (FILLPREFIXES) {
      value = editor.getValue()
      lines = 0
      newCursor = editor.getCursor();
      for (var prefix in COLLECTEDPREFIXES) {
        fullPrefix = 'PREFIX '+prefix+': <'+COLLECTEDPREFIXES[prefix]+'>'
        if ((value.indexOf(' '+prefix+':') > 0 || value.indexOf('^'+prefix+':') > 0)&& value.indexOf(fullPrefix) == -1) {
          value = fullPrefix+'\n'+value
          lines += 1
        }
      }
      if(lines > 0){
        editor.setValue(value)
        newCursor.line += lines
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
    
    if (token.string.match(/^[.`\w?<@]\w*$/)) {
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
    
    index = values.indexOf(element);
    
    if (index == 0) {
      addNameHover(element, domElement, subjectNames, SUBJECTNAME, prefixes);
    } else if (index == 1 || index == -1 && values.length > 1 && values[1].indexOf(element) != -1) {  // entity in property path
      addNameHover(element, domElement, predicateNames, PREDICATENAME, prefixes);
    } else if (index == 2) {
      addNameHover(element, domElement, objectNames, OBJECTNAME, prefixes);
    }
    
    return true;
  }
  
  $("#runbtn").click(executeQuery);
  
  $("#csvbtn").click(function () {
    log('Download CSV', 'other');
    window.location.href = getQueryString() + "&action=csv_export";
  });
  
  $("#tsvbtn").click(function () {
    log('Download TSV', 'other');
    window.location.href = getQueryString() + "&action=tsv_export";
  });
  
  $("#sharebtn").click(function () {
    // generate pretty link
    $.post('/api/share', { 'content': editor.getValue() }, function (result) {
      log('Got pretty link from backend', 'other');
      var baseLocation = window.location.origin + window.location.pathname.split('/').slice(0, 2).join('/') + '/';
      // Query from editor in one line with single whitespace and no
      // trailing full stops before closing braces.
      var editorStringCleaned = editor.getValue()
                                  .replace(/\s+/g, " ")
                                  .replace(/\s*\.\s*}/g, " }")
                                  .replace(/"/g, "\\\"")
                                  .trim();

      $(".ok-text").collapse("hide");
      $("#share").modal("show");
      $("#prettyLink").val(baseLocation + result.link);
      $("#prettyLinkExec").val(baseLocation + result.link + '?exec=true');
      $("#queryStringLink").val(baseLocation + "?" + result.queryString);
      $("#apiCallUrl").val(BASEURL + "?" + result.queryString);
      $("#apiCallCommandLine").val(
          "curl -Gs " + BASEURL
            + " --data-urlencode \"query=" + editorStringCleaned + "\""
            + " --data-urlencode \"action=tsv_export\"");
    }, 'json');
    
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

function executeQuery(){
    log('Start processing', 'other');
    $('#suggestionErrorBlock').parent().hide();
    processQuery(getQueryString() + '&send=' + $('#maxSendOnFirstRequest').html(), true, this);
    
    // generate pretty link
    $.post('/api/share', { 'content': editor.getValue() }, function (result) {
      log('Got pretty link from backend', 'other');
      if (window.location.search.indexOf(result.queryString) == -1) {
        window.history.pushState("html:index.html", "QLever", window.location.origin + window.location.pathname.split('/').slice(0, 2).join('/') + '/' + result.link);
      }
    }, 'json');
    
    if (editor.state.completionActive) { editor.state.completionActive.close(); }
    $("#runbtn").focus();
}

function addNameHover(element, domElement, list, namepredicate, prefixes) {
  element = element.replace(/^@[a-zA-Z-]+@/, "");
  
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
    $.getJSON(BASEURL + '?query=' + encodeURIComponent(query), function (result) {
      if (result['res'] && result['res'][0]) {
        list[element] = result['res'][0];
        $(domElement).attr('data-title', result['res'][0]).attr('data-container', 'body').attr('data-tooltip', 'tooltip').tooltip();
        if ($(domElement).is(":hover")) {
          $(domElement).trigger('mouseenter');
        }
      } else {
        list[element] = "";
      }
    });
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

function processQuery(query, showStatus, element) {
  
  log('Preparing query...', 'other');
  log('Element: ' + element, 'other');
  if (showStatus != false) displayStatus("Waiting for response...");
  
  $(element).find('.glyphicon').addClass('glyphicon-spin glyphicon-refresh');
  $(element).find('.glyphicon').removeClass('glyphicon-remove');
  $(element).find('.glyphicon').css('color', $(element).css('color'));
  log('Sending request...', 'other');
  $.get(query, function (result) {
    log('Evaluating and displaying results...', 'other');
    
    $(element).find('.glyphicon').removeClass('glyphicon-spin');
    if (showStatus != false) {
      
      if (result.status == "ERROR") { displayError(result); return; }
      if (result['warnings'].length > 0) { displayWarning(result); }
      var res = '<div id="res">';
      var nofRows = result.res.length;
      const [totalTime, computeTime, resolveTime] = getResultTime(result.time);
      let resultSize = tsep(result.resultsize.toString());
      $('#resultSize').html(resultSize);
      $('#totalTime').html(totalTime);
      $('#computationTime').html(computeTime);
      $('#jsonTime').html(resolveTime);
      
      const columns = result.selected;
      
      let showAllButton = '';
      let mapViewButton = '';
      if (result.res.length > 0 && /wktLiteral/.test(result.res[0][columns.length - 1])) {
        let mapViewUrl = 'http://qlever.cs.uni-freiburg.de/mapui/index.html?';
        // NEW Hannah: Also rewrite query (ql:contains) for Map UI.
        let params = $.param({ query: rewriteQuery(editor.getValue()), backend: BASEURL });
        mapViewButton = `<a class="btn btn-default" href="${mapViewUrl}${params}" target="_blank"><i class="glyphicon glyphicon-map-marker"></i> Map view</a>`;
      }
      if (nofRows < parseInt(result.resultsize)) {
        showAllButton = `<a class="btn btn-default" onclick="processQuery(getQueryString(), true, $('#runbtn'))"><i class="glyphicon glyphicon-sort-by-attributes"></i> Limited to ${nofRows} results. Show all ${resultSize} results.</a>`;
      }
      
      if (showAllButton || mapViewButton) {
        res += `<div class="pull-right">${showAllButton} ${mapViewButton}</div><br><br><br>`;
      }
      
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
        for (var resultColumn of resultLine) {
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
            if (resultColumn) {
              // console.log("COL ENTRY:", resultColumn);
              row += "<td><span data-toggle='tooltip' title=\"" + htmlEscape(resultColumn).replace(/\"/g, "&quot;") + "\">" +
              getShortStr(resultColumn, 50, j) +
              "</span></td>";
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
        $("#answer").html(res);
        $('#answerBlock').show();
        $("html, body").animate({
          scrollTop: $("#resTable").scrollTop() + 500
        }, 500);
        
        runtime_log[runtime_log.length] = result.runtimeInformation;
        query_log[query_log.length] = result.query;
        if (runtime_log.length - 10 >= 0) {
          runtime_log[runtime_log.length - 10] = null;
          query_log[query_log.length - 10] = null;
        }
      }
    },
    // The type of result we expect (this is the third argument of the $.get
    // call above).
    showStatus ? "json": "text")
    .fail(function (jqXHR, textStatus, errorThrown) {
      var disp = "Error in getJSON: " + textStatus;
      $('#errorReason').html(disp);
      $('#errorBlock').show();
      $('#answerBlock,#infoBlock').hide();
      $(element).find('.glyphicon').removeClass('glyphicon-spin glyphicon-refresh');
      $(element).find('.glyphicon').addClass('glyphicon-remove');
      $(element).find('.glyphicon').css('color', 'red');
    });
    
  }
  
  function handleStatsDisplay() {
    log('Loading backend statistics...', 'other');
    $('#statsButton span').html('Loading information...');
    $('#statsButton').attr('disabled', 'disabled');
    
    $.getJSON(BASEURL + "?cmd=stats", function (result) {
      log('Evaluating and displaying stats...', 'other');
      $("#kbname").html(result.kbindex || "");
      $("#textname").html(result.textindex || "");
      $("#ntriples").html(tsep(result.nofActualTriples || result.noftriples));
      $("#nrecords").html(tsep(result.nofrecords));
      $("#nwo").html(tsep(result.nofwordpostings));
      $("#neo").html(tsep(result.nofentitypostings));
      $("#permstats").html(result.permutations);
      if (result.permutations == "6") {
        $("#kbstats").html("Number of subjects: <b>" +
        tsep(result.nofsubjects) + "</b><br>" +
        "Number of predicates: <b>" +
        tsep(result.nofpredicates) + "</b><br>" +
        "Number of objects: <b>" + tsep(result.nofobjects) + "</b>");
      }
      $('#statsButton').removeAttr('disabled');
      $('#statsButton span').html('Index Information');
    }).fail(function () {
      $('#statsButton span').html('<i class="glyphicon glyphicon-remove" style="color: red;"></i> Unable to connect to backend');
    });
  }
  
  function runtimeInfoForTreant(runtime_info, parent_cached = false) {
    
    // Create text child with the information we want to see in the tree.
    if (runtime_info["text"] == undefined) {
      var text = {};
      if (runtime_info["column_names"] == undefined) { runtime_info["column_names"] = ["not yet available"]; }
      text["name"] = runtime_info["description"]
      .replace(/<.*[#\/\.](.*)>/, "<$1>")
      .replace(/qlc_/g, "")
      .replace(/\?[A-Z_]*/g, function (match) { return match.toLowerCase(); })
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/^([a-zA-Z-])*/, function (match) { return match.toUpperCase(); })
      .replace(/([A-Z])-([A-Z])/g, "$1 $2")
      .replace(/AVAILABLE /, "").replace(/a all/, "all");
      text["size"] = format(runtime_info["result_rows"]) + " x " + format(runtime_info["result_cols"]);
      text["cols"] = runtime_info["column_names"].join(", ")
      .replace(/qlc_/g, "")
      .replace(/\?[A-Z_]*/g, function (match) { return match.toLowerCase(); });
      text["time"] = runtime_info["was_cached"]
      ? runtime_info["details"]["original_operation_time"]
      : runtime_info["operation_time"];
      text["total"] = text["time"];
      text["cached"] = parent_cached == true ? true : runtime_info["was_cached"];
      // Save the original was_cached flag, before it's deleted, for use below.
      for (var key in runtime_info) { if (key != "children") { delete runtime_info[key]; } }
      runtime_info["text"] = text;
      runtime_info["stackChildren"] = true;
      
      // Recurse over all children, propagating the was_cached flag from the
      // original runtime_info to all nodes in the subtree.
      runtime_info["children"].map(child => runtimeInfoForTreant(child, text["cached"]));
      // If result is cached, subtract time from children, to get the original
      // operation time (instead of the original time for the whole subtree).
      if (text["cached"]) {
        runtime_info["children"].forEach(function (child) {
          // text["time"] -= child["text"]["total"];
        })
      }
    }
  }
  
  function format(number) {
    return number.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
  }
  
  function visualise(number) {
    $('#visualisation').modal('show');
    var resultQuery;
    if (number) {
      runtimeInfoForTreant(runtime_log[number - 1]);
      runtime_info = runtime_log[number - 1];
      resultQuery = query_log[number - 1];
    } else {
      runtimeInfoForTreant(runtime_log[runtime_log.length - 1]);
      runtime_info = runtime_log[runtime_log.length - 1];
      resultQuery = query_log[query_log.length - 1];
    }
    resultQuery = resultQuery
                    .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
                    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
                    .replace(/'/g, "&#039;");
    $('#result-query').html('<pre>' + resultQuery + '</pre>');
    var treant_tree = {
      chart: {
        container: "#result-tree",
        rootOrientation: "NORTH",
        connectors: { type: "step" },
      },
      nodeStructure: runtime_info
    }
    var treant_chart = new Treant(treant_tree);
    $("p.node-time").
    filter(function () { return $(this).html() >= high_query_time_ms }).
    parent().addClass("high");
    $("p.node-time").
    filter(function () { return $(this).html() >= very_high_query_time_ms }).
    parent().addClass("veryhigh");
    $("p.node-cached").
    filter(function () { return $(this).html() == "true" }).
    parent().addClass("cached");
    
    if ($('#logRequests').is(':checked')) {
      select = "";
      for (var i = runtime_log.length; i > runtime_log.length - 10 && i > 0; i--) {
        select = '<li class="page-item"><a class="page-link" href="javascript:void(0)" onclick="visualise(' + i + ')">[' + i + ']</a></li>' + select;
      }
      select = '<ul class="pagination">' + select + '</ul>';
      $('#lastQueries').html(select);
    }
  }
