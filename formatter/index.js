import { format_raw } from "@ioannisnezis/sparql-language-server"

const formatButton = document.getElementById("formatButton");
formatButton.addEventListener('click', () => {

	editor.setValue(format_raw(editor.getValue()));
})
