import { apiRequest } from "./client";

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

const authorized = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`,
});

export const listAccounts = async (token: string): Promise<FinanceAccount[]> =>
  (await apiRequest<{ data: FinanceAccount[] }>('/api/v1/finance/accounts', { headers: authorized(token) })).data;

export const createAccount = async (token: string, input: {
  code: string;
  name: string;
  type: FinanceAccount["type"];
  normalBalance: FinanceAccount["normalBalance"];
  description?: string | null;
}): Promise<FinanceAccount> =>
  (await apiRequest<{ data: FinanceAccount }>('/api/v1/finance/accounts', {
    method: 'POST',
    headers: authorized(token),
    body: JSON.stringify(input),
  })).data;

export const listJournals = async (token: string): Promise<FinanceJournal[]> =>
  (await apiRequest<{ data: FinanceJournal[] }>('/api/v1/finance/journals', { headers: authorized(token) })).data;

export const createJournal = async (token: string, input: {
  description?: string | null;
  lines: Array<{ accountCode: string; debit?: number; credit?: number; description?: string | null }>;
}): Promise<FinanceJournal> =>
  (await apiRequest<{ data: FinanceJournal }>('/api/v1/finance/journals', {
    method: 'POST',
    headers: authorized(token),
    body: JSON.stringify(input),
  })).data;

export const postJournal = async (token: string, journalId: string): Promise<FinanceJournal> =>
  (await apiRequest<{ data: FinanceJournal }>(`/api/v1/finance/journals/${journalId}/post`, {
    method: 'POST',
    headers: authorized(token),
  })).data;
