import {
  findDefinitionByKey,
  upsertValue,
} from "../infrastructure/configuration-repository.js";

import type {
  ConfigurationScopeType,
  ConfigurationValue,
} from "../domain/configuration.js";

import {
  recordAuditEvent,
} from "../../audit/application/record-audit-event.js";

export const setConfiguration = async (
  key: string,
  scopeType: ConfigurationScopeType,
  scopeId: string | null,
  value: string,
  auditContext?: {
    actorUserId: string;
    organizationId: string;
    companyId: string;
  },
): Promise<ConfigurationValue> => {
  const definition =
    await findDefinitionByKey(key);

  if (!definition) {
    throw new Error(
      `Configuration definition not found: ${key}`,
    );
  }

  if (
    scopeType === "SYSTEM" &&
    scopeId !== null
  ) {
    throw new Error(
      "SYSTEM configuration cannot have a scope ID.",
    );
  }

  if (
    scopeType !== "SYSTEM" &&
    !scopeId
  ) {
    throw new Error(
      `${scopeType} configuration requires a scope ID.`,
    );
  }

  const result = await upsertValue(
    definition.id,
    scopeType,
    scopeId,
    value,
  );

  if (auditContext) {
    await recordAuditEvent({
      actorUserId:
        auditContext.actorUserId,

      organizationId:
        auditContext.organizationId,

      companyId:
        auditContext.companyId,

      action:
        "CONFIGURATION_UPDATED",

      entityType:
        "CONFIGURATION",

      entityId:
        result.currentValue.id,

      status:
        "SUCCESS",

      beforeData:
        result.previousValue
          ? {
              key,
              scopeType:
                result.previousValue.scopeType,
              scopeId:
                result.previousValue.scopeId,
              value:
                result.previousValue.value,
            }
          : null,

      afterData: {
        key,
        scopeType:
          result.currentValue.scopeType,
        scopeId:
          result.currentValue.scopeId,
        value:
          result.currentValue.value,
      },

      sourceModule:
        "core-platform",

      metadata: {
        configurationDefinitionId:
          definition.id,
      },
    });
  }

  return result.currentValue;
};
