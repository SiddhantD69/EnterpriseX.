import type { FastifyBaseLogger } from "fastify";

import { withDatabaseTransaction } from "../../../infrastructure/database/transaction.js";
import { recordAuditEvent } from "../audit/application/record-audit-event.js";
import { MasterDataNotFoundError, MasterDataValidationError } from "../master-data/application/master-data-errors.js";

export class OrganizationAdminConflictError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "OrganizationAdminConflictError";
    this.code = code;
  }
}

type AuditContext = {
  actorUserId: string;
  organizationId: string;
  companyId: string;
  logger?: Pick<FastifyBaseLogger, "error">;
};

export type OrganizationView = {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
};

export type CompanyView = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const fields = (input: unknown, allowed: string[]): Record<string, unknown> => {
  if (!isRecord(input)) {
    throw new MasterDataValidationError("A JSON object is required.");
  }
  if (Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new MasterDataValidationError("The request contains an unsupported field.");
  }
  return input;
};

const text = (value: unknown, field: string, limit: number): string => {
  if (typeof value !== "string") {
    throw new MasterDataValidationError(`${field} must be a string.`);
  }
  const result = value.trim();
  if (!result) throw new MasterDataValidationError(`${field} is required.`);
  if (result.length > limit) {
    throw new MasterDataValidationError(`${field} must not exceed ${limit} characters.`);
  }
  return result;
};

const status = (value: unknown): "ACTIVE" | "INACTIVE" => {
  if (value !== "ACTIVE" && value !== "INACTIVE") {
    throw new MasterDataValidationError("Status must be ACTIVE or INACTIVE.");
  }
  return value;
};

export const getCurrentOrganization = async (
  organizationId: string,
): Promise<OrganizationView> => {
  const result = await withDatabaseTransaction(async (client) => client.query<OrganizationView>(
    `SELECT id, code, name, status FROM core.organizations WHERE id = $1`,
    [organizationId],
  ));
  const organization = result.rows[0];
  if (!organization) throw new MasterDataNotFoundError("ORGANIZATION_NOT_FOUND", "Organization not found.");
  return organization;
};

export const listCurrentOrganizationCompanies = async (
  organizationId: string,
): Promise<CompanyView[]> => {
  const { db } = await import("../../../infrastructure/database/pool.js");
  const result = await db.query<CompanyView>(
    `
      SELECT id, organization_id AS "organizationId", code, name, status
      FROM core.companies
      WHERE organization_id = $1
      ORDER BY code
      LIMIT 500
    `,
    [organizationId],
  );
  return result.rows;
};

export const getCompanyInOrganization = async (
  organizationId: string,
  companyId: string,
): Promise<CompanyView> => {
  const { db } = await import("../../../infrastructure/database/pool.js");
  const result = await db.query<CompanyView>(
    `
      SELECT id, organization_id AS "organizationId", code, name, status
      FROM core.companies
      WHERE organization_id = $1 AND id = $2
    `,
    [organizationId, companyId],
  );
  if (!result.rows[0]) throw new MasterDataNotFoundError("COMPANY_NOT_FOUND", "Company not found in this organization.");
  return result.rows[0];
};

export const createCompanyInOrganization = async (
  companyId: string,
  input: unknown,
  context: AuditContext,
): Promise<CompanyView> => {
  const body = fields(input, ["code", "name"]);
  const code = text(body.code, "Company code", 50);
  const name = text(body.name, "Company name", 255);
  return withDatabaseTransaction(async (client) => {
    const result = await client.query<CompanyView>(
      `
        INSERT INTO core.companies (organization_id, code, name, status)
        VALUES ($1, $2, $3, 'ACTIVE')
        RETURNING id, organization_id AS "organizationId", code, name, status
      `,
      [context.organizationId, code, name],
    );
    const company = result.rows[0];
    await client.query(
      `
        INSERT INTO security.user_company_access (user_id, organization_id, company_id, status)
        VALUES ($1, $2, $3, 'ACTIVE')
        ON CONFLICT (user_id, company_id) DO NOTHING
      `,
      [context.actorUserId, context.organizationId, company.id],
    );
    await recordAuditEvent({
      actorUserId: context.actorUserId,
      organizationId: context.organizationId,
      companyId,
      action: "COMPANY_CREATED",
      entityType: "COMPANY",
      entityId: company.id,
      status: "SUCCESS",
      sourceModule: "core-platform",
      afterData: { code: company.code, name: company.name, status: company.status },
      metadata: { operation: "company.create", newCompanyId: company.id },
    }, client);
    return company;
  }, context.logger);
};

export const updateCompanyInOrganization = async (
  companyId: string,
  targetCompanyId: string,
  input: unknown,
  context: AuditContext,
): Promise<CompanyView> => {
  const body = fields(input, ["name", "status"]);
  const name = text(body.name, "Company name", 255);
  const nextStatus = status(body.status);
  return withDatabaseTransaction(async (client) => {
    const result = await client.query<CompanyView>(
      `
        UPDATE core.companies
        SET name = $1, status = $2, updated_at = NOW()
        WHERE organization_id = $3 AND id = $4
        RETURNING id, organization_id AS "organizationId", code, name, status
      `,
      [name, nextStatus, context.organizationId, targetCompanyId],
    );
    const company = result.rows[0];
    if (!company) throw new MasterDataNotFoundError("COMPANY_NOT_FOUND", "Company not found in this organization.");
    if (company.id === context.companyId && company.status === "INACTIVE") {
      throw new OrganizationAdminConflictError("ACTIVE_COMPANY_REQUIRED", "The selected company cannot be deactivated in its own context.");
    }
    await recordAuditEvent({
      actorUserId: context.actorUserId,
      organizationId: context.organizationId,
      companyId,
      action: "COMPANY_UPDATED",
      entityType: "COMPANY",
      entityId: company.id,
      status: "SUCCESS",
      sourceModule: "core-platform",
      afterData: { code: company.code, name: company.name, status: company.status },
      metadata: { operation: "company.update" },
    }, client);
    return company;
  }, context.logger);
};

export const createOrganizationWithInitialCompany = async (
  context: AuditContext,
  input: unknown,
): Promise<{ organization: OrganizationView; company: CompanyView }> => {
  const body = fields(input, ["code", "name", "initialCompany"]);
  const code = text(body.code, "Organization code", 50);
  const name = text(body.name, "Organization name", 255);
  const initialCompany = fields(body.initialCompany, ["code", "name"]);
  const companyCode = text(initialCompany.code, "Initial company code", 50);
  const companyName = text(initialCompany.name, "Initial company name", 255);

  return withDatabaseTransaction(async (client) => {
    const orgResult = await client.query<OrganizationView>(
      `
        INSERT INTO core.organizations (code, name, status)
        VALUES ($1, $2, 'ACTIVE')
        RETURNING id, code, name, status
      `,
      [code, name],
    );
    const organization = orgResult.rows[0];
    const companyResult = await client.query<CompanyView>(
      `
        INSERT INTO core.companies (organization_id, code, name, status)
        VALUES ($1, $2, $3, 'ACTIVE')
        RETURNING id, organization_id AS "organizationId", code, name, status
      `,
      [organization.id, companyCode, companyName],
    );
    const company = companyResult.rows[0];
    await client.query(
      `
        INSERT INTO security.user_company_access (user_id, organization_id, company_id, status)
        VALUES ($1, $2, $3, 'ACTIVE')
      `,
      [context.actorUserId, organization.id, company.id],
    );
    await recordAuditEvent({
      actorUserId: context.actorUserId,
      organizationId: organization.id,
      companyId: company.id,
      action: "ORGANIZATION_CREATED",
      entityType: "ORGANIZATION",
      entityId: organization.id,
      status: "SUCCESS",
      sourceModule: "core-platform",
      afterData: {
        code: organization.code,
        name: organization.name,
        initialCompany: { id: company.id, code: company.code, name: company.name },
      },
      metadata: { operation: "organization.create" },
    }, client);
    return { organization, company };
  }, context.logger);
};

export const updateCurrentOrganizationName = async (
  organizationId: string,
  input: unknown,
  context: AuditContext,
): Promise<OrganizationView> => {
  const body = fields(input, ["name"]);
  const name = text(body.name, "Organization name", 255);
  return withDatabaseTransaction(async (client) => {
    const result = await client.query<OrganizationView>(
      `
        UPDATE core.organizations
        SET name = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, code, name, status
      `,
      [name, organizationId],
    );
    const organization = result.rows[0];
    if (!organization) throw new MasterDataNotFoundError("ORGANIZATION_NOT_FOUND", "Organization not found.");
    await recordAuditEvent({
      actorUserId: context.actorUserId,
      organizationId,
      companyId: context.companyId,
      action: "ORGANIZATION_UPDATED",
      entityType: "ORGANIZATION",
      entityId: organization.id,
      status: "SUCCESS",
      sourceModule: "core-platform",
      afterData: { code: organization.code, name: organization.name, status: organization.status },
      metadata: { operation: "organization.update" },
    }, client);
    return organization;
  }, context.logger);
};