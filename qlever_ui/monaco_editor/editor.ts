// ┌─────────────────────────────────┐ \\
// │ Copyright © 2025 Ioannis Nezis  │ \\
// ├─────────────────────────────────┤ \\
// │ Licensed under the MIT license. │ \\
// └─────────────────────────────────┘ \\

import './style.css'
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { buildWrapperConfig } from './config/config';
import { MonacoEditorLanguageClientWrapper } from 'monaco-editor-wrapper';
import { setup_key_bindings } from './keys';

export async function init(container_id: string): Promise<MonacoEditorLanguageClientWrapper> {
	const editorContainer = document.getElementById(container_id);
	if (editorContainer) {
		const wrapper = new MonacoEditorLanguageClientWrapper();
		const wrapperConfig = await buildWrapperConfig(editorContainer, "");
		await wrapper.initAndStart(wrapperConfig);
		setup_key_bindings(wrapper);
		return wrapper;
	} else {
		throw new Error(`No element with id: "${container_id}" found`);
	}
}

