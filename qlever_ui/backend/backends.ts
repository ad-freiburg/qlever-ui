// ┌─────────────────────────────────┐ \\
// │ Copyright © 2025 Ioannis Nezis  │ \\
// ├─────────────────────────────────┤ \\
// │ Licensed under the MIT license. │ \\
// └─────────────────────────────────┘ \\

import { MonacoEditorLanguageClientWrapper } from "monaco-editor-wrapper/.";
import { BackendConfig } from "../types/backend";
import yaml from 'yaml';
import backendConfigurations from "./backends.yaml?raw";

declare const SLUG: string;

export function configure_backends(wrapper: MonacoEditorLanguageClientWrapper) {
  const backends = yaml.parse(backendConfigurations)
  backends.forEach((backend) => {
    backend.default = backend.backend.slug === SLUG;
    addBackend(wrapper, backend);
  });
  configureBackendsSelector(wrapper, backends);
}

function addBackend(wrapper: MonacoEditorLanguageClientWrapper, conf: BackendConfig) {
  wrapper
    .getLanguageClient('sparql')!
    .sendRequest('qlueLs/addBackend', conf)
    .catch((err) => {
      console.error(err);
    });
}


export function configureBackendsSelector(wrapper: MonacoEditorLanguageClientWrapper, backendConfigurations: BackendConfig[]) {
  const backendsSelectionList = document.getElementById("backendSelectionList")!;
  const backendsSelectionListButton = document.getElementById("backendDisplay")!;
  backendConfigurations.forEach((backendConfiguration) => {
    const a = document.createElement("a");
    a.textContent = backendConfiguration.backend.name;
    a.href = `/${backendConfiguration.backend.slug}`;
    const li = document.createElement("li");
    li.appendChild(a);
    backendsSelectionList.appendChild(li);
    if (backendConfiguration.backend.slug === SLUG) {
      backendsSelectionListButton.textContent = backendConfiguration.backend.name;
    }
  });
}
