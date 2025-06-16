export interface Position {
  line: number,
  character: number
}

export interface Range {
  start: Position,
  end: Position
}


export interface TextEdit {
  range: Range,
  newText: string,
}

export type FormattingResult = TextEdit[];

export interface IdentifyOperationTypeResult {
  operationType: OperationType
}
export enum OperationType {
  Query = "Query",
  Update = "Update",
  Unknown = "Unknown"
}

export interface JumpResult {
  position: Position,
  insertBefore?: string,
  insertAfter?: string,
}
