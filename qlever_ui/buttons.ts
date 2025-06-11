import { MonacoEditorLanguageClientWrapper } from "monaco-editor-wrapper/.";
import { executeQuery } from "./network/execute";

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
      executeQuery(wrapper)
    });
}
