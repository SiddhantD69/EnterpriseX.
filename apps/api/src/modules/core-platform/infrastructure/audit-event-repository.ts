import { randomUUID } from "node:crypto";

import { db } from "../../../infrastructure/database/pool.js";
import type {
  AuditEvent,
  CreateAuditEventInput,
  AuditEventStatus,
} from "../domain/audit-event.js";

type AuditEventRow = {
  id: string;
  occurred_at: Date;
  actor_user_id: string | null;
  organization_id: string | null;
  company_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  status: AuditEventStatus;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  request_id: string | null;
  correlation_id: string | null;
  source_module: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
};

const mapAuditEvent = (
  row: AuditEventRow,
): AuditEvent => ({
  id: row.id,
  occurredAt: row.occurred_at,
  actorUserId: row.actor_user_id,
  organizationId: row.organization_id,
  companyId: row.company_id,
  action: row.action,
  entityType: row.entity_type,
  entityId: row.entity_id,
  status: row.status,
  beforeData: row.before_data,
  afterData: row.after_data,
  requestId: row.request_id,
  correlationId: row.correlation_id,
  sourceModule: row.source_module,
  metadata: row.metadata,
  createdAt: row.created_at,
});

export const createAuditEvent = async (
  input: CreateAuditEventInput,
): Promise<AuditEvent> => {
  const id = randomUUID();

  const result = await db.query<AuditEventRow>(
    `
      INSERT INTO core.audit_events (
        id,
        actor_user_id,
        organization_id,
        company_id,
        action,
        entity_type,
        entity_id,
        status,
        before_data,
        after_data,
        request_id,
        correlation_id,
        source_module,
        metadata
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14
      )
      RETURNING
        id,
        occurred_at,
        actor_user_id,
        organization_id,
        company_id,
        action,
        entity_type,
        entity_id,
        status,
        before_data,
        after_data,
        request_id,
        correlation_id,
        source_module,
        metadata,
        created_at
    `,
    [
      id,
      input.actorUserId ?? null,
      input.organizationId ?? null,
      input.companyId ?? null,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.status,
      input.beforeData ?? null,
      input.afterData ?? null,
      input.requestId ?? null,
      input.correlationId ?? null,
      input.sourceModule,
      input.metadata ?? null,
    ],
  );

  return mapAuditEvent(result.rows[0]);
};