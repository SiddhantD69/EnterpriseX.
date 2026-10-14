import { db } from "../../../../infrastructure/database/pool.js";
import type { PoolClient } from "pg";

import type {
  ListAuditEventsInput,
} from "../application/list-audit-events.js";

export type CreateAuditEventInput = {
  actorUserId?: string | null;
  organizationId?: string | null;
  companyId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  status?: "SUCCESS" | "FAILURE";
  beforeData?: unknown;
  afterData?: unknown;
  requestId?: string | null;
  correlationId?: string | null;
  sourceModule: string;
  metadata?: unknown;
};

type AuditEventRow = {
  id: string;
  occurred_at: Date;
  actor_user_id: string | null;
  organization_id: string | null;
  company_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  status: "SUCCESS" | "FAILURE";
  before_data: unknown;
  after_data: unknown;
  request_id: string | null;
  correlation_id: string | null;
  source_module: string;
  metadata: unknown;
  created_at: Date;
};

const mapAuditEvent = (
  row: AuditEventRow,
) => ({
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
  client?: PoolClient,
) => {
  const result =
    await (client ?? db).query<AuditEventRow>(
      `
        INSERT INTO core.audit_events (
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
          $13
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
        input.actorUserId ?? null,
        input.organizationId ?? null,
        input.companyId ?? null,
        input.action,
        input.entityType,
        input.entityId ?? null,
        input.status ?? "SUCCESS",
        input.beforeData ?? null,
        input.afterData ?? null,
        input.requestId ?? null,
        input.correlationId ?? null,
        input.sourceModule,
        input.metadata ?? null,
      ],
    );

  return mapAuditEvent(
    result.rows[0],
  );
};

export const findAuditEvents = async (
  input: ListAuditEventsInput,
) => {
  const conditions: string[] = [
    "organization_id = $1",
    "company_id = $2",
  ];

  const values: unknown[] = [
    input.organizationId,
    input.companyId,
  ];

  let parameterIndex = 3;

  if (input.action) {
    conditions.push(
      `action = $${parameterIndex}`,
    );

    values.push(input.action);
    parameterIndex += 1;
  }

  if (input.entityType) {
    conditions.push(
      `entity_type = $${parameterIndex}`,
    );

    values.push(input.entityType);
    parameterIndex += 1;
  }

  if (
    input.status === "SUCCESS" ||
    input.status === "FAILURE"
  ) {
    conditions.push(
      `status = $${parameterIndex}`,
    );

    values.push(input.status);
    parameterIndex += 1;
  }

  values.push(input.limit);
  const limitParameter = parameterIndex;
  parameterIndex += 1;

  values.push(input.offset);
  const offsetParameter = parameterIndex;

  const result =
    await db.query<AuditEventRow>(
      `
        SELECT
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
        FROM core.audit_events
        WHERE ${conditions.join(" AND ")}
        ORDER BY occurred_at DESC
        LIMIT $${limitParameter}
        OFFSET $${offsetParameter}
      `,
      values,
    );

  return result.rows.map(
    mapAuditEvent,
  );
};