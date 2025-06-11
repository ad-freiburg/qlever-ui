// QLUE-LS
import init1, { format_raw, determine_operation_type } from 'qlue-ls';
import wasmModule1 from 'qlue-ls/qlue_ls_bg.wasm'

wasmModule1().then((mod) => {
  console.debug("Initializing WebAssembly module...")
  init1({"module_or_path": mod})
});

function format(text) {
  return format_raw(text);
}

function determineOperationType(text) {
  return determine_operation_type(text);
}


// LL-SPARQL-PARSER
import init2, { get_parse_tree } from 'll-sparql-parser';
import wasmModule2 from 'll-sparql-parser/ll_sparql_parser_bg.wasm'

wasmModule2().then((mod) => {
  console.debug("Initializing WebAssembly module...")
  init2({"module_or_path": mod})
});

function parse(text) {
  return get_parse_tree(text);
}

export { format, determineOperationType, parse };
