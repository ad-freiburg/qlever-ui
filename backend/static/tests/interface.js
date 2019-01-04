describe('Theme', function () {

	beforeEach(function(done) {
		window.setTimeout(done, 500);
	});

	it('switches accordingly', function () {
		
		changeTheme('default');
		
		// reset if style was changed manually
		document.cookie = 'theme=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
		
		// check style change
		changeTheme();
		
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

	it('makes no inital completions', function () {
		
		// initials completions are shown
		expect($('.CodeMirror-hints')).not.toEqual(undefined);
		expect($('.CodeMirror-hints').find('li').length).toEqual(0);

  	});
	
	it('it suggests when start typing',function(){
		
		CodeMirror.commands.autocomplete(editor);
		expect($('.CodeMirror-hints').find('li').length).toBeGreaterThan(0);
	});
	
	it('allows to chose one completion', function () {
		
		$('.CodeMirror-hints li:nth-child(2)').trigger('click');
		expect(editor.getLine(0)).toEqual('SELECT  WHERE {');

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
		expect($('.CodeMirror-hints').find('li').length).toBeGreaterThan(3);
		
	});

	it('uses context sensitive keyword suggestions in SELECT', function () {
			
		$('.CodeMirror-hints li:nth-child(1)').trigger('click');
		expect(editor.getLine(0)).toEqual("SELECT DISTINCT  WHERE {");
	 
	});
	
	it('uses context and input sensitive variables in SELECT', function () {
		
		CodeMirror.commands.autocomplete(editor);
		$('.CodeMirror-hints li:nth-child(3)').trigger('click');
		expect(editor.getLine(0)).toEqual("SELECT DISTINCT SCORE(?name)  WHERE {");
		
	});
	
	it('uses context sensitive keywords after SELECT', function () {
		
		editor.setCursor(editor.getCursor().line=3);
		CodeMirror.commands.autocomplete(editor);
		expect($('.CodeMirror-hints li').length).toBeGreaterThan(10);
		
	});
	
	it('does not suggest such keywords twice', function () {
		
		$('.CodeMirror-hints li:nth-child(3)').trigger('click');
		CodeMirror.commands.autocomplete(editor);
		expect($('.CodeMirror-hints li').length).toBeLessThan(10);
		
	});
});

function insertTextAtCursor(text) {
    var doc = editor.getDoc();
    var cursor = doc.getCursor();
    doc.replaceRange(text, cursor);
}