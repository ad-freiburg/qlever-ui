// ┌─────────────────────────────────┐ \\
// │ Copyright © 2025 Ioannis Nezis  │ \\
// ├─────────────────────────────────┤ \\
// │ Licensed under the MIT license. │ \\
// └─────────────────────────────────┘ \\

import * as monaco from 'monaco-editor';
import { EditorApp } from 'monaco-languageclient/editorApp';

export function setup_commands(editorApp: EditorApp) {
	monaco.editor.addCommand({
		id: 'triggerNewCompletion',
		run: () => {
			editorApp.getEditor()!.trigger('editor', 'editor.action.triggerSuggest', {});
		}
	});
}
