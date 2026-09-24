export type ConfigurationDataType =
  | "STRING"
  | "INTEGER"
  | "DECIMAL"
  | "BOOLEAN"
  | "DATE"
  | "DATETIME"
  | "JSON";

export type ConfigurationScopeType =
  | "SYSTEM"
  | "ORGANIZATION"
  | "COMPANY";

export type ConfigurationStatus =
  | "ACTIVE"
  | "INACTIVE";

export type ConfigurationDefinition = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  ownerModule: string;
  dataType: ConfigurationDataType;
  defaultValue: string | null;
  status: ConfigurationStatus;
};

export type ConfigurationValue = {
  id: string;
  configurationDefinitionId: string;
  scopeType: ConfigurationScopeType;
  scopeId: string | null;
  value: string | null;
};

export type ResolvedConfiguration = {
  key: string;
  dataType: ConfigurationDataType;
  value: string | null;
  source:
    | ConfigurationScopeType
    | "DEFAULT";
};
