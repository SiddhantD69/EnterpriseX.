import { createAuditEvent } from "../../core-platform/infrastructure/audit-event-repository.js";

const SECURITY_SOURCE_MODULE =
  "security-identity";

export const recordLoginSuccess = async (
  input: {
    userId: string;
    organizationId?: string | null;
    companyId?: string | null;
    requestId?: string | null;
    correlationId?: string | null;
  },
): Promise<void> => {
  await createAuditEvent({
    actorUserId: input.userId,
    organizationId:
      input.organizationId ?? null,
    companyId:
      input.companyId ?? null,
    action: "LOGIN_SUCCESS",
    entityType: "USER",
    entityId: input.userId,
    status: "SUCCESS",
    requestId:
      input.requestId ?? null,
    correlationId:
      input.correlationId ?? null,
    sourceModule: SECURITY_SOURCE_MODULE,
  });
};

export const recordLoginFailure = async (
  input: {
    userId?: string | null;
    requestId?: string | null;
    correlationId?: string | null;
    reason?: string;
  },
): Promise<void> => {
  await createAuditEvent({
    actorUserId: input.userId ?? null,
    action: "LOGIN_FAILED",
    entityType: "USER",
    entityId: input.userId ?? null,
    status: "FAILURE",
    requestId:
      input.requestId ?? null,
    correlationId:
      input.correlationId ?? null,
    sourceModule: SECURITY_SOURCE_MODULE,
    metadata: input.reason
      ? {
          reason: input.reason,
        }
      : null,
  });
};

export const recordAccountLocked = async (
  input: {
    userId: string;
    requestId?: string | null;
    correlationId?: string | null;
  },
): Promise<void> => {
  await createAuditEvent({
    actorUserId: input.userId,
    action: "ACCOUNT_LOCKED",
    entityType: "USER",
    entityId: input.userId,
    status: "FAILURE",
    requestId:
      input.requestId ?? null,
    correlationId:
      input.correlationId ?? null,
    sourceModule: SECURITY_SOURCE_MODULE,
  });
};

export const recordSessionCreated = async (
  input: {
    userId: string;
    sessionId: string;
    requestId?: string | null;
    correlationId?: string | null;
  },
): Promise<void> => {
  await createAuditEvent({
    actorUserId: input.userId,
    action: "SESSION_CREATED",
    entityType: "SESSION",
    entityId: input.sessionId,
    status: "SUCCESS",
    requestId:
      input.requestId ?? null,
    correlationId:
      input.correlationId ?? null,
    sourceModule: SECURITY_SOURCE_MODULE,
  });
};

export const recordSessionRevoked = async (
  input: {
    userId: string;
    sessionId: string;
    requestId?: string | null;
    correlationId?: string | null;
  },
): Promise<void> => {
  await createAuditEvent({
    actorUserId: input.userId,
    action: "SESSION_REVOKED",
    entityType: "SESSION",
    entityId: input.sessionId,
    status: "SUCCESS",
    requestId:
      input.requestId ?? null,
    correlationId:
      input.correlationId ?? null,
    sourceModule: SECURITY_SOURCE_MODULE,
  });
};