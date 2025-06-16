// ┌─────────────────────────────────┐ \\
// │ Copyright © 2025 Ioannis Nezis  │ \\
// ├─────────────────────────────────┤ \\
// │ Licensed under the MIT license. │ \\
// └─────────────────────────────────┘ \\

import './style.css'
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { initVimMode } from 'monaco-vim';
import { buildWrapperConfig } from './config/config';
import { MonacoEditorLanguageClientWrapper } from 'monaco-editor-wrapper';
import { setup_key_bindings } from './keys';
import { setup_commands } from './commands';
import { setup_settings } from './settings';

export async function init(container_id: string): Promise<MonacoEditorLanguageClientWrapper> {
	const editorContainer = document.getElementById(container_id);
	if (editorContainer) {
		const wrapper = new MonacoEditorLanguageClientWrapper();
		const wrapperConfig = await buildWrapperConfig(editorContainer, "");
		await wrapper.initAndStart(wrapperConfig);
		setup_key_bindings(wrapper);
		setup_commands(wrapper);
		setup_settings(wrapper);
		initVimMode(wrapper.getEditor()!, document.getElementById("statusBar"));
		editorContainer.style.removeProperty("display")
		document.getElementById("loadingScreen")?.remove();
		return wrapper;
	} else {
		throw new Error(`No element with id: "${container_id}" found`);
	}
}

