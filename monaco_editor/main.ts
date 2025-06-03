import './style.css'
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { buildWrapperConfig } from './config';
import { MonacoEditorLanguageClientWrapper } from 'monaco-editor-wrapper';

async function setup() {
	const wrapper = new MonacoEditorLanguageClientWrapper();
	const wrapperConfig = await buildWrapperConfig(document.getElementById('editor')!, "");
	await wrapper.initAndStart(wrapperConfig);
}

setup()
