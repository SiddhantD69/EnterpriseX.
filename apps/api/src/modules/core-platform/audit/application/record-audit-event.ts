import type { PoolClient } from "pg";

import {
  createAuditEvent,
  type CreateAuditEventInput,
} from "../infrastructure/audit-repository.js";

import type {
  AuditEvent,
} from "../domain/audit-event.js";

export const recordAuditEvent = async (
  input: CreateAuditEventInput,
  client?: PoolClient,
): Promise<AuditEvent> => {
  const result = await createAuditEvent(input, client);

  return {
    ...result,
    occurredAt:
      result.occurredAt.toISOString(),
    createdAt:
      result.createdAt.toISOString(),
  };
};