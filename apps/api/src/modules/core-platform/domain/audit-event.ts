export type AuditEventStatus =
  | "SUCCESS"
  | "FAILURE";

export type AuditEvent = {
  id: string;
  occurredAt: Date;
  actorUserId: string | null;
  organizationId: string | null;
  companyId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  status: AuditEventStatus;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  requestId: string | null;
  correlationId: string | null;
  sourceModule: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

export type CreateAuditEventInput = {
  actorUserId?: string | null;
  organizationId?: string | null;
  companyId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  status: AuditEventStatus;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  requestId?: string | null;
  correlationId?: string | null;
  sourceModule: string;
  metadata?: Record<string, unknown> | null;
};