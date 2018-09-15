/**
 * Created by buchholb on 3/31/15.
 * Extended by Daniel Kemen and Julian Bürklin 7/2017
 */
 
var example = 0;
var activeState = 1;

$(document).ready(function () {
	
	editor = CodeMirror.fromTextArea(document.getElementById("query"), {
	  mode: "application/sparql-query",
      indentWithTabs: true,
      smartIndent: false,
      lineNumbers: true,
      matchBrackets : true,
      autoCloseBrackets: true,
      autofocus: true,
      styleSelectedText: true,
      styleActiveLine: true,
      extraKeys: {
	      "Ctrl-Enter": function(cm) {
		    $("#runbtn").trigger('click');  
	      },
	      "Space": function(cm){
		  	var doc = editor.getDoc();
            var cursor = doc.getCursor();
            var pos = {
               line: cursor.line,
               ch: cursor.ch
            }
            doc.replaceRange(" ", pos);
			CodeMirror.commands.autocomplete(editor);
		  },
	      "Tab": function(cm) {
		   	switchStates(cm);
		  },
	      "Ctrl-Space": "autocomplete",
	  },
	});
	
	$('.CodeMirror').resizable({
	  resize: function() {
		if($(this).width() > 740){
			$('#help').css({ 'margin-top': $(this).height()+10 });
		} else {
			$('#help').css({ 'margin-top': 0 });
		}
	    editor.setSize($(this).width(), $(this).height());
	  }
	});
	
	$('[data-toggle="tooltip"]').tooltip();
	        
	console.log('Editor initialized.');
	
	// initial completion
	//window.setTimeout(function(){
	//	if (editor.getValue() == ""){
	//		console.log('Initial autocomplete triggered');
	//		CodeMirror.commands.autocomplete(editor);
	//	} else {
	//		example = 1;
	//	}
	//}, 100);
	
	editor.on("keyup", function(instance,event) {
	    if (instance.state.completionActive || event.keyCode == 27) {
	        return;
	    }
	    var cur = instance.getCursor();
	    var line = instance.getLine(cur.line);
	    var token = instance.getTokenAt(cur);
	    var string = '';
	    
	    if (token.string.match(/^[.`\w?<@]\w*$/)) {
	        string = token.string;
	    }
	    
	    if(
	    	(line.length <= 3 && line.trim() != "}") || 	// suggest on line beginning
	    	line[cur.ch] == " " || 							// suggest after whitespace
	    	line[cur.ch-1] == " " || 						// suggest after (double) whitespace
	    	line[cur.ch+1] == " " || 						// suggest before whitespace
	    	line[cur.ch+1] == undefined || 					// suggest before end
	    	line[cur.ch-1] == ":" || 						// suggest after prefix char
	    	line[cur.ch] == ')' || 							// suggest inside brackets 
	    	event.keyCode == 8								// suggest after backspace
	    ){
		    if(
		    	line[cur.ch] != "." ||		// don't suggest after points
		    	line[cur.ch-1] != " ")		// dont'suggest if last char isn't a white space
		    {
	
			    window.setTimeout(function(){
				    if(example == 1){
					    example = 0;
				    } else {
					    CodeMirror.commands.autocomplete(instance);
					}
				},150);
				
			}
		} else {
			console.warn('Skipped completion due to cursor position');
		}
	});
	
	editor.on("endCompletion",function(){
		$('#aBadge').remove();
	});
	
	if (getCookie("theme") != ""){
		changeTheme(getCookie("theme"));
	}
	
    handleStatsDisplay();
    
    var ind = window.location.href.indexOf("?query=");
    if (ind > 0) {
        ind += 7;
        var ccInd = window.location.href.indexOf("&cmd=clearcache");
        if (ccInd > 0) {
            $("#clear").prop("checked", true);
        }
        var sInd = window.location.href.indexOf("&send=");
        if (sInd > 0) {
            if (ccInd <= 0 || ccInd > sInd) {
                ccInd = sInd;
            }
        }
        var queryEscaped;
        if (ccInd > 0) {
                queryEscaped = window.location.href.substr(ind, ccInd - ind);
        } else {
                queryEscaped = window.location.href.substr(ind);
        }
        console.log('Load predefined query');
        editor.setValue(decodeURIComponent(queryEscaped.replace(/\+/g, '%20')));
        processQuery(window.location.href.substr(ind - 7));
    }
    
    $("#runbtn").click(function () {
	    console.log('Start processing');
	    if(editor.getValue().indexOf('…') > -1){
		    disp = "<h3>Error: Your query still contains placeholders.</h3><br>Please replace them first and run your query again!";
		    $('#errorReason').html(disp);
		    $('#errorBlock').show();
		    $('#answerBlock').hide();
		    $('#infoBlock').hide();
		    return false;
	    }
        var q = encodeURIComponent(editor.getValue());
        var queryString = "?query=" + q;
        if ($("#clear").prop('checked')) {
            queryString += "&cmd=clearcache";
        }
        queryString += "&send=100"
        var loc = window.location.href.substr(0, window.location.href.indexOf("?"));
        window.history.pushState("html:index.html", "QLever", loc + queryString);
        processQuery(queryString,true,this);
    });
    
    $("#csvbtn").click(function () {
	    console.log('Download CSV');
        var q = encodeURIComponent(editor.getValue());
        var queryString = "?query=" + q;
        if ($("#clear").prop('checked')) {
            queryString += "&cmd=clearcache";
        }
        window.location.href = BASEURL + queryString + "&action=csv_export";
    });
    
    $("#tsvbtn").click(function () {
	    console.log('Download TSV');
        var q = encodeURIComponent(editor.getValue());
        var queryString = "?query=" + q;
        if ($("#clear").prop('checked')) {
            queryString += "&cmd=clearcache";
        }
        window.location.href = BASEURL + queryString + "&action=tsv_export";
    });
	
	if(document.getElementById("dynamicSuggestions").value == 0){
		$('#reindex').hide();
	}
	
    $('#dynamicSuggestions').on('change',function(){
	    if(document.getElementById("dynamicSuggestions").value == 0){
			$('#reindex').hide();
		}
    });
});

function switchStates(cm){
	console.log('Switching between placeholders...');
	if(activeState == 0){
	   // move to end of select clause
	   for(var i = 0; i < cm.lastLine(); i++){
		   line = cm.getLine(i);
		   if(line.trim().startsWith('SELECT')){
			   cm.setCursor(i,(line.length-8));
			   break;
		   }
	   }
	   activeState = 1;
   	} else if(activeState == 1){
	   // move to end of query
	   line = undefined;
	   for(var i = 0; i <= cm.lastLine(); i++){
		   last = line
		   line = cm.getLine(i);
		   if(line.trim().startsWith('}')){
			   if(last.trim() != ""){
		  		  cm.setSelection({'line':i-1,'ch':last.length});
		  		  cm.replaceSelection('\n  ')
		  		  cm.setCursor(i,2);
		  	   } else {
				  cm.setCursor(i-1,2);
			   }
			   break;
		   }
	   }
	   activeState = 2;
   	} else if(activeState == 2){
	   // move to "values"
	   last = cm.lastLine();
	   line = editor.getLine(last);
	   cursor = cm.getCursor();
	   curLine = cm.getLine(cursor.line);
	   if(curLine == "  "){
	   		lastLine = cm.getLine(cursor.line-1);
	   		cm.setSelection({'line':cursor.line-1,'ch':lastLine.length},{'line':cursor.line,'ch':curLine.length});
	  		cm.replaceSelection('')
	   }
	   if(line.trim() != ""){
	  		cm.setSelection({'line':last,'ch':line.length});
	  		cm.replaceSelection('\n')
	  		cm.setCursor(last+1,0);
	   } else { 
		   cm.setCursor(last,0);
	   }
	   activeState = 0;
   	}
	window.setTimeout(function(){CodeMirror.commands.autocomplete(editor);},100);
}

function changeTheme(theme=undefined){
	if(editor.getOption("theme") == 'railscasts' || theme == 'default') {
		console.log('Setting theme to default...');
		editor.setOption('theme', 'default');
		$('body').css('background','#FFFFFF');
		$('.well').css('background','#F6F6F6');
		$('.navbar').css('background','#262626');
		$('.navbar-default .navbar-nav>li>a,.navbar-default .navbar-brand').css('color','#9d9d9d');
		$('.navbar').addClass('navbar-inverse');
		createCookie("theme", "default", 3);
	} else {
		console.log('Setting theme to dark...');
		editor.setOption('theme', 'railscasts');
		$('body').css('background','#313131');
		$('.well,.navbar').css('background','#D2D2D2');
		$('.navbar-default .navbar-nav>li>a,.navbar-default .navbar-brand').css('color','#000');
		$('.navbar').removeClass('navbar-inverse');
		createCookie("theme", "railscasts", 3);
	}
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

function getShortStr(str, maxLength, column=undefined) {
	str = str.replace(/_/g,' ');
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
    if((str.startsWith('"') && str.endsWith('"')) || (str.startsWith('\"') && str.endsWith('\"'))){
		str = str.slice(1, -1);
	}
	if(str.startsWith('<') && str.endsWith('>')){
		str = str.slice(1, -1);
	}
	pos = cpy.lastIndexOf("^^")
    if(pos > 0){
	    link = cpy.substring(pos).match(/(https?:\/\/[a-zA-Z0-9-./#?]+)/g)[0];
	    columnHTML = $($('#resTable').find('th')[column+1]);
	    content = '<a href="'+link+'" target="_blank"><i class="glyphicon glyphicon-list-alt" data-toggle="tooltip" title="'+link+'"></i></a> ';
	    if(columnHTML.html().indexOf(content) < 0){
		    columnHTML.html(content+columnHTML.html());
		}
    } else if (cpy.indexOf('http') > 0){
	    link = cpy.match(/(https?:\/\/[a-zA-Z0-9-./#?]+)/g)[0]
	    str = 'LTspan style="white-space: nowrap;"GTLTa href="'+link+'" target="_blank"GTLTi class="glyphicon glyphicon-link"GTLT/iGTLT/aGTNBSP'+str+'LT/spanGT';
    }
    str = str.replace(/\"/g, '\\"')
    str = str.replace(/%/g,'%25')
    return decodeURIComponent(JSON.parse('"'+str+'"'));
}

function displayError(result) {
	console.error('QLever returned an error while processing request',result);
    if(result["Exception-Error-Message"] == undefined || result["Exception-Error-Message"] == ""){
	    result["Exception-Error-Message"] = "Unknown error";
    }
    disp = "<h3>Error:</h3><h4><strong>" + result["Exception-Error-Message"] + "</strong></h4>";
    disp += "Your query was: " + "<br><pre>" + result.query + "</pre>";
    if(result['exception']){
	    disp += "<small><strong>Exception: </strong><em>";
	    disp += result['exception'];
	    disp += "</em></small>";
    }
    $('#errorReason').html(disp);
    $('#errorBlock').show();
    $('#answerBlock').hide();
    $('#infoBlock').hide();
}

function displayStatus(str) {
	$("#errorBlock").hide();
	$("#answerBlock").hide();
    $("#info").html(str);
    $("#infoBlock").show();
}

function processQuery(query,showStatus,element) {
	
    console.log('Preparing query...');
	if(showStatus != false){
		displayStatus("Waiting for response...");
    }
    $(element).find('.glyphicon').addClass('glyphicon-spin');
	$(element).find('.glyphicon').removeClass('glyphicon-remove');
	$(element).find('.glyphicon').addClass('glyphicon-refresh');
	$(element).find('.glyphicon').css('color',$(element).css('color'));
    maxSend = 0;
    var sInd = window.location.href.indexOf("&send=");
    if (sInd > 0) {
        var nextAmp = window.location.href.indexOf("&", sInd + 1);
        if (nextAmp > 0) {
            maxSend = parseInt(window.location.href.substr(sInd + 6, nextAmp - (sInd + 6)))
        } else {
            maxSend = parseInt(window.location.href.substr(sInd + 6))
        }
    }
    var uri = BASEURL + query;
    console.log('Sending request...');
    $.getJSON(uri, function (result) {
	    console.log('Evaluating and displaying results...');

	    $(element).find('.glyphicon').removeClass('glyphicon-spin');
        if(showStatus != false){
	    
		    if (result.status == "ERROR") {
	            displayError(result);
	            return;
	        }
	        var res = "<div id=\"res\">";
	        // Time
	        res += "<div id=\"time\">";
	        var nofRows = result.res.length;
	        $('#resultSize').html(result.resultsize);
	        $('#totalTime').html(result.time.total);
	        $('#computationTime').html(result.time.computeResult);
	        $('#jsonTime').html((parseInt(result.time.total.replace(/ms/, ""))
	            				- parseInt(result.time.computeResult.replace(/ms/, ""))).toString()+'ms');
	        res += "</div>";
	        if (maxSend > 0 && maxSend <= nofRows && maxSend < parseInt(result.resultsize)) {
	            res += "<div class=\"pull-right\"><button class=\"btn btn-default\" disabled><i class=\"glyphicon glyphicon-eye-close\"></i> Output limited to "+maxSend.toString()+" results.</button>  <a class=\"btn btn-default\" href=\"" + window.location.href.substr(0, window.location.href.indexOf("&")) + "\"><i class=\"glyphicon glyphicon-sort-by-attributes\"></i> Show all "+result.resultsize+" results</a></div><br><br><br>";
	        }
	        var selection = /SELECT(?: DISTINCT)?([^]*)WHERE/.exec(decodeURIComponent(result.query.replace(/\+/g, '%20')))[1];
	        
	        selection = decodeURIComponent(selection)
			
			indentation = 0;
			remainder = ""
			columns = []
			for (var i = 0; i < selection.length; i++){
				if(selection[i] == " " && indentation == 0){
					columns.push(remainder);
					remainder = "";
				} else if(selection[i] == "(" ){
					remainder += selection[i];
					indentation++;
				} else if(selection[i] == ")" ){
					remainder += selection[i];
					indentation--;
				} else {
					remainder += selection[i];
				}
			}
			
	        var tableHead = $('#resTable thead');
	        var head = "<tr><th></th>";
	        for (var i = 0; i < columns.length; i++) {
		        if(columns[i]){
			        head += "<th>" + columns[i] + "</th>";
		        }
	        }
	        head += "</tr>";
	        tableHead.html(head);
	        var tableBody = $('#resTable tbody');
	        tableBody.html('');
	        for (var i = 0; i < result.res.length; i++) {
	            var row = "<tr>";
	            row += "<td>"+i+"</td>";
	            for (var j = 0; j < result.res[i].length; ++j) {
		            // GROUP_CONCAT
		            if($('#resTable thead tr').children('th')[j+1].innerHTML.startsWith('(GROUP_CONCAT')){
			            match = (/separator[\s]?=[\s]?\"(.*)\"/g).exec($('#resTable thead tr').children('th')[j+1].innerHTML);
			            if(match && match[1]){
				            sep = match[1];
				        } else {
					        sep = "";
				        }
		            	results = result.res[i][j].split(sep);
		            	row += "<td><span data-toggle='tooltip' title=\"" + htmlEscape(result.res[i][j]).replace(/\"/g, "&quot;") + "\">"
		            	for(var k = 0; k <  Math.min(results.length,5); k++){
			                row += htmlEscape(getShortStr(results[k], 50, j))+"<br>";
			            }
			            if(results.length > 5){
				            row += "<a onclick=\"showAllConcats(this,'"+sep+"','"+j+"')\">... and "+(results.length-5)+" more.</a>";
			            }
			            row += "</span></td>";
		            } else {
						if(result.res[i][j]){
			                row += "<td><span data-toggle='tooltip' title=\"" + htmlEscape(result.res[i][j]).replace(/\"/g, "&quot;") + "\">"
			                    + htmlEscape(getShortStr(result.res[i][j], 50, j))
			                    + "</span></td>";
			            } else {
				            row += "<td><span>-</span></td>";
			            }
		            }
	            }
	            row += "</tr>";
	            tableBody.append(row);
	        }
	        $('[data-toggle="tooltip"]').tooltip();
	        $('#infoBlock').hide();
	        $('#errorBlock').hide();
	        $("#answer").html(res);
	        $('#answerBlock').show();
	        $("html, body").animate({ scrollTop: $("#resTable").scrollTop()+500 }, 500);
	        
	    }
    }).fail(function(jqXHR, textStatus, errorThrown ) {
        var disp = "Connection problem...";
        $('#errorReason').html(disp);
	    $('#errorBlock').show();
	    $('#answerBlock').hide();
	    $('#infoBlock').hide();
	    $(element).find('.glyphicon').removeClass('glyphicon-spin');
	    $(element).find('.glyphicon').removeClass('glyphicon-refresh');
	    $(element).find('.glyphicon').addClass('glyphicon-remove');
	    $(element).find('.glyphicon').css('color','red');
    });
    
}

function showAllConcats(element,sep,column){
	data = $(element).parent().data('original-title');
	console.log(data);
	html = "";
	results = data.split(sep);
	for(var k = 0; k < results.length; k++){
	    html += htmlEscape(getShortStr(results[k], 50, column))+"<br>";
	}
	$(element).parent().html(html);
}

function tsep(str) {
    var spl = str.split('.');
    var intP = spl[0];
    var frac = spl.length > 1 ? '.' + spl[1] : '';
    var regex = /(\d+)(\d{3})/;
    while (regex.test(intP)) {
        intP =intP.replace(regex, '$1' + ',' + '$2');
    }
    return intP + frac;
}

function handleStatsDisplay() {
	console.log('Loading backend statistics...');
	$('#statsButton').html('<i class="glyphicon glyphicon-stats"></i> Loading information...');
	$('#statsButton').attr('disabled','disabled');
    
    $.ajax('/reindex').done(function(response){
	    if(response.status == 'finished'){
		    console.log('QLever UI reindexer is ready...');
		    $('#reindexLoader').hide();
		    $('#reindexHead').html('QLever UI index was built successfully.');
		    $('#reindexText').html('To reveal the full potential of QLever UI you should reindex your QLever index as well.');
	    } else if (response.status == 'running'){
		    console.log('QLever UI reindexer is running...');
		    $('#reindexText').html('Please try again later.');
	    } else if (response.status == 'error'){
		    console.error('QLever UI reindexer returned an error',response);
		    $('#reindexLoader').hide();
		    $('#reindexHead').html('Error while building the index.');
		    $('#reindexText').html(response.message);
	    } else {
		$('#reindex').hide();
		}
    });
    
    $.getJSON(BASEURL+"?cmd=stats", function (result) {
	    console.log('Evaluating and displaying stats...');
        $("#kbname").html("Index: <b>" + tsep(result.kbindex) + "</b> ");
        $("#textname").html("Index: <b>" + tsep(result.textindex) + "</b> ");
        $("#ntriples").html("Number of triples: <b>" + tsep(result.noftriples) + "</b> ");
        $("#nrecords").html("Number of text records: <b>" + tsep(result.nofrecords) + "</b> ");
        $("#nwo").html("Number of word occurrences: <b>" + tsep(result.nofwordpostings) + "</b> ");
        $("#neo").html("Number of entity occurrences: <b>" + tsep(result.nofentitypostings) + "</b> ");
		$("#permstats").html("Registered <b>" + result.permutations + "</b> permutations of the index.");
        if (result.permutations == "6") {
            $("#kbstats").html("Number of subjects: <b>"
                + tsep(result.nofsubjects) + "</b><br>"
                + "Number of predicates: <b>"
                + tsep(result.nofpredicates) + "</b><br>"
                + "Number of objects: <b>" + tsep(result.nofobjects) + "</b>");
        }
        $('#statsButton').removeAttr('disabled');
        $('#statsButton').html('<i class="glyphicon glyphicon-stats"></i> Toggle backend statistics');
    }).fail(function() { $('#statsButton').html('<i class="glyphicon glyphicon-remove" style="color: red;"></i> Unable to connect to backend'); });
}

// Cookie helpers
var createCookie = function(name, value, days) {
    var expires;
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toGMTString();
    }
    else {
        expires = "";
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

// Ensuring compatibility
String.prototype.trimLeft = String.prototype.trimLeft || function () {
    var start = -1;
    while( this.charCodeAt(++start) < 33 );
    return this.slice( start, this.length);
};
