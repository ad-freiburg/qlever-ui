// ┌─────────────────────────────────┐ \\
// │ Copyright © 2025 Ioannis Nezis  │ \\
// ├─────────────────────────────────┤ \\
// │ Licensed under the MIT license. │ \\
// └─────────────────────────────────┘ \\

import './style.css'
import * as monaco from 'monaco-editor';
import { buildWrapperConfig } from './config/config';
import { setup_key_bindings } from './keys';
import { setup_commands } from './commands';
import { setup_settings } from './settings';
import { MonacoVscodeApiWrapper } from 'monaco-languageclient/vscodeApiWrapper';
import { LanguageClientWrapper } from 'monaco-languageclient/lcwrapper';
import { EditorApp } from 'monaco-languageclient/editorApp';
import api from 'vscode';
import { Edit } from '../types/monaco';
import { MonacoLanguageClient } from 'monaco-languageclient';
declare const PREFILL: string;

interface EditorAndLanguageClient {
	editorApp: EditorApp,
	languageClient: MonacoLanguageClient
}

export async function init(container_id: string): Promise<EditorAndLanguageClient> {
	const editorContainer = document.getElementById(container_id);
	if (editorContainer) {
		const configs = await buildWrapperConfig(editorContainer, PREFILL === "None" ? "" : PREFILL);
		// Create the monaco-vscode api Wrapper and start it before anything else
		const apiWrapper = new MonacoVscodeApiWrapper(configs.vscodeApiConfig);
		await apiWrapper.start();

		// Create language client wrapper
		const lcWrapper = new LanguageClientWrapper(configs.languageClientConfig);
		await lcWrapper.start();
		const languageClient = lcWrapper.getLanguageClient()!;

		// Create and start the editor app
		const editorApp = new EditorApp(configs.editorAppConfig);
		const htmlContainer = document.getElementById(container_id)!;
		await editorApp.start(htmlContainer);

		setup_key_bindings(editorApp, languageClient);
		setup_commands(editorApp);
		setup_settings(editorApp, languageClient);

		editorContainer.style.removeProperty("display")
		document.getElementById("loadingScreen")?.remove();

		editorApp.updateLayout();

		return {
			editorApp: editorApp,
			languageClient: languageClient,
		};
	} else {
		throw new Error(`No element with id: "${container_id}" found`);
	}
}

