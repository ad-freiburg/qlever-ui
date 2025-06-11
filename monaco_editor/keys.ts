import * as monaco from 'monaco-editor';
import { MonacoEditorLanguageClientWrapper } from "monaco-editor-wrapper/.";

export function setup_key_bindings(wrapper: MonacoEditorLanguageClientWrapper) {

	wrapper.getEditor()!.addAction({
		id: 'Execute Query',
		label: 'Execute',
		keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
		contextMenuGroupId: 'navigation',
		contextMenuOrder: 1.5,
		run(editor, ...args) {
			console.log("execute");

		}
	});
}
