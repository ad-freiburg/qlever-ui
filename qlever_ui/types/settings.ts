export interface FormatSettings {
  alignPrefixes: boolean;
  alignPredicates: boolean;
  separatePrologue: boolean;
  capitalizeKeywords: boolean;
  insertSpaces: boolean;
  tabSize: number
  whereNewLine: boolean;
  filterSameLine: boolean;
}

export interface CompletionSettings {
  timeoutMs: number
  resultSizeLimit: number
}

export interface PrefixSettings {
  addMissing: boolean;
  removeUnused: boolean;
}

export interface Settings {
  format: FormatSettings;
  completion: CompletionSettings;
  prefixes: PrefixSettings;
}


export interface MonacoSettings {
  vimMode: boolean;
}
