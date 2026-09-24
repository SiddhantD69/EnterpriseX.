export type AuditStatus =
  | "SUCCESS"
  | "FAILURE";

export type AuditEvent = {
  id: string;
  occurredAt: string;

  actorUserId: string | null;

  organizationId: string | null;
  companyId: string | null;

  action: string;

  entityType: string;
  entityId: string | null;

  status: AuditStatus;

  beforeData: unknown | null;
  afterData: unknown | null;

  requestId: string | null;
  correlationId: string | null;

  sourceModule: string;

  metadata: unknown | null;

  createdAt: string;
};
