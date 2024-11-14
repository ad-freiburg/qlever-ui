import init, { format_raw } from 'sparql-language-server/sparql_language_server_web.js';
import wasmModule from 'sparql-language-server/sparql_language_server_web_bg.wasm';

console.info("Loading WebAssembly module...")
wasmModule().then((mod) => {
	console.info("Initializing WebAssembly module...")
	init(mod).then(() => console.log("WebAssembly module ready!"))
});

function format(text) {

	return format_raw(text);
	// return "foo"
}

export { format }
