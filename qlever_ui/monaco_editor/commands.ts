// ┌─────────────────────────────────┐ \\
// │ Copyright © 2025 Ioannis Nezis  │ \\
// ├─────────────────────────────────┤ \\
// │ Licensed under the MIT license. │ \\
// └─────────────────────────────────┘ \\

import * as monaco from 'monaco-editor';
import { MonacoEditorLanguageClientWrapper } from 'monaco-editor-wrapper/.';

export function setup_commands(wrapper: MonacoEditorLanguageClientWrapper) {
	monaco.editor.addCommand({
		id: 'triggerNewCompletion',
		run: () => {
			wrapper.getEditor()!.trigger('editor', 'editor.action.triggerSuggest', {});
		}
	});
}
