import {
  findDefinitionByKey,
  findValue,
} from "../infrastructure/configuration-repository.js";

import type {
  ConfigurationScopeType,
  ResolvedConfiguration,
} from "../domain/configuration.js";

export const getConfiguration = async (
  key: string,
  scopeType: ConfigurationScopeType,
  scopeId: string | null,
): Promise<ResolvedConfiguration | null> => {
  const definition =
    await findDefinitionByKey(key);

  if (!definition) {
    return null;
  }

  const value = await findValue(
    definition.id,
    scopeType,
    scopeId,
  );

  if (value) {
    return {
      key: definition.key,
      dataType: definition.dataType,
      value: value.value,
      source: scopeType,
    };
  }

  if (definition.defaultValue !== null) {
    return {
      key: definition.key,
      dataType: definition.dataType,
      value: definition.defaultValue,
      source: "DEFAULT",
    };
  }

  return {
    key: definition.key,
    dataType: definition.dataType,
    value: null,
    source: "DEFAULT",
  };
};
