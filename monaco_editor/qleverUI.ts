import { MonacoEditorLanguageClientWrapper } from "monaco-editor-wrapper/.";

export function setup_buttons(wrapper: MonacoEditorLanguageClientWrapper) {
  // NOTE: Format button
  document.getElementById("formatButton")!
    .addEventListener("click", () => {
      wrapper.getEditor()!.trigger("button", "editor.action.formatDocument", {});
    });

  // NOTE: Query Examples
  document.querySelectorAll(".queryExample")!
    .forEach(element => {
      element.addEventListener("click", () => {
        wrapper.getEditor()!.setValue(element.getAttribute("value")!)
        wrapper.getEditor()!.focus();
      });
    });

  // NOTE: Execute button
  document.getElementById("exebtn")!
    .addEventListener("click", () => {
      // TODO:
    });
}



// 1. Call processQuery (sends query to backend + displays results).
// 2. Add query hash to URL.
function executeQuery(query) {

}
