CREATE SCHEMA IF NOT EXISTS finance;

CREATE TABLE IF NOT EXISTS finance.fiscal_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    period_code VARCHAR(30) NOT NULL,
    name VARCHAR(120) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    CONSTRAINT fiscal_periods_company_fk
        FOREIGN KEY (company_id) REFERENCES core.companies(id),
    CONSTRAINT fiscal_periods_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT fiscal_periods_company_code_unique
        UNIQUE (company_id, period_code),
    CONSTRAINT fiscal_periods_status_check
        CHECK (status IN ('OPEN', 'CLOSED')),
    CONSTRAINT fiscal_periods_date_check
        CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS finance.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(20) NOT NULL,
    normal_balance VARCHAR(10) NOT NULL,
    description VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT accounts_company_fk
        FOREIGN KEY (company_id) REFERENCES core.companies(id),
    CONSTRAINT accounts_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT accounts_company_code_unique
        UNIQUE (company_id, code),
    CONSTRAINT accounts_type_check
        CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    CONSTRAINT accounts_balance_check
        CHECK (normal_balance IN ('DEBIT', 'CREDIT')),
    CONSTRAINT accounts_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE IF NOT EXISTS finance.journal_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    fiscal_period_id UUID NOT NULL,
    document_number VARCHAR(50) NOT NULL,
    description VARCHAR(500),
    created_by UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    posted_at TIMESTAMPTZ,
    CONSTRAINT journal_headers_company_fk
        FOREIGN KEY (company_id) REFERENCES core.companies(id),
    CONSTRAINT journal_headers_period_fk
        FOREIGN KEY (fiscal_period_id) REFERENCES finance.fiscal_periods(id),
    CONSTRAINT journal_headers_created_by_fk
        FOREIGN KEY (created_by) REFERENCES security.users(id),
    CONSTRAINT journal_headers_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT journal_headers_company_number_unique
        UNIQUE (company_id, document_number),
    CONSTRAINT journal_headers_status_check
        CHECK (status IN ('DRAFT', 'POSTED'))
);

CREATE TABLE IF NOT EXISTS finance.journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    journal_id UUID NOT NULL,
    account_id UUID NOT NULL,
    line_number INTEGER NOT NULL,
    description VARCHAR(255),
    debit NUMERIC(18, 4) NOT NULL DEFAULT 0,
    credit NUMERIC(18, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT journal_lines_company_fk
        FOREIGN KEY (company_id) REFERENCES core.companies(id),
    CONSTRAINT journal_lines_journal_fk
        FOREIGN KEY (company_id, journal_id)
        REFERENCES finance.journal_headers(company_id, id),
    CONSTRAINT journal_lines_account_fk
        FOREIGN KEY (company_id, account_id)
        REFERENCES finance.accounts(company_id, id),
    CONSTRAINT journal_lines_number_unique
        UNIQUE (company_id, journal_id, line_number),
    CONSTRAINT journal_lines_amount_check
        CHECK (debit >= 0 AND credit >= 0 AND (debit > 0 OR credit > 0))
);

CREATE INDEX IF NOT EXISTS journal_headers_company_status_idx
    ON finance.journal_headers(company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS journal_lines_company_journal_idx
    ON finance.journal_lines(company_id, journal_id, line_number);

INSERT INTO security.permissions (code, name, description)
VALUES
    ('finance.read', 'Read Finance', 'Read finance views and reports.'),
    ('finance.accounts.read', 'Read Chart of Accounts', 'Read financial accounts.'),
    ('finance.accounts.create', 'Create Financial Accounts', 'Create company chart-of-accounts entries.'),
    ('finance.journals.read', 'Read Journal Entries', 'Read posted and draft journal entries.'),
    ('finance.journals.create', 'Create Journal Entries', 'Create valid journal entries.'),
    ('finance.journals.post', 'Post Journal Entries', 'Post balanced journal entries to the ledger.')
ON CONFLICT (code) DO NOTHING;
