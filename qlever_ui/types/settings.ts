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

export interface Replacement {
  pattern: string,
  replacement: string
}

export interface Replacements {
  objectVariable: Replacement[];
}

export interface Settings {
  format: FormatSettings;
  completion: CompletionSettings;
  prefixes: PrefixSettings;
  replacements?: Replacements
}


export interface MonacoSettings {
  vimMode: boolean;
}
