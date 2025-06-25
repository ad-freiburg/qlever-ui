import { MonacoEditorLanguageClientWrapper } from "monaco-editor-wrapper/.";
import { MonacoSettings, Settings } from "../types/settings";
import { initVimMode } from 'monaco-vim';
import { editor } from "monaco-editor";
import yaml from 'yaml';
import qlue_ls_config from "../../qlue-ls.yaml?raw";

export function setup_settings(wrapper: MonacoEditorLanguageClientWrapper) {
  const languageClient = wrapper.getLanguageClient("sparql")!;
  let vimMode;
  const settings: Settings = yaml.parse(qlue_ls_config);

  // NOTE:fetch default settings or apply stored settings
  const storedQlueLsSettings = localStorage.getItem("Qlue-ls settings");
  if (storedQlueLsSettings) {
    initialize_ui(JSON.parse(storedQlueLsSettings));
    languageClient.sendNotification("qlueLs/changeSettings", JSON.parse(storedQlueLsSettings))
      .catch((err) => {
        console.error('Error during changeSettings: ', err);
      });
  } else {
    initialize_ui(settings);
    languageClient.sendNotification("qlueLs/changeSettings", settings)
      .then(() => {
        localStorage.setItem("Qlue-ls settings", JSON.stringify(settings));
      })
      .catch((err) => {
        console.error('Error during changeSettings: ', err);
      });
  };
  const storedMonacoSettings = localStorage.getItem("Monaco settings");
  if (storedMonacoSettings) {
    const moacoSettings = JSON.parse(storedMonacoSettings) as MonacoSettings;
    setBoolValue("vimMode", moacoSettings.vimMode)
  } else {
    setBoolValue("vimMode", false)
  };
  if (getBoolValue("vimMode")) {
    vimMode = initVimMode(wrapper.getEditor()!, document.getElementById("statusBar"));
  }

  // NOTE:change settings on ui changes
  const ids = ["alignPrefixes", "alignPredicates", "separatePrologue", "capitalizeKeywords", "insertSpaces", "tabSize", "whereNewLine", "filterSameLine", "timeoutMs", "resultSizeLimit", "addMissing", "removeUnused"];
  ids.forEach((id) => {
    document.getElementById(id)!.addEventListener("change", () => {

      const ui_settings: Settings = {
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
        },
        replacements: settings.replacements
      };
      languageClient.sendNotification("qlueLs/changeSettings", ui_settings).then(() => {
        localStorage.setItem("Qlue-ls settings", JSON.stringify(ui_settings));
      });
    });
  });
  document.getElementById("vimMode")!.addEventListener("change", () => {
    const settings: MonacoSettings = {
      vimMode: getBoolValue("vimMode")
    };
    if (settings.vimMode) {
      vimMode = initVimMode(wrapper.getEditor()!, document.getElementById("statusBar"));
    } else {
      vimMode.dispose();
    }
    localStorage.setItem("Monaco settings", JSON.stringify(settings));
  });

  // NOTE: reset settings
  document.getElementById("resetSettings")!.addEventListener("click", () => {

    initialize_ui(settings);
    languageClient.sendNotification("qlueLs/changeSettings", settings)
      .then(() => {
        localStorage.setItem("Qlue-ls settings", JSON.stringify(settings));
      })
      .catch((err) => {
        console.error('Error during changeSettings: ', err);
      });
    setBoolValue("vimMode", false);
  });
}

function initialize_ui(settings: Settings) {
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
