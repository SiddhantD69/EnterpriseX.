import type { FastifyBaseLogger } from "fastify";

import { withDatabaseTransaction } from "../../../infrastructure/database/transaction.js";
import { recordAuditEvent } from "../../core-platform/audit/application/record-audit-event.js";
import {
  MasterDataNotFoundError,
  MasterDataValidationError,
} from "../../core-platform/master-data/application/master-data-errors.js";
import { hashPassword } from "../security/password-hasher.js";
import {
  assignPermissionsToRole,
  assignRoleToCompanyUser,
  createRole,
  createUserWithCompanyAccess,
  getUserCompanyAccess as listUserCompanyAccess,
  grantCompanyAccess,
  listPermissions,
  listRoles,
  listUserRoleAssignments,
  listUsersForCompany,
  replaceRolePermissions,
  updateCompanyUser as updateUserInCompany,
  updateRole,
} from "../infrastructure/administration-repository.js";
import type {
  AdminPermission,
  AdminRole,
  AdminUser,
  CompanyAccess,
  UserRoleAssignment,
} from "../infrastructure/administration-repository.js";

type AuditContext = {
  actorUserId: string;
  organizationId: string;
  grantedPermissionCodes?: readonly string[];
  logger?: Pick<FastifyBaseLogger, "error">;
};

export class AdministrationConflictError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AdministrationConflictError";
    this.code = code;
  }
}

export class AdministrationForbiddenError extends Error {
  constructor() {
    super("You cannot grant permissions that are not assigned to you.");
    this.name = "AdministrationForbiddenError";
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = ["ACTIVE", "INACTIVE"] as const;
const ensurePermissionDelegationAllowed = (
  permissionCodes: string[],
  context: AuditContext,
): void => {
  const granted = new Set(context.grantedPermissionCodes ?? []);
  if (permissionCodes.some((code) => !granted.has(code))) {
    throw new AdministrationForbiddenError();
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const bodyWithFields = (value: unknown, allowed: string[]): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new MasterDataValidationError("A JSON object is required.");
  }
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new MasterDataValidationError("The request contains an unsupported field.");
  }
  return value;
};

const requiredText = (value: unknown, field: string, max: number): string => {
  if (typeof value !== "string") {
    throw new MasterDataValidationError(`${field} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) throw new MasterDataValidationError(`${field} is required.`);
  if (normalized.length > max) {
    throw new MasterDataValidationError(`${field} must not exceed ${max} characters.`);
  }
  return normalized;
};

const validateUuid = (value: string, field: string): string => {
  if (!UUID_PATTERN.test(value)) {
    throw new MasterDataValidationError(`${field} must be a valid identifier.`);
  }
  return value;
};

const validateStatus = (value: unknown): "ACTIVE" | "INACTIVE" => {
  if (typeof value !== "string" || !(STATUSES as readonly string[]).includes(value)) {
    throw new MasterDataValidationError("Status must be ACTIVE or INACTIVE.");
  }
  return value as "ACTIVE" | "INACTIVE";
};

const writeAudit = async (
  client: Parameters<Parameters<typeof withDatabaseTransaction>[0]>[0],
  context: AuditContext,
  companyId: string,
  action: string,
  entityType: string,
  entityId: string,
  afterData: unknown,
): Promise<void> => {
  await recordAuditEvent({
    actorUserId: context.actorUserId,
    organizationId: context.organizationId,
    companyId,
    action,
    entityType,
    entityId,
    status: "SUCCESS",
    sourceModule: "security-identity",
    afterData,
    metadata: { operation: action.toLowerCase() },
  }, client);
};

export const getCompanyUsers = (companyId: string): Promise<AdminUser[]> =>
  listUsersForCompany(companyId);

export const createCompanyUser = async (
  companyId: string,
  organizationId: string,
  input: unknown,
  context: AuditContext,
): Promise<AdminUser> => {
  const body = bodyWithFields(input, ["email", "displayName", "password"]);
  const email = requiredText(body.email, "Email", 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new MasterDataValidationError("Email address is invalid.");
  }
  const displayName = requiredText(body.displayName, "Display name", 255);
  if (typeof body.password !== "string" || body.password.length < 12 || body.password.length > 1024) {
    throw new MasterDataValidationError("Password must contain between 12 and 1024 characters.");
  }
  const passwordHash = await hashPassword(body.password);

  return withDatabaseTransaction(async (client) => {
    const user = await createUserWithCompanyAccess(client, {
      email,
      displayName,
      passwordHash,
      organizationId,
      companyId,
    });
    await writeAudit(client, context, companyId, "USER_CREATED", "USER", user.id, {
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      companyId,
    });
    return user;
  }, context.logger);
};

export const updateCompanyUser = async (
  companyId: string,
  userId: string,
  input: unknown,
  context: AuditContext,
): Promise<AdminUser> => {
  validateUuid(userId, "User ID");
  const body = bodyWithFields(input, ["email", "displayName", "status"]);
  const email = requiredText(body.email, "Email", 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new MasterDataValidationError("Email address is invalid.");
  }
  const displayName = requiredText(body.displayName, "Display name", 255);
  const status = validateStatus(body.status);
  return withDatabaseTransaction(async (client) => {
    const user = await updateUserInCompany(client, companyId, userId, {
      email,
      displayName,
      status,
    });
    if (!user) {
      throw new MasterDataNotFoundError("USER_NOT_FOUND", "User not found for this company.");
    }
    await writeAudit(client, context, companyId, "USER_UPDATED", "USER", user.id, {
      email: user.email,
      displayName: user.displayName,
      status: user.status,
    });
    return user;
  }, context.logger);
};

export const getUserCompanyAccess = (
  userId: string,
  organizationId: string,
): Promise<CompanyAccess[]> => {
  validateUuid(userId, "User ID");
  validateUuid(organizationId, "Organization ID");
  return listUserCompanyAccess(userId, organizationId);
};

export const grantUserCompanyAccess = async (
  companyId: string,
  organizationId: string,
  userId: string,
  input: unknown,
  context: AuditContext,
): Promise<{ userId: string; companyId: string; status: "ACTIVE" }> => {
  validateUuid(userId, "User ID");
  const body = bodyWithFields(input, ["companyId"]);
  const targetCompanyId = validateUuid(
    requiredText(body.companyId, "Company ID", 36),
    "Company ID",
  );

  return withDatabaseTransaction(async (client) => {
    const target = await client.query<{ id: string }>(
      `SELECT id FROM core.companies WHERE id = $1 AND organization_id = $2 AND status = 'ACTIVE'`,
      [targetCompanyId, organizationId],
    );
    if (target.rowCount !== 1) {
      throw new MasterDataNotFoundError("COMPANY_NOT_FOUND", "Active company not found in this organization.");
    }
    const user = await client.query<{ id: string }>(
      "SELECT id FROM security.users WHERE id = $1",
      [userId],
    );
    if (user.rowCount !== 1) {
      throw new MasterDataNotFoundError("USER_NOT_FOUND", "User not found.");
    }
    await grantCompanyAccess(client, organizationId, targetCompanyId, userId);
    await writeAudit(client, context, companyId, "USER_COMPANY_ACCESS_GRANTED", "USER", userId, {
      userId,
      organizationId,
      companyId: targetCompanyId,
    });
    return { userId, companyId: targetCompanyId, status: "ACTIVE" };
  }, context.logger);
};

export const getRoles = (companyId: string): Promise<AdminRole[]> => listRoles(companyId);
export const getPermissions = (): Promise<AdminPermission[]> => listPermissions();

const permissionCodesFromBody = (value: unknown): string[] => {
  if (!Array.isArray(value) || value.length > 500 || value.some((item) => typeof item !== "string")) {
    throw new MasterDataValidationError("Permission codes must be an array of strings.");
  }
  const codes = value.map((item) => (item as string).trim());
  if (codes.some((code) => !code || code.length > 150)) {
    throw new MasterDataValidationError("Permission code is invalid.");
  }
  return [...new Set(codes)];
};

const ensurePermissionCodesExist = async (
  client: Parameters<Parameters<typeof withDatabaseTransaction>[0]>[0],
  codes: string[],
): Promise<void> => {
  if (codes.length === 0) return;
  const result = await client.query<{ code: string }>(
    `SELECT code FROM security.permissions WHERE code = ANY($1::varchar[])`,
    [codes],
  );
  const found = new Set(result.rows.map((row) => row.code));
  const missing = codes.filter((code) => !found.has(code));
  if (missing.length > 0) {
    throw new MasterDataValidationError(`Unknown permission code: ${missing[0]}.`);
  }
};

export const createSecurityRole = async (
  companyId: string,
  input: unknown,
  context: AuditContext,
): Promise<AdminRole> => {
  const body = bodyWithFields(input, ["code", "name", "description", "permissionCodes"]);
  const code = requiredText(body.code, "Role code", 100).toUpperCase();
  if (!/^[A-Z0-9_.-]+$/.test(code)) {
    throw new MasterDataValidationError("Role code contains invalid characters.");
  }
  const name = requiredText(body.name, "Role name", 255);
  const description = body.description === undefined || body.description === null || body.description === ""
    ? null
    : requiredText(body.description, "Role description", 2000);
  const codes = permissionCodesFromBody(body.permissionCodes ?? []);
  ensurePermissionDelegationAllowed(codes, context);
  return withDatabaseTransaction(async (client) => {
    await ensurePermissionCodesExist(client, codes);
    const role = await createRole(client, { code, name, description, companyId });
    await assignPermissionsToRole(client, role.id, codes);
    await writeAudit(client, context, companyId, "ROLE_CREATED", "ROLE", role.id, {
      code: role.code,
      name: role.name,
      permissionCodes: codes,
    });
    return { ...role, description, permissionCodes: codes };
  }, context.logger);
};

export const updateSecurityRole = async (
  companyId: string,
  roleId: string,
  input: unknown,
  context: AuditContext,
): Promise<AdminRole> => {
  validateUuid(roleId, "Role ID");
  const body = bodyWithFields(input, ["name", "description", "status", "permissionCodes"]);
  const name = requiredText(body.name, "Role name", 255);
  const description = body.description === undefined || body.description === null || body.description === ""
    ? null
    : requiredText(body.description, "Role description", 2000);
  const status = validateStatus(body.status);
  const codes = permissionCodesFromBody(body.permissionCodes ?? []);
  ensurePermissionDelegationAllowed(codes, context);
  return withDatabaseTransaction(async (client) => {
    await ensurePermissionCodesExist(client, codes);
    const role = await updateRole(client, companyId, roleId, { name, description, status });
    if (!role) {
      throw new MasterDataNotFoundError("ROLE_NOT_FOUND", "Role not found or cannot be changed.");
    }
    await replaceRolePermissions(client, roleId, codes);
    await writeAudit(client, context, companyId, "ROLE_UPDATED", "ROLE", role.id, {
      code: role.code,
      name: role.name,
      status: role.status,
      permissionCodes: codes,
    });
    return { ...role, description, permissionCodes: codes };
  }, context.logger);
};

export const getCompanyUserRoles = async (
  companyId: string,
  userId: string,
): Promise<UserRoleAssignment[]> => {
  validateUuid(userId, "User ID");
  return listUserRoleAssignments(companyId, userId);
};

export const setCompanyUserRole = async (
  companyId: string,
  userId: string,
  roleId: string,
  input: unknown,
  context: AuditContext,
): Promise<{ userId: string; roleId: string; status: "ACTIVE" | "INACTIVE" }> => {
  validateUuid(userId, "User ID");
  validateUuid(roleId, "Role ID");
  const status = validateStatus(bodyWithFields(input, ["status"]).status);
  return withDatabaseTransaction(async (client) => {
    const assigned = await assignRoleToCompanyUser(client, companyId, userId, roleId, status);
    if (!assigned) {
      throw new MasterDataNotFoundError(
        "USER_ROLE_TARGET_NOT_FOUND",
        "Active user company access or role not found.",
      );
    }
    await writeAudit(client, context, companyId, "USER_ROLE_UPDATED", "USER", userId, {
      userId,
      roleId,
      status,
    });
    return { userId, roleId, status };
  }, context.logger);
};