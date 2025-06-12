import { MonacoEditorLanguageClientWrapper } from "monaco-editor-wrapper/.";
import { Settings } from "../types/settings";

export function setup_settings(wrapper: MonacoEditorLanguageClientWrapper) {
  const languageClient = wrapper.getLanguageClient("sparql")!;

  // NOTE:fetch default settings or apply stored settings
  const storedSettings = localStorage.getItem("Qlue-ls settings");
  if (storedSettings) {
    const settings = JSON.parse(storedSettings);
    initialize_ui(settings);
  } else {
    languageClient.sendRequest("qlueLs/defaultSettings").then((response) => {
      const settings = response as Settings;
      initialize_ui(settings);
    })
  };

  // NOTE:change settings on ui changes
  const ids = ["alignPrefixes", "alignPredicates", "separatePrologue", "capitalizeKeywords", "insertSpaces", "tabSize", "whereNewLine", "filterSameLine", "timeoutMs", "resultSizeLimit", "addMissing", "removeUnused"];
  ids.forEach((id) => {
    document.getElementById(id)!.addEventListener("change", () => {

      const settings: Settings = {
        format: {
          alignPrefixes: getBoolValue("alignPrefixes"),
          alignPredicates: getBoolValue("alignPredicates"),
          capitalizeKeywords: getBoolValue("capitalizeKeywords"),
          filterSameLine: getBoolValue("filterSameLine"),
          insertSpaces: getBoolValue("insertSpaces"),
          separatePrologue: getBoolValue("separatePrologue"),
          tabSize: getNumValue("tabSize"),
          whereNewLine: getBoolValue("whereNewLine"),
        },
        completion: {
          resultSizeLimit: getNumValue("resultSizeLimit"),
          timeoutMs: getNumValue("timeoutMs"),
        },
        prefixes: {
          addMissing: getBoolValue("addMissing"),
          removeUnused: getBoolValue("removeUnused"),
        }
      };
      languageClient.sendNotification("qlueLs/changeSettings", settings).then(() => {
        localStorage.setItem("Qlue-ls settings", JSON.stringify(settings));
      });
    });
  });

  // NOTE: reset settings
  document.getElementById("resetSettings")!.addEventListener("click", () => {
    languageClient.sendRequest("qlueLs/defaultSettings").then((response) => {
      const settings = response as Settings;
      initialize_ui(response as Settings);
      languageClient.sendNotification("qlueLs/changeSettings", settings).then(() => {
        localStorage.setItem("Qlue-ls settings", JSON.stringify(settings));
      });
    });
  });
}

function initialize_ui(settings: Settings) {
  console.log(settings);

  // NOTE: format settings
  setBoolValue("alignPrefixes", settings.format.alignPredicates);
  setBoolValue("alignPredicates", settings.format.alignPredicates);
  setBoolValue("separatePrologue", settings.format.separatePrologue);
  setBoolValue("capitalizeKeywords", settings.format.capitalizeKeywords);
  setBoolValue("insertSpaces", settings.format.insertSpaces);
  setNumValue("tabSize", settings.format.tabSize);
  setBoolValue("whereNewLine", settings.format.whereNewLine);
  setBoolValue("filterSameLine", settings.format.filterSameLine);

  // NOTE: completion settings
  setNumValue("timeoutMs", settings.completion.timeoutMs);
  setNumValue("resultSizeLimit", settings.completion.resultSizeLimit);

  // NOTE: prefix settings
  setBoolValue("addMissing", settings.prefixes.addMissing);
  setBoolValue("removeUnused", settings.prefixes.removeUnused);
}


function setBoolValue(id: string, value: boolean) {
  const checkbox = document.getElementById(id) as HTMLInputElement;
  return checkbox.checked = value;
}

function setNumValue(id: string, value: number) {
  const checkbox = document.getElementById(id) as HTMLInputElement;
  return checkbox.valueAsNumber = value;
}

function getBoolValue(id: string): boolean {
  const checkbox = document.getElementById(id) as HTMLInputElement;
  return checkbox.checked;
}

function getNumValue(id: string): number {
  const input = document.getElementById(id) as HTMLInputElement;
  const value = input.valueAsNumber;
  return value;
}
