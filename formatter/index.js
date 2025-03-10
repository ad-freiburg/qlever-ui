import init, { format_raw, determine_operation_type } from 'qlue-ls';
import wasmModule from 'qlue-ls/qlue_ls_bg.wasm'

console.info("Loading WebAssembly module...")
wasmModule().then((mod) => {
	console.info("Initializing WebAssembly module...")
	init(mod).then(() => console.log("WebAssembly module ready!"))
});

function format(text) {
	return format_raw(text);
}

function determineOperationType(text) {
	return determine_operation_type(text);
}

export { format, determineOperationType }
