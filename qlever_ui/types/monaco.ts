import { Range } from "monaco-editor";
import { MonacoLanguageClient } from "monaco-languageclient";
import { EditorApp } from "monaco-languageclient/editorApp";

export interface Edit {
  /**
   * The range to replace. This can be empty to emulate a simple insert.
   */
  range: Range;
  /**
   * The text to replace with. This can be null to emulate a simple delete.
   */
  text: string | null;
  /**
   * This indicates that this operation has "insert" semantics.
   * i.e. forceMoveMarkers = true => if `range` is collapsed, all markers at the position will be moved.
   */
  forceMoveMarkers?: boolean;
}

export interface EditorAndLanguageClient {
  editorApp: EditorApp,
  languageClient: MonacoLanguageClient
}
