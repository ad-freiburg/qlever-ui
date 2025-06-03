import { MonacoEditorLanguageClientWrapper } from "monaco-editor-wrapper/.";

export function setup_buttons(wrapper: MonacoEditorLanguageClientWrapper) {
  let formatButton = document.getElementById("formatButton");
  if (formatButton != undefined) {
    formatButton.addEventListener("click", () => {
      wrapper.getEditor()!.trigger("button", "editor.action.formatDocument", {});
    });
  }
}
