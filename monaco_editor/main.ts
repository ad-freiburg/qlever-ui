import './style.css'
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { buildWrapperConfig } from './config/config';
import { MonacoEditorLanguageClientWrapper } from 'monaco-editor-wrapper';
import { setup_buttons } from './qleverUI';
import { setup_key_bindings } from './keys';

async function setup_editor() {
	const wrapper = new MonacoEditorLanguageClientWrapper();
	const wrapperConfig = await buildWrapperConfig(document.getElementById('editor')!, "");
	await wrapper.initAndStart(wrapperConfig);
	setup_buttons(wrapper);
	setup_key_bindings(wrapper);
}

setup_editor()
