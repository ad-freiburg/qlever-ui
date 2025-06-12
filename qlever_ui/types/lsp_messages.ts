export interface IdentifyOperationTypeResult {
  operationType: OperationType
}
export enum OperationType {
  Query = "Query",
  Update = "Update",
  Unknown = "Unknown"
}
