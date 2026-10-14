import type { FastifyBaseLogger } from "fastify";

import { allocateDocumentNumber } from "../../../infrastructure/database/document-numbering.js";
import { withDatabaseTransaction } from "../../../infrastructure/database/transaction.js";
import { recordAuditEvent } from "../../core-platform/audit/application/record-audit-event.js";
import {
  getAccountByCode,
  getOrCreateOpenFiscalPeriod,
  getJournalForUpdate,
  insertFinanceAccount,
  insertJournalHeader,
  insertJournalLine,
  listCompanyAccounts,
  listCompanyJournals,
  markJournalPosted,
} from "../infrastructure/finance-repository.js";

export class FinanceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinanceValidationError";
  }
}

export class FinanceNotFoundError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "FinanceNotFoundError";
    this.code = code;
  }
}

export class FinanceConflictError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "FinanceConflictError";
    this.code = code;
  }
}

export type FinanceAccount = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  normalBalance: "DEBIT" | "CREDIT";
  status: "ACTIVE" | "INACTIVE";
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinanceJournalLine = {
  id: string;
  journalId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  lineNumber: number;
  description: string | null;
  debit: number;
  credit: number;
  createdAt: string;
};

export type FinanceJournal = {
  id: string;
  companyId: string;
  documentNumber: string;
  description: string | null;
  status: "DRAFT" | "POSTED";
  createdBy: string;
  fiscalPeriodCode: string;
  periodStatus: string;
  createdAt: string;
  postedAt: string | null;
  lines: FinanceJournalLine[];
};

type AuditContext = {
  actorUserId: string;
  organizationId: string;
  logger?: Pick<FastifyBaseLogger, "error">;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeCode = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string") {
    throw new FinanceValidationError(`${fieldName} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new FinanceValidationError(`${fieldName} is required.`);
  }
  if (normalized.length > 30) {
    throw new FinanceValidationError(`${fieldName} must not exceed 30 characters.`);
  }
  return normalized;
};

const normalizeName = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string") {
    throw new FinanceValidationError(`${fieldName} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new FinanceValidationError(`${fieldName} is required.`);
  }
  if (normalized.length > 255) {
    throw new FinanceValidationError(`${fieldName} must not exceed 255 characters.`);
  }
  return normalized;
};

const normalizedOptionalText = (value: unknown, fieldName: string, max: number): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new FinanceValidationError(`${fieldName} must be a string.`);
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }
  if (normalized.length > max) {
    throw new FinanceValidationError(`${fieldName} must not exceed ${max} characters.`);
  }
  return normalized;
};

export const validateCreateAccountInput = (input: unknown): {
  code: string;
  name: string;
  type: FinanceAccount["type"];
  normalBalance: FinanceAccount["normalBalance"];
  description: string | null;
} => {
  if (!isRecord(input)) {
    throw new FinanceValidationError("Account input must be a JSON object.");
  }

  const allowedFields = new Set(["code", "name", "type", "normalBalance", "description"]);
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new FinanceValidationError("The request contains an unsupported field.");
  }

  const code = normalizeCode(input.code, "Account code");
  const name = normalizeName(input.name, "Account name");
  const typeValue = input.type;
  if (typeValue !== "ASSET" && typeValue !== "LIABILITY" && typeValue !== "EQUITY" && typeValue !== "REVENUE" && typeValue !== "EXPENSE") {
    throw new FinanceValidationError("Account type must be ASSET, LIABILITY, EQUITY, REVENUE, or EXPENSE.");
  }
  const balanceValue = input.normalBalance;
  if (balanceValue !== "DEBIT" && balanceValue !== "CREDIT") {
    throw new FinanceValidationError("Normal balance must be DEBIT or CREDIT.");
  }

  return {
    code,
    name,
    type: typeValue,
    normalBalance: balanceValue,
    description: normalizedOptionalText(input.description, "Description", 500),
  };
};

const validateJournalLineInput = (value: unknown, index: number): {
  accountCode: string;
  debit: number;
  credit: number;
  description: string | null;
} => {
  if (!isRecord(value)) {
    throw new FinanceValidationError(`Journal line ${index + 1} must be a JSON object.`);
  }

  const allowedFields = new Set(["accountCode", "debit", "credit", "description"]);
  if (Object.keys(value).some((field) => !allowedFields.has(field))) {
    throw new FinanceValidationError(`Journal line ${index + 1} contains an unsupported field.`);
  }

  const accountCode = normalizeCode(value.accountCode, `Journal line ${index + 1} account code`);
  const description = normalizedOptionalText(value.description, `Journal line ${index + 1} description`, 255);

  const debitInput = value.debit ?? 0;
  const creditInput = value.credit ?? 0;
  const debit = typeof debitInput === "number" ? debitInput : Number(debitInput);
  const credit = typeof creditInput === "number" ? creditInput : Number(creditInput);

  if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
    throw new FinanceValidationError(`Journal line ${index + 1} debit and credit values must be numeric.`);
  }
  if (debit < 0 || credit < 0) {
    throw new FinanceValidationError(`Journal line ${index + 1} debit and credit values must be zero or greater.`);
  }
  if (debit > 0 && credit > 0) {
    throw new FinanceValidationError(`Journal line ${index + 1} cannot include both debit and credit.`);
  }
  if (debit === 0 && credit === 0) {
    throw new FinanceValidationError(`Journal line ${index + 1} must include a debit or credit amount.`);
  }
  if (Math.abs(debit * 10000 - Math.round(debit * 10000)) > 0.000001 || Math.abs(credit * 10000 - Math.round(credit * 10000)) > 0.000001) {
    throw new FinanceValidationError(`Journal line ${index + 1} amounts must not exceed four decimal places.`);
  }

  return {
    accountCode,
    debit,
    credit,
    description,
  };
};

export const validateCreateJournalInput = (input: unknown): {
  description: string | null;
  lines: Array<{ accountCode: string; debit: number; credit: number; description: string | null }>;
} => {
  if (!isRecord(input)) {
    throw new FinanceValidationError("Journal input must be a JSON object.");
  }

  const allowedFields = new Set(["description", "lines"]);
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new FinanceValidationError("The request contains an unsupported field.");
  }

  const description = normalizedOptionalText(input.description, "Description", 500);
  if (!Array.isArray(input.lines) || input.lines.length < 2) {
    throw new FinanceValidationError("At least two journal lines are required.");
  }

  const lines = input.lines.map((line, index) => validateJournalLineInput(line, index));
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.000001) {
    throw new FinanceValidationError("Journal totals must balance before posting.");
  }

  return { description, lines };
};

export const listAccounts = async (companyId: string): Promise<FinanceAccount[]> =>
  listCompanyAccounts(companyId);

export const createAccount = async (
  companyId: string,
  input: unknown,
  context: AuditContext,
): Promise<FinanceAccount> => {
  const validated = validateCreateAccountInput(input);

  return withDatabaseTransaction(async (client) => {
    const existing = await getAccountByCode(client, companyId, validated.code);
    if (existing) {
      throw new FinanceConflictError("ACCOUNT_CODE_EXISTS", "An account with this code already exists for the company.");
    }

    const account = await insertFinanceAccount(client, companyId, validated);
    await recordAuditEvent(
      {
        actorUserId: context.actorUserId,
        organizationId: context.organizationId,
        companyId,
        action: "ACCOUNT_CREATED",
        entityType: "FINANCE_ACCOUNT",
        entityId: account.id,
        status: "SUCCESS",
        sourceModule: "finance",
        afterData: {
          code: account.code,
          name: account.name,
          type: account.type,
          normalBalance: account.normalBalance,
        },
        metadata: { operation: "finance.account.create" },
      },
      client,
    );

    return account;
  }, context.logger);
};

export const listJournals = async (companyId: string): Promise<FinanceJournal[]> =>
  listCompanyJournals(companyId);

export const createJournal = async (
  companyId: string,
  actorUserId: string,
  input: unknown,
  context: AuditContext,
): Promise<FinanceJournal> => {
  const validated = validateCreateJournalInput(input);

  return withDatabaseTransaction(async (client) => {
    const period = await getOrCreateOpenFiscalPeriod(client, companyId);
    const documentNumber = await allocateDocumentNumber(client, companyId, "JOURNAL", "JE-");
    const header = await insertJournalHeader(client, companyId, actorUserId, validated.description, period.id, documentNumber);

    const resolvedLines: Array<{ accountCode: string; debit: number; credit: number; description: string | null; accountId: string }> = [];

    for (const line of validated.lines) {
      const account = await getAccountByCode(client, companyId, line.accountCode);
      if (!account) {
        throw new FinanceNotFoundError("ACCOUNT_NOT_FOUND", `Account ${line.accountCode} was not found in this company.`);
      }
      if (account.status !== "ACTIVE") {
        throw new FinanceValidationError(`Account ${account.code} is inactive.`);
      }
      resolvedLines.push({
        accountCode: account.code,
        accountId: account.id,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
      });
    }

    if (new Set(resolvedLines.map((line) => line.accountCode)).size !== resolvedLines.length) {
      throw new FinanceValidationError("A journal cannot reference the same account more than once.");
    }

    for (const [index, line] of resolvedLines.entries()) {
      await insertJournalLine(
        client,
        companyId,
        header.id,
        index + 1,
        line.accountId,
        line.description,
        line.debit,
        line.credit,
      );
    }

    const journal = await getJournalForUpdate(client, companyId, header.id);
    if (!journal) {
      throw new FinanceNotFoundError("JOURNAL_NOT_FOUND", "Journal could not be loaded after creation.");
    }

    await recordAuditEvent(
      {
        actorUserId: context.actorUserId,
        organizationId: context.organizationId,
        companyId,
        action: "JOURNAL_CREATED",
        entityType: "FINANCE_JOURNAL",
        entityId: header.id,
        status: "SUCCESS",
        sourceModule: "finance",
        afterData: {
          documentNumber,
          description: validated.description,
          status: "DRAFT",
          lines: journal.lines,
        },
        metadata: { operation: "finance.journal.create" },
      },
      client,
    );

    return journal;
  }, context.logger);
};

export const postJournal = async (
  companyId: string,
  journalId: string,
  context: AuditContext,
): Promise<FinanceJournal> => {
  return withDatabaseTransaction(async (client) => {
    const journal = await getJournalForUpdate(client, companyId, journalId);
    if (!journal) {
      throw new FinanceNotFoundError("JOURNAL_NOT_FOUND", "Journal not found.");
    }
    if (journal.status === "POSTED") {
      throw new FinanceConflictError("JOURNAL_ALREADY_POSTED", "Journal already posted.");
    }
    if (journal.periodStatus === "CLOSED") {
      throw new FinanceConflictError("PERIOD_CLOSED", "The fiscal period for this journal is closed.");
    }

    const totalDebit = journal.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = journal.lines.reduce((sum, line) => sum + line.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.000001) {
      throw new FinanceValidationError("Journal totals must balance before posting.");
    }

    const updated = await markJournalPosted(client, companyId, journalId);
    await recordAuditEvent(
      {
        actorUserId: context.actorUserId,
        organizationId: context.organizationId,
        companyId,
        action: "JOURNAL_POSTED",
        entityType: "FINANCE_JOURNAL",
        entityId: journalId,
        status: "SUCCESS",
        sourceModule: "finance",
        beforeData: {
          status: "DRAFT",
          documentNumber: journal.documentNumber,
        },
        afterData: {
          status: "POSTED",
          documentNumber: journal.documentNumber,
          postedAt: updated.postedAt,
        },
        metadata: { operation: "finance.journal.post" },
      },
      client,
    );

    return updated;
  }, context.logger);
};
