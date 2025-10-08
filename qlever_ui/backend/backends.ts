// ┌─────────────────────────────────┐ \\
// │ Copyright © 2025 Ioannis Nezis  │ \\
// ├─────────────────────────────────┤ \\
// │ Licensed under the MIT license. │ \\
// └─────────────────────────────────┘ \\

import { BackendConfig } from "../types/backend";
import yaml from 'yaml';
import { EditorAndLanguageClient } from "../types/monaco";
import { MonacoLanguageClient } from "monaco-languageclient";

export async function configure_backends(editorAndLanguageClient: EditorAndLanguageClient) {
  const slug = window.location.pathname.substr(1).split("/")[0];

  const backends = await fetch("/api/backends/")
    .then(response => {
      return response.json();
    })
    .then(json => {
      return json
    }).catch(err => {
      console.error("An error occured while fetching backends\n", err);
    });

  configureBackendsSelector(backends, slug);


  backends.forEach(async (backend) => {
    const config = await fetch(backend.url)
      .then(response => response.json())
      .then(json => {
        const backend = {
          name: json.name,
          slug: json.slug,
          url: json.baseUrl,
        };
        const prefixMap = json.prefixMap;
        const queries = {
          subjectCompletion: json["suggestSubjectsContextInsensitive"],
          predicateCompletion: json["suggestObjectsContextInsensitive"],
          objectCompletion: json["suggestObjectsContextInsensitive"],
          predicateCompletionContextSensitive: json["suggestPredicates"],
          objectCompletionContextSensitive: json["suggestObjects"]
        };
        return {
          backend: backend,
          prefixMap: prefixMap,
          queries: queries,
          default: backend.slug === slug
        }
      });
    addBackend(editorAndLanguageClient.languageClient, config);
  });

}

function addBackend(languageClient: MonacoLanguageClient, conf: BackendConfig) {
  languageClient
    .sendRequest('qlueLs/addBackend', conf)
    .catch((err) => {
      console.error(err);
    });
}


export function configureBackendsSelector(backendConfigurations, slug) {
  const backendsSelectionList = document.getElementById("backendSelectionList")!;
  const backendsSelectionListButton = document.getElementById("backendDisplay")!;
  backendConfigurations.forEach((backend) => {
    const a = document.createElement("a");
    a.textContent = backend.name;
    a.href = `/${backend.slug}`;
    const li = document.createElement("li");
    li.appendChild(a);
    backendsSelectionList.appendChild(li);
    if (backend.slug === slug) {
      backendsSelectionListButton.textContent = backend.name;
    }
  });
}
