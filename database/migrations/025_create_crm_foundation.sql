CREATE SCHEMA IF NOT EXISTS crm;

CREATE TABLE IF NOT EXISTS crm.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(320),
    phone VARCHAR(50),
    company_name VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'NEW',
    source VARCHAR(30) NOT NULL DEFAULT 'WEB',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT leads_company_fk
        FOREIGN KEY (company_id) REFERENCES core.companies(id),
    CONSTRAINT leads_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT leads_company_email_unique
        UNIQUE (company_id, email),
    CONSTRAINT leads_status_check
        CHECK (status IN ('NEW', 'CONTACTED', 'QUALIFIED', 'LOST', 'CUSTOMER')),
    CONSTRAINT leads_source_check
        CHECK (source IN ('WEB', 'REFERRAL', 'PARTNER', 'SALE', 'OTHER'))
);

CREATE TABLE IF NOT EXISTS crm.opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    lead_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    stage VARCHAR(30) NOT NULL DEFAULT 'PROSPECTING',
    amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    probability INTEGER NOT NULL DEFAULT 0,
    close_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT opportunities_company_fk
        FOREIGN KEY (company_id) REFERENCES core.companies(id),
    CONSTRAINT opportunities_lead_fk
        FOREIGN KEY (company_id, lead_id)
        REFERENCES crm.leads(company_id, id),
    CONSTRAINT opportunities_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT opportunities_stage_check
        CHECK (stage IN ('PROSPECTING', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST')),
    CONSTRAINT opportunities_probability_check
        CHECK (probability BETWEEN 0 AND 100),
    CONSTRAINT opportunities_amount_check
        CHECK (amount >= 0)
);

INSERT INTO security.permissions (code, name, description)
VALUES
    ('crm.read', 'Read CRM', 'Read CRM lead and opportunity information.'),
    ('crm.leads.read', 'Read Leads', 'Read CRM leads for the current company.'),
    ('crm.leads.create', 'Create Leads', 'Create CRM lead records.'),
    ('crm.opportunities.read', 'Read Opportunities', 'Read CRM opportunities for the current company.'),
    ('crm.opportunities.create', 'Create Opportunities', 'Create CRM opportunity records.')
ON CONFLICT (code) DO NOTHING;
