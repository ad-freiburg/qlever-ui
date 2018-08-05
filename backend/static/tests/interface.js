describe('Theme', function () {

	beforeEach(function(done) {
		$('#main').css('opacity', 0.5);
		window.setTimeout(done, 1000);
	});

	it('switches accordingly', function () {
		
		if($('body').css('background-color') != 'rgb(255, 255, 255)'){
			changeTheme();
		}
		
		// reset if style was changed manually
		document.cookie = 'theme=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
		
		// check style change
		$('#main > div.pull-right > button').trigger('click');
		
		// expect changes in color and cookie
		expect($('body').css('background-color')).toEqual('rgb(49, 49, 49)');
		expect(getCookie("theme")).toEqual('railscasts');
		
		changeTheme();
		
  	});

});

describe('Editor', function () {

	beforeEach(function(done) {
		window.setTimeout(done, 500);
	});

	it('makes more than 1 inital completion', function () {
		
		// initials completions are shown
		expect($('.CodeMirror-hints')).not.toEqual(undefined);
		expect($('.CodeMirror-hints').find('li').length).toBeGreaterThan(1);

  	});
	
	it('allows to chose one completion', function () {
		
		$('.CodeMirror-hints li:nth-child(2)').trigger('click');
		expect(editor.getValue()).toEqual(`SELECT  WHERE {
  
}`);

	});
	
	it('moves the cursor correctly', function () {
		
		expect(editor.getCursor().line).toEqual(1);
		expect(editor.getCursor().ch).toEqual(2);

  	});
  	
  	it('allows typing variables', function () {
		
		insertTextAtCursor("?name ");
		expect(editor.getLine(1)).toEqual("  ?name ");
		
  	});

  	
  	it('uses context sensitive keyword suggestions in WHERE', function () {
		
		insertTextAtCursor("ql");
		CodeMirror.commands.autocomplete(editor);
		$('.CodeMirror-hints li:nth-child(1)').trigger('click');
		expect(editor.getLine(1)).toEqual("  ?name ql:contains-entity ");
		editor.options.extraKeys["Tab"](editor);
		editor.options.extraKeys["Tab"](editor);
  	});
  	
  	it('replaces placeholders correctly', function () {
	  	
	  	expect(editor.getLine(editor.getCursor().line)).toEqual("SELECT  WHERE {");
	
	});

  	it('suggests keywords inside existing lines ', function () {
	  	
		CodeMirror.commands.autocomplete(editor);
		expect($('.CodeMirror-hints')).not.toEqual(undefined);
		expect($('.CodeMirror-hints').find('li').length).toBeGreaterThan(4);
		
	});

	it('uses context sensitive keyword suggestions in SELECT', function () {
			
		$('.CodeMirror-hints li:nth-child(1)').trigger('click');
		expect(editor.getLine(0)).toEqual("SELECT DISTINCT  WHERE {");
	 
	});
	
	it('uses context and input sensitive variables in SELECT', function () {
		
		CodeMirror.commands.autocomplete(editor);
		$('.CodeMirror-hints li:nth-child(3)').trigger('click');
		expect(editor.getLine(0)).toEqual("SELECT DISTINCT SCORE(?name) WHERE {");
		
	});
	
	it('uses context sensitive keywords after SELECT', function () {
		
		editor.setCursor(editor.getCursor().line=4);
		CodeMirror.commands.autocomplete(editor);
		expect($('.CodeMirror-hints li').length).toBeGreaterThan(12);
		
	});
	
	it('does not suggest such keywords twice', function () {
		
		$('.CodeMirror-hints li:nth-child(3)').trigger('click');
		CodeMirror.commands.autocomplete(editor);
		expect($('.CodeMirror-hints li').length).toBeLessThan(12);
		
	});
});

describe('Examples', function () {

	beforeEach(function(done) {
		window.setTimeout(done, 1000);
	});

	it('are available', function () {
		
		// expect samples to be present
		$('#main > div:nth-child(7) > div > div.col-md-4 > div.btn-group > button.btn.btn-default.dropdown-toggle').trigger('click');
		expect(sample1).not.toEqual(undefined);
		
		$('#main').hide();

  	});

});

function insertTextAtCursor(text) {
    var doc = editor.getDoc();
    var cursor = doc.getCursor();
    doc.replaceRange(text, cursor);
}