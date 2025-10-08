// ┌─────────────────────────────────┐ \\
// │ Copyright © 2025 Ioannis Nezis  │ \\
// ├─────────────────────────────────┤ \\
// │ Licensed under the MIT license. │ \\
// └─────────────────────────────────┘ \\

import * as monaco from 'monaco-editor';
import { executeQuery } from '../network/execute';
import { FormattingResult, JumpResult } from '../types/lsp_messages';
import { Edit } from '../types/monaco';
import { EditorApp } from 'monaco-languageclient/editorApp';
import { LanguageClientWrapper } from 'monaco-languageclient/lcwrapper';
import { MonacoLanguageClient } from 'monaco-languageclient';

export function setup_key_bindings(editorApp: EditorApp, languageClient: MonacoLanguageClient) {
  const editor = editorApp.getEditor()!;
  // const languageClient = wrapper?.getLanguageClient("sparql")!;

  // NOTE: execute query on Ctrl + Enter
  editor.addAction({
    id: 'Execute Query',
    label: 'Execute',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
    contextMenuGroupId: 'navigation',
    contextMenuOrder: 1.5,
    run() {
      executeQuery(editorApp, languageClient)
    }
  });

  // NOTE format on Ctrl + f
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
    editor.getAction("editor.action.formatDocument")!.run();
  });

  // NOTE:jump to next or prev position (Alt + n, Alt + p)
  monaco.editor.addCommand({
    id: 'jumpToNextPosition',
    run: (_get, args) => {
      console.log(args);
      // NOTE: Format document
      languageClient
        .sendRequest('textDocument/formatting', {
          textDocument: { uri: editor.getModel()!.uri.toString() },
          options: {
            tabSize: 2,
            insertSpaces: true
          }
        })
        .then((response) => {
          const jumpResult = response as FormattingResult;
          const edits: Edit[] = jumpResult.map((edit) => {
            return {
              range: new monaco.Range(
                edit.range.start.line + 1,
                edit.range.start.character + 1,
                edit.range.end.line + 1,
                edit.range.end.character + 1
              ),
              text: edit.newText
            };
          });
          editor.getModel()!.applyEdits(edits);

          // NOTE: request jump position
          const cursorPosition = editor.getPosition()!;
          languageClient.getLanguageClient()!
            .sendRequest('qlueLs/jump', {
              textDocument: { uri: editor.getModel()?.uri.toString() },
              position: {
                line: cursorPosition.lineNumber - 1,
                character: cursorPosition.column - 1
              },
              previous: args === 'prev'
            })
            .then((response) => {
              // NOTE: move cursor
              if (response) {

                const typedResponse = response as JumpResult;
                const newCursorPosition = {
                  lineNumber: typedResponse.position.line + 1,
                  column: typedResponse.position.character + 1
                };
                if (typedResponse.insertAfter) {
                  editor.executeEdits('jumpToNextPosition', [
                    {
                      range: new monaco.Range(
                        newCursorPosition.lineNumber,
                        newCursorPosition.column,
                        newCursorPosition.lineNumber,
                        newCursorPosition.column
                      ),
                      text: typedResponse.insertAfter
                    }
                  ]);
                }
                editor.setPosition(newCursorPosition, 'jumpToNextPosition');
                if (typedResponse.insertBefore) {
                  editor.getModel()?.applyEdits([
                    {
                      range: new monaco.Range(
                        newCursorPosition.lineNumber,
                        newCursorPosition.column,
                        newCursorPosition.lineNumber,
                        newCursorPosition.column
                      ),
                      text: typedResponse.insertBefore
                    }
                  ]);
                }
              }
            });
        });
      editor.trigger('jumpToNextPosition', 'editor.action.formatDocument', {});
    }
  });
  monaco.editor.addKeybindingRule({
    command: 'jumpToNextPosition',
    commandArgs: 'next',
    keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.Comma
  });
  monaco.editor.addKeybindingRule({
    command: 'jumpToNextPosition',
    commandArgs: 'prev',
    keybinding: monaco.KeyMod.Alt | monaco.KeyCode.Minus
  });
}
