import { executeQuery } from "./network/execute";
import { EditorAndLanguageClient } from './types/monaco';

export function setup_buttons(editorAndLanguageClient: EditorAndLanguageClient) {
  // NOTE: Format button
  document.getElementById("formatButton")!
    .addEventListener("click", () => {
      editorAndLanguageClient.editorApp.getEditor()!.trigger("button", "editor.action.formatDocument", {});
    });

  // NOTE: Query Examples
  document.querySelectorAll(".queryExample")!
    .forEach(element => {
      element.addEventListener("click", () => {
        editorAndLanguageClient.editorApp.getEditor()!.setValue(element.getAttribute("value")!)
        editorAndLanguageClient.editorApp.getEditor()!.focus();
      });
    });

  // NOTE: Execute button
  document.getElementById("exebtn")!
    .addEventListener("click", () => {
      executeQuery(editorAndLanguageClient.editorApp, editorAndLanguageClient.languageClient);
    });
}
