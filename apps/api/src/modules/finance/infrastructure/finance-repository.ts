import type { PoolClient } from "pg";

import { db } from "../../../infrastructure/database/pool.js";
import type {
  FinanceAccount,
  FinanceJournal,
  FinanceJournalLine,
} from "../application/finance-service.js";

export type FinanceAccountRow = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  account_type: FinanceAccount["type"];
  normal_balance: FinanceAccount["normalBalance"];
  description: string | null;
  status: FinanceAccount["status"];
  created_at: Date | string;
  updated_at: Date | string;
};

const mapAccount = (row: FinanceAccountRow): FinanceAccount => ({
  id: row.id,
  companyId: row.company_id,
  code: row.code,
  name: row.name,
  type: row.account_type,
  normalBalance: row.normal_balance,
  description: row.description,
  status: row.status,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

export const listCompanyAccounts = async (
  companyId: string,
): Promise<FinanceAccount[]> => {
  const result = await db.query<FinanceAccountRow>(
    `
      SELECT id, company_id, code, name, account_type, normal_balance,
             description, status, created_at, updated_at
      FROM finance.accounts
      WHERE company_id = $1
      ORDER BY code
    `,
    [companyId],
  );

  return result.rows.map(mapAccount);
};

export const getAccountByCode = async (
  client: PoolClient,
  companyId: string,
  code: string,
): Promise<FinanceAccount | null> => {
  const result = await client.query<FinanceAccountRow>(
    `
      SELECT id, company_id, code, name, account_type, normal_balance,
             description, status, created_at, updated_at
      FROM finance.accounts
      WHERE company_id = $1 AND code = $2
      LIMIT 1
    `,
    [companyId, code],
  );

  return result.rows[0] ? mapAccount(result.rows[0]) : null;
};

export const insertFinanceAccount = async (
  client: PoolClient,
  companyId: string,
  input: {
    code: string;
    name: string;
    type: FinanceAccount["type"];
    normalBalance: FinanceAccount["normalBalance"];
    description?: string | null;
  },
): Promise<FinanceAccount> => {
  const result = await client.query<FinanceAccountRow>(
    `
      INSERT INTO finance.accounts (
        company_id,
        code,
        name,
        account_type,
        normal_balance,
        description,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
      RETURNING id, company_id, code, name, account_type, normal_balance,
                description, status, created_at, updated_at
    `,
    [companyId, input.code, input.name, input.type, input.normalBalance, input.description ?? null],
  );

  return mapAccount(result.rows[0]);
};

export const getOrCreateOpenFiscalPeriod = async (
  client: PoolClient,
  companyId: string,
): Promise<{ id: string; code: string; status: string }> => {
  const now = new Date();
  const periodCode = `FY-${now.toISOString().slice(0, 7)}`;
  const name = `Fiscal ${now.toISOString().slice(0, 7)}`;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  const inserted = await client.query<{ id: string; period_code: string; status: string }>(
    `
      INSERT INTO finance.fiscal_periods (
        company_id,
        period_code,
        name,
        start_date,
        end_date,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'OPEN')
      ON CONFLICT (company_id, period_code) DO NOTHING
      RETURNING id, period_code, status
    `,
    [companyId, periodCode, name, start.toISOString(), end.toISOString()],
  );

  if (inserted.rowCount && inserted.rows[0]) {
    return {
      id: inserted.rows[0].id,
      code: inserted.rows[0].period_code,
      status: inserted.rows[0].status,
    };
  }

  const existing = await client.query<{ id: string; period_code: string; status: string }>(
    `
      SELECT id, period_code, status
      FROM finance.fiscal_periods
      WHERE company_id = $1 AND status = 'OPEN'
      ORDER BY start_date DESC
      LIMIT 1
    `,
    [companyId],
  );

  if (existing.rows[0]) {
    return {
      id: existing.rows[0].id,
      code: existing.rows[0].period_code,
      status: existing.rows[0].status,
    };
  }

  const fallback = await client.query<{ id: string; period_code: string; status: string }>(
    `
      INSERT INTO finance.fiscal_periods (
        company_id,
        period_code,
        name,
        start_date,
        end_date,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'OPEN')
      RETURNING id, period_code, status
    `,
    [companyId, periodCode, name, start.toISOString(), end.toISOString()],
  );

  return {
    id: fallback.rows[0].id,
    code: fallback.rows[0].period_code,
    status: fallback.rows[0].status,
  };
};

export const insertJournalHeader = async (
  client: PoolClient,
  companyId: string,
  createdBy: string,
  description: string | null,
  fiscalPeriodId: string,
  documentNumber: string,
): Promise<{ id: string; companyId: string; documentNumber: string; createdBy: string; fiscalPeriodId: string; description: string | null; status: "DRAFT" | "POSTED"; createdAt: Date; postedAt: Date | null }> => {
  const result = await client.query<{
    id: string;
    company_id: string;
    fiscal_period_id: string;
    document_number: string;
    description: string | null;
    created_by: string;
    status: "DRAFT" | "POSTED";
    created_at: Date;
    posted_at: Date | null;
  }>(
    `
      INSERT INTO finance.journal_headers (
        company_id,
        fiscal_period_id,
        document_number,
        description,
        created_by,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'DRAFT')
      RETURNING id, company_id, fiscal_period_id, document_number,
                description, created_by, status, created_at, posted_at
    `,
    [companyId, fiscalPeriodId, documentNumber, description, createdBy],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    companyId: row.company_id,
    documentNumber: row.document_number,
    createdBy: row.created_by,
    fiscalPeriodId: row.fiscal_period_id,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    postedAt: row.posted_at,
  };
};

export const insertJournalLine = async (
  client: PoolClient,
  companyId: string,
  journalId: string,
  lineNumber: number,
  accountId: string,
  description: string | null,
  debit: number,
  credit: number,
): Promise<FinanceJournalLine> => {
  const insertResult = await client.query<{
    id: string;
    company_id: string;
    journal_id: string;
    account_id: string;
    line_number: number;
    description: string | null;
    debit: string;
    credit: string;
    created_at: Date;
  }>(
    `
      INSERT INTO finance.journal_lines (
        company_id,
        journal_id,
        account_id,
        line_number,
        description,
        debit,
        credit
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, company_id, journal_id, account_id, line_number,
                description, debit, credit, created_at
    `,
    [companyId, journalId, accountId, lineNumber, description ?? null, debit, credit],
  );

  const row = insertResult.rows[0];
  const accountResult = await client.query<{
    account_code: string;
    account_name: string;
  }>(
    `
      SELECT a.code AS account_code, a.name AS account_name
      FROM finance.accounts a
      WHERE a.company_id = $1 AND a.id = $2
    `,
    [companyId, accountId],
  );

  const accountRow = accountResult.rows[0];
  return {
    id: row.id,
    journalId: row.journal_id,
    accountId: row.account_id,
    accountCode: accountRow.account_code,
    accountName: accountRow.account_name,
    lineNumber: row.line_number,
    description: row.description,
    debit: Number(row.debit),
    credit: Number(row.credit),
    createdAt: new Date(row.created_at).toISOString(),
  };
};

export const getJournalForUpdate = async (
  client: PoolClient,
  companyId: string,
  journalId: string,
): Promise<FinanceJournal | null> => {
  const header = await client.query<{
    id: string;
    company_id: string;
    fiscal_period_id: string;
    document_number: string;
    description: string | null;
    created_by: string;
    status: "DRAFT" | "POSTED";
    created_at: Date | string;
    posted_at: Date | string | null;
    period_code: string;
    period_status: string;
  }>(
    `
      SELECT j.id, j.company_id, j.fiscal_period_id, j.document_number, j.description,
             j.created_by, j.status, j.created_at, j.posted_at,
             p.period_code, p.status AS period_status
      FROM finance.journal_headers j
      INNER JOIN finance.fiscal_periods p ON p.id = j.fiscal_period_id
      WHERE j.company_id = $1 AND j.id = $2
      FOR UPDATE
    `,
    [companyId, journalId],
  );

  if (!header.rows[0]) {
    return null;
  }

  const lines = await client.query<{
    id: string;
    account_id: string;
    account_code: string;
    account_name: string;
    line_number: number;
    description: string | null;
    debit: string;
    credit: string;
    created_at: Date | string;
  }>(
    `
      SELECT jl.id, jl.account_id, a.code AS account_code, a.name AS account_name,
             jl.line_number, jl.description, jl.debit::numeric, jl.credit::numeric,
             jl.created_at
      FROM finance.journal_lines jl
      INNER JOIN finance.accounts a ON a.id = jl.account_id AND a.company_id = jl.company_id
      WHERE jl.company_id = $1 AND jl.journal_id = $2
      ORDER BY jl.line_number
    `,
    [companyId, journalId],
  );

  return {
    id: header.rows[0].id,
    companyId: header.rows[0].company_id,
    documentNumber: header.rows[0].document_number,
    description: header.rows[0].description,
    status: header.rows[0].status,
    createdBy: header.rows[0].created_by,
    fiscalPeriodCode: header.rows[0].period_code,
    periodStatus: header.rows[0].period_status,
    createdAt: new Date(header.rows[0].created_at).toISOString(),
    postedAt: header.rows[0].posted_at ? new Date(header.rows[0].posted_at).toISOString() : null,
    lines: lines.rows.map((row) => ({
      id: row.id,
      journalId,
      accountId: row.account_id,
      accountCode: row.account_code,
      accountName: row.account_name,
      lineNumber: row.line_number,
      description: row.description,
      debit: Number(row.debit),
      credit: Number(row.credit),
      createdAt: new Date(row.created_at).toISOString(),
    })),
  };
};

export const listCompanyJournals = async (
  companyId: string,
): Promise<FinanceJournal[]> => {
  const headers = await db.query<{
    id: string;
    company_id: string;
    document_number: string;
    description: string | null;
    created_by: string;
    status: "DRAFT" | "POSTED";
    created_at: Date | string;
    posted_at: Date | string | null;
    period_code: string;
    period_status: string;
  }>(
    `
      SELECT j.id, j.company_id, j.document_number, j.description,
             j.created_by, j.status, j.created_at, j.posted_at,
             p.period_code, p.status AS period_status
      FROM finance.journal_headers j
      INNER JOIN finance.fiscal_periods p ON p.id = j.fiscal_period_id
      WHERE j.company_id = $1
      ORDER BY j.created_at DESC
    `,
    [companyId],
  );

  if (headers.rows.length === 0) {
    return [];
  }

  const journalIds = headers.rows.map((row) => row.id);
  const linesResult = await db.query<{
    journal_id: string;
    id: string;
    account_id: string;
    account_code: string;
    account_name: string;
    line_number: number;
    description: string | null;
    debit: string;
    credit: string;
    created_at: Date | string;
  }>(
    `
      SELECT jl.journal_id, jl.id, jl.account_id, a.code AS account_code,
             a.name AS account_name, jl.line_number, jl.description,
             jl.debit::numeric AS debit, jl.credit::numeric AS credit,
             jl.created_at
      FROM finance.journal_lines jl
      INNER JOIN finance.accounts a ON a.id = jl.account_id AND a.company_id = jl.company_id
      WHERE jl.company_id = $1 AND jl.journal_id = ANY($2::uuid[])
      ORDER BY jl.journal_id, jl.line_number
    `,
    [companyId, journalIds],
  );

  const linesByJournal = new Map<string, FinanceJournalLine[]>();
  for (const line of linesResult.rows) {
    const current = linesByJournal.get(line.journal_id) ?? [];
    current.push({
      id: line.id,
      journalId: line.journal_id,
      accountId: line.account_id,
      accountCode: line.account_code,
      accountName: line.account_name,
      lineNumber: line.line_number,
      description: line.description,
      debit: Number(line.debit),
      credit: Number(line.credit),
      createdAt: new Date(line.created_at).toISOString(),
    });
    linesByJournal.set(line.journal_id, current);
  }

  return headers.rows.map((header) => ({
    id: header.id,
    companyId: header.company_id,
    documentNumber: header.document_number,
    description: header.description,
    status: header.status,
    createdBy: header.created_by,
    fiscalPeriodCode: header.period_code,
    periodStatus: header.period_status,
    createdAt: new Date(header.created_at).toISOString(),
    postedAt: header.posted_at ? new Date(header.posted_at).toISOString() : null,
    lines: linesByJournal.get(header.id) ?? [],
  }));
};

export const markJournalPosted = async (
  client: PoolClient,
  companyId: string,
  journalId: string,
): Promise<FinanceJournal> => {
  const result = await client.query<{
    id: string;
    company_id: string;
    document_number: string;
    description: string | null;
    created_by: string;
    status: "DRAFT" | "POSTED";
    created_at: Date | string;
    posted_at: Date | string | null;
    period_code: string;
    period_status: string;
  }>(
    `
      UPDATE finance.journal_headers
      SET status = 'POSTED', posted_at = NOW()
      WHERE company_id = $1 AND id = $2
      RETURNING id, company_id, document_number, description, created_by,
                status, created_at, posted_at
    `,
    [companyId, journalId],
  );

  const row = result.rows[0];
  const period = await client.query<{ period_code: string; status: string }>(
    `
      SELECT p.period_code, p.status
      FROM finance.fiscal_periods p
      INNER JOIN finance.journal_headers j ON j.fiscal_period_id = p.id
      WHERE j.company_id = $1 AND j.id = $2
    `,
    [companyId, journalId],
  );

  const journal = await getJournalForUpdate(client, companyId, journalId);
  if (!journal) {
    throw new Error("Journal could not be loaded after posting.");
  }

  return {
    ...journal,
    status: row.status,
    postedAt: row.posted_at ? new Date(row.posted_at).toISOString() : null,
    fiscalPeriodCode: period.rows[0]?.period_code ?? journal.fiscalPeriodCode,
    periodStatus: period.rows[0]?.status ?? journal.periodStatus,
  };
};
