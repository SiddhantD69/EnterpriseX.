import type { FastifyBaseLogger } from "fastify";

import { withDatabaseTransaction } from "../../../infrastructure/database/transaction.js";
import { recordAuditEvent } from "../../core-platform/audit/application/record-audit-event.js";
import {
  getLeadByEmail,
  getLeadById,
  insertLead,
  insertOpportunity,
  listCompanyLeads,
  listCompanyOpportunities,
} from "../infrastructure/crm-repository.js";

export class CrmValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrmValidationError";
  }
}

export class CrmNotFoundError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CrmNotFoundError";
    this.code = code;
  }
}

export class CrmConflictError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CrmConflictError";
    this.code = code;
  }
}

export type Lead = {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  companyName: string;
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "LOST" | "CUSTOMER";
  source: "WEB" | "REFERRAL" | "PARTNER" | "SALE" | "OTHER";
  createdAt: string;
  updatedAt: string;
};

export type Opportunity = {
  id: string;
  companyId: string;
  leadId: string;
  leadName: string;
  name: string;
  stage: "PROSPECTING" | "QUALIFICATION" | "PROPOSAL" | "NEGOTIATION" | "CLOSED_WON" | "CLOSED_LOST";
  amount: number;
  probability: number;
  closeDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type AuditContext = {
  actorUserId: string;
  organizationId: string;
  logger?: Pick<FastifyBaseLogger, "error">;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeUuid = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new CrmValidationError(`${fieldName} must be a valid UUID.`);
  }
  return value;
};

const normalizeName = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string") {
    throw new CrmValidationError(`${fieldName} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new CrmValidationError(`${fieldName} is required.`);
  }
  if (normalized.length > 100) {
    throw new CrmValidationError(`${fieldName} must not exceed 100 characters.`);
  }
  return normalized;
};

const normalizeOptionalText = (value: unknown, fieldName: string, max: number): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new CrmValidationError(`${fieldName} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length > max) {
    throw new CrmValidationError(`${fieldName} must not exceed ${max} characters.`);
  }
  return normalized;
};

const normalizeAmount = (value: unknown, fieldName: string): number => {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new CrmValidationError(`${fieldName} must be numeric.`);
    }
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new CrmValidationError(`${fieldName} must be numeric.`);
    }
    return parsed;
  }
  throw new CrmValidationError(`${fieldName} must be numeric.`);
};

export const validateCreateLeadInput = (input: unknown): {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  companyName: string;
  status: Lead["status"];
  source: Lead["source"];
} => {
  if (!isRecord(input)) {
    throw new CrmValidationError("Lead input must be a JSON object.");
  }

  const allowedFields = new Set(["firstName", "lastName", "email", "phone", "companyName", "status", "source"]);
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new CrmValidationError("The request contains an unsupported field.");
  }

  const status = input.status;
  if (status !== "NEW" && status !== "CONTACTED" && status !== "QUALIFIED" && status !== "LOST" && status !== "CUSTOMER") {
    throw new CrmValidationError("Lead status must be NEW, CONTACTED, QUALIFIED, LOST, or CUSTOMER.");
  }

  const source = input.source;
  if (source !== "WEB" && source !== "REFERRAL" && source !== "PARTNER" && source !== "SALE" && source !== "OTHER") {
    throw new CrmValidationError("Lead source must be WEB, REFERRAL, PARTNER, SALE, or OTHER.");
  }

  return {
    firstName: normalizeName(input.firstName, "First name"),
    lastName: normalizeName(input.lastName, "Last name"),
    email: normalizeOptionalText(input.email, "Email", 320),
    phone: normalizeOptionalText(input.phone, "Phone", 50),
    companyName: normalizeName(input.companyName, "Company name"),
    status,
    source,
  };
};

export const validateCreateOpportunityInput = (input: unknown): {
  leadId: string;
  name: string;
  stage: Opportunity["stage"];
  amount: number;
  probability: number;
  closeDate: string | null;
} => {
  if (!isRecord(input)) {
    throw new CrmValidationError("Opportunity input must be a JSON object.");
  }

  const allowedFields = new Set(["leadId", "name", "stage", "amount", "probability", "closeDate"]);
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new CrmValidationError("The request contains an unsupported field.");
  }

  const stage = input.stage;
  if (stage !== "PROSPECTING" && stage !== "QUALIFICATION" && stage !== "PROPOSAL" && stage !== "NEGOTIATION" && stage !== "CLOSED_WON" && stage !== "CLOSED_LOST") {
    throw new CrmValidationError("Opportunity stage must be PROSPECTING, QUALIFICATION, PROPOSAL, NEGOTIATION, CLOSED_WON, or CLOSED_LOST.");
  }

  const amount = normalizeAmount(input.amount, "Amount");
  const probability = normalizeAmount(input.probability, "Probability");
  if (amount < 0) {
    throw new CrmValidationError("Opportunity amount cannot be negative.");
  }
  if (probability < 0 || probability > 100) {
    throw new CrmValidationError("Opportunity probability must be between 0 and 100.");
  }

  return {
    leadId: normalizeUuid(input.leadId, "Lead ID"),
    name: normalizeName(input.name, "Opportunity name"),
    stage,
    amount,
    probability,
    closeDate: normalizeOptionalText(input.closeDate, "Close date", 30),
  };
};

export const listLeads = async (companyId: string): Promise<Lead[]> => listCompanyLeads(companyId);

export const createLead = async (
  companyId: string,
  input: unknown,
  context: AuditContext,
): Promise<Lead> => {
  const validated = validateCreateLeadInput(input);

  return withDatabaseTransaction(async (client) => {
    const existing = await getLeadByEmail(client, companyId, String(validated.email ?? ""));
    if (validated.email && existing) {
      throw new CrmConflictError("LEAD_EMAIL_EXISTS", "A lead with this email already exists for the company.");
    }

    const lead = await insertLead(client, companyId, validated);
    await recordAuditEvent(
      {
        actorUserId: context.actorUserId,
        organizationId: context.organizationId,
        companyId,
        action: "LEAD_CREATED",
        entityType: "CRM_LEAD",
        entityId: lead.id,
        status: "SUCCESS",
        sourceModule: "crm",
        afterData: { email: validated.email, companyName: validated.companyName },
        metadata: { operation: "crm.lead.create" },
      },
      client,
    );

    return lead;
  }, context.logger);
};

export const listOpportunities = async (companyId: string): Promise<Opportunity[]> => listCompanyOpportunities(companyId);

export const createOpportunity = async (
  companyId: string,
  input: unknown,
  context: AuditContext,
): Promise<Opportunity> => {
  const validated = validateCreateOpportunityInput(input);

  return withDatabaseTransaction(async (client) => {
    const lead = await getLeadById(client, companyId, validated.leadId);
    if (!lead) {
      throw new CrmNotFoundError("LEAD_NOT_FOUND", "Lead not found in this company.");
    }

    const opportunity = await insertOpportunity(client, companyId, validated);
    await recordAuditEvent(
      {
        actorUserId: context.actorUserId,
        organizationId: context.organizationId,
        companyId,
        action: "OPPORTUNITY_CREATED",
        entityType: "CRM_OPPORTUNITY",
        entityId: opportunity.id,
        status: "SUCCESS",
        sourceModule: "crm",
        afterData: { leadId: validated.leadId, name: validated.name, stage: validated.stage },
        metadata: { operation: "crm.opportunity.create" },
      },
      client,
    );

    return opportunity;
  }, context.logger);
};
