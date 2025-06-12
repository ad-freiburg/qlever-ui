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
  const ids = ["alignPrefixes", "alignPredicates", "separateProlouge", "capitalizeKeywords", "insertSpaces", "tabSize", "whereNewLine", "filterSameLine", "timeoutMs", "resultSizeLimit", "addMissing", "removeUnused"];
  ids.forEach((id) => {
    document.getElementById(id)!.addEventListener("change", () => {

      const settings: Settings = {
        format: {
          alignPrefixes: getBoolValue("alignPrefixes"),
          alignPredicates: getBoolValue("alignPredicates"),
          capitalizeKeywords: getBoolValue("capitalizeKeywords"),
          filterSameLine: getBoolValue("filterSameLine"),
          insertSpaces: getBoolValue("insertSpaces"),
          separateProlouge: getBoolValue("separateProlouge"),
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
      console.log(response);
      const settings = response as Settings;
      initialize_ui(settings);
      languageClient.sendNotification("qlueLs/changeSettings", settings).then(() => {
        localStorage.setItem("Qlue-ls settings", JSON.stringify(settings));
      });
    });
  });
}

function initialize_ui(settings: Settings) {
  console.log(settings);

  // NOTE: format settings
  document.getElementById("alignPrefixes")?.toggleAttribute("checked", settings.format.alignPrefixes);
  document.getElementById("alignPredicates")?.toggleAttribute("checked", settings.format.alignPredicates);
  document.getElementById("separateProlouge")?.toggleAttribute("checked", settings.format.separateProlouge);
  document.getElementById("capitalizeKeywords")?.toggleAttribute("checked", settings.format.capitalizeKeywords);
  document.getElementById("insertSpaces")?.toggleAttribute("checked", settings.format.insertSpaces);
  document.getElementById("tabSize")?.setAttribute("value", settings.format.tabSize.toString());
  document.getElementById("whereNewLine")?.toggleAttribute("checked", settings.format.whereNewLine);
  document.getElementById("filterSameLine")?.toggleAttribute("checked", settings.format.filterSameLine);

  // NOTE: completion settings
  document.getElementById("timeoutMs")?.setAttribute("value", settings.completion.timeoutMs.toString());
  document.getElementById("resultSizeLimit")?.setAttribute("value", settings.completion.resultSizeLimit.toString());

  // NOTE: prefix settings
  document.getElementById("addMissing")?.toggleAttribute("checked", settings.prefixes.addMissing);
  document.getElementById("removeUnused")?.toggleAttribute("checked", settings.prefixes.removeUnused);
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
