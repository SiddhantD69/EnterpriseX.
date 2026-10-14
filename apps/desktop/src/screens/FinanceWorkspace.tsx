import { useEffect, useMemo, useState, type FormEvent } from "react";

import { ApiError } from "../api/client";
import {
  createAccount,
  createJournal,
  listAccounts,
  listJournals,
  postJournal,
  type FinanceAccount,
  type FinanceJournal,
} from "../api/finance-api";
import "./FinanceWorkspace.css";

type FinanceTab = "accounts" | "journals";

type JournalLineDraft = {
  accountCode: string;
  debit: string;
  credit: string;
  description: string;
};

const getErrorMessage = (error: unknown): string =>
  error instanceof ApiError ? error.message : "The request could not be completed.";

export type FinanceWorkspaceProps = {
  token: string;
  permissionCodes: ReadonlySet<string>;
};

export function FinanceWorkspace({ token, permissionCodes }: FinanceWorkspaceProps) {
  const tabs = useMemo(() => {
    const options: Array<{ id: FinanceTab; label: string; permission: string }> = [
      { id: "accounts", label: "Accounts", permission: "finance.accounts.read" },
      { id: "journals", label: "Journals", permission: "finance.journals.read" },
    ];

    return options.filter((tab) => permissionCodes.has(tab.permission));
  }, [permissionCodes]);

  const [activeTab, setActiveTab] = useState<FinanceTab>(tabs[0]?.id ?? "accounts");
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [journals, setJournals] = useState<FinanceJournal[]>([]);
  const [accountForm, setAccountForm] = useState({ code: "", name: "", type: "ASSET" as FinanceAccount["type"], normalBalance: "DEBIT" as FinanceAccount["normalBalance"], description: "" });
  const [journalDraft, setJournalDraft] = useState<JournalLineDraft[]>([
    { accountCode: "", debit: "", credit: "", description: "" },
    { accountCode: "", debit: "", credit: "", description: "" },
  ]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const load = async (): Promise<void> => {
      try {
        const [accountList, journalList] = await Promise.all([
          permissionCodes.has("finance.accounts.read") ? listAccounts(token) : Promise.resolve([]),
          permissionCodes.has("finance.journals.read") ? listJournals(token) : Promise.resolve([]),
        ]);

        if (active) {
          setAccounts(accountList);
          setJournals(journalList);
        }
      } catch (loadError) {
        if (active) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [permissionCodes, refreshKey, token]);

  const updateAccountForm = (field: keyof typeof accountForm, value: string) => {
    setAccountForm((current) => ({ ...current, [field]: value }));
  };

  const addJournalLine = (): void => {
    setJournalDraft((current) => [...current, { accountCode: "", debit: "", credit: "", description: "" }]);
  };

  const updateJournalLine = (index: number, field: keyof JournalLineDraft, value: string): void => {
    setJournalDraft((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line));
  };

  const handleCreateAccount = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!permissionCodes.has("finance.accounts.create")) {
      setError("You do not have permission to create accounts.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await createAccount(token, {
        code: accountForm.code,
        name: accountForm.name,
        type: accountForm.type,
        normalBalance: accountForm.normalBalance,
        description: accountForm.description || null,
      });
      setAccountForm({ code: "", name: "", type: "ASSET", normalBalance: "DEBIT", description: "" });
      setSuccess("Account created successfully.");
      setRefreshKey((value) => value + 1);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateJournal = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!permissionCodes.has("finance.journals.create")) {
      setError("You do not have permission to create journals.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const lines = journalDraft
        .filter((line) => line.accountCode)
        .map((line) => ({
          accountCode: line.accountCode,
          debit: line.debit ? Number(line.debit) : 0,
          credit: line.credit ? Number(line.credit) : 0,
          description: line.description || null,
        }));

      if (lines.length < 2) {
        throw new Error("At least two journal lines are required.");
      }

      const journal = await createJournal(token, {
        description: description || null,
        lines,
      });
      setDescription("");
      setJournalDraft([
        { accountCode: "", debit: "", credit: "", description: "" },
        { accountCode: "", debit: "", credit: "", description: "" },
      ]);
      setSuccess(`Journal ${journal.documentNumber} created.`);
      setRefreshKey((value) => value + 1);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  const handlePostJournal = async (journalId: string): Promise<void> => {
    if (!permissionCodes.has("finance.journals.post")) {
      setError("You do not have permission to post journals.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const journal = await postJournal(token, journalId);
      setSuccess(`Journal ${journal.documentNumber} posted successfully.`);
      setRefreshKey((value) => value + 1);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  if (tabs.length === 0) {
    return <section className="finance-access-empty"><h2>Finance</h2><p>Your account does not have finance permissions.</p></section>;
  }

  return (
    <section className="finance-page">
      <header className="finance-header">
        <div>
          <div className="finance-eyebrow">ACCOUNTING</div>
          <h1>Finance &amp; Accounting</h1>
        </div>
        <button type="button" className="finance-refresh" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>
          ↻ Refresh
        </button>
      </header>

      <div className="finance-tabs" role="tablist" aria-label="Finance views">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "selected" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(error || success) && <div className={error ? "finance-notice error" : "finance-notice success"}>{error ?? success}</div>}
      {loading && <div className="finance-state">Loading ledger data...</div>}

      {activeTab === "accounts" && (
        <div className="finance-panels">
          {permissionCodes.has("finance.accounts.create") && (
            <form className="finance-form" onSubmit={(event) => void handleCreateAccount(event)}>
              <h2>Create Account</h2>
              <div className="finance-grid">
                <label>
                  Code
                  <input value={accountForm.code} onChange={(event) => updateAccountForm("code", event.target.value)} required />
                </label>
                <label>
                  Name
                  <input value={accountForm.name} onChange={(event) => updateAccountForm("name", event.target.value)} required />
                </label>
                <label>
                  Type
                  <select value={accountForm.type} onChange={(event) => updateAccountForm("type", event.target.value)}>
                    <option value="ASSET">Asset</option>
                    <option value="LIABILITY">Liability</option>
                    <option value="EQUITY">Equity</option>
                    <option value="REVENUE">Revenue</option>
                    <option value="EXPENSE">Expense</option>
                  </select>
                </label>
                <label>
                  Normal Balance
                  <select value={accountForm.normalBalance} onChange={(event) => updateAccountForm("normalBalance", event.target.value)}>
                    <option value="DEBIT">Debit</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                </label>
              </div>
              <label>
                Description
                <textarea value={accountForm.description} onChange={(event) => updateAccountForm("description", event.target.value)} rows={3} />
              </label>
              <button type="submit" className="finance-primary" disabled={saving}>
                {saving ? "Saving..." : "Create account"}
              </button>
            </form>
          )}

          <div className="finance-list">
            <div className="finance-list-heading">
              <h2>Chart of Accounts</h2>
              <span>{accounts.length} accounts</span>
            </div>
            {!accounts.length ? (
              <div className="finance-state">No accounts created yet.</div>
            ) : (
              <div className="finance-table-wrap">
                <table className="finance-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={account.id}>
                        <td>{account.code}</td>
                        <td>{account.name}</td>
                        <td>{account.type}</td>
                        <td>{account.normalBalance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "journals" && (
        <div className="finance-panels">
          {permissionCodes.has("finance.journals.create") && (
            <form className="finance-form" onSubmit={(event) => void handleCreateJournal(event)}>
              <h2>Post Journal Entry</h2>
              <label>
                Description
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
              </label>

              {journalDraft.map((line, index) => (
                <div className="journal-line" key={index}>
                  <label>
                    Account
                    <select value={line.accountCode} onChange={(event) => updateJournalLine(index, "accountCode", event.target.value)}>
                      <option value="">Select account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.code}>{account.code} · {account.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Debit
                    <input type="number" step="0.0001" value={line.debit} onChange={(event) => updateJournalLine(index, "debit", event.target.value)} />
                  </label>
                  <label>
                    Credit
                    <input type="number" step="0.0001" value={line.credit} onChange={(event) => updateJournalLine(index, "credit", event.target.value)} />
                  </label>
                  <label>
                    Memo
                    <input value={line.description} onChange={(event) => updateJournalLine(index, "description", event.target.value)} />
                  </label>
                </div>
              ))}

              <div className="finance-actions">
                <button type="button" className="finance-secondary" onClick={addJournalLine}>Add line</button>
                <button type="submit" className="finance-primary" disabled={saving}>
                  {saving ? "Creating..." : "Create journal"}
                </button>
              </div>
            </form>
          )}

          <div className="finance-list">
            <div className="finance-list-heading">
              <h2>Journal Entries</h2>
              <span>{journals.length} entries</span>
            </div>
            {!journals.length ? (
              <div className="finance-state">No journals created yet.</div>
            ) : (
              <div className="finance-table-wrap">
                <table className="finance-table">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Description</th>
                      <th>Status</th>
                      <th>Lines</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journals.map((journal) => (
                      <tr key={journal.id}>
                        <td>{journal.documentNumber}</td>
                        <td>{journal.description ?? "-"}</td>
                        <td>{journal.status}</td>
                        <td>{journal.lines.length}</td>
                        <td>
                          {journal.status === "DRAFT" && permissionCodes.has("finance.journals.post") && (
                            <button type="button" className="finance-inline-action" onClick={() => void handlePostJournal(journal.id)}>
                              Post
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
