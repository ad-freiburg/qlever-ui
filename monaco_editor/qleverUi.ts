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
}
