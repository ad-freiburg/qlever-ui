import init, { format_raw } from 'qlue-ls';
import wasmModule from 'qlue-ls/qlue_ls_bg.wasm'

console.info("Loading WebAssembly module...")
wasmModule().then((mod) => {
	console.info("Initializing WebAssembly module...")
	init(mod).then(() => console.log("WebAssembly module ready!"))
});

function format(text) {
	return format_raw(text);
}

export { format }
