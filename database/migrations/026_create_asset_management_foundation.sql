CREATE SCHEMA IF NOT EXISTS asset_management;

CREATE TABLE IF NOT EXISTS asset_management.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'EQUIPMENT',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    cost NUMERIC(18,2) NOT NULL DEFAULT 0,
    location VARCHAR(255),
    description VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT assets_company_fk
        FOREIGN KEY (company_id) REFERENCES core.companies(id),
    CONSTRAINT assets_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT assets_company_code_unique
        UNIQUE (company_id, code),
    CONSTRAINT assets_category_check
        CHECK (category IN ('BUILDING', 'VEHICLE', 'MACHINE', 'IT', 'EQUIPMENT', 'FURNITURE')),
    CONSTRAINT assets_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'RETIRED')),
    CONSTRAINT assets_cost_check
        CHECK (cost >= 0)
);

CREATE TABLE IF NOT EXISTS asset_management.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PLANNED',
    manager_user_id UUID,
    start_date DATE,
    end_date DATE,
    budget NUMERIC(18,2) NOT NULL DEFAULT 0,
    description VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT projects_company_fk
        FOREIGN KEY (company_id) REFERENCES core.companies(id),
    CONSTRAINT projects_manager_user_fk
        FOREIGN KEY (manager_user_id) REFERENCES security.users(id),
    CONSTRAINT projects_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT projects_company_code_unique
        UNIQUE (company_id, code),
    CONSTRAINT projects_status_check
        CHECK (status IN ('PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT projects_budget_check
        CHECK (budget >= 0)
);

CREATE TABLE IF NOT EXISTS asset_management.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    project_id UUID,
    asset_id UUID,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    description VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT services_company_fk
        FOREIGN KEY (company_id) REFERENCES core.companies(id),
    CONSTRAINT services_project_fk
        FOREIGN KEY (company_id, project_id)
        REFERENCES asset_management.projects(company_id, id),
    CONSTRAINT services_asset_fk
        FOREIGN KEY (company_id, asset_id)
        REFERENCES asset_management.assets(company_id, id),
    CONSTRAINT services_company_id_id_unique
        UNIQUE (company_id, id),
    CONSTRAINT services_company_code_unique
        UNIQUE (company_id, code),
    CONSTRAINT services_status_check
        CHECK (status IN ('OPEN', 'IN_PROGRESS', 'HOLD', 'RESOLVED', 'CLOSED')),
    CONSTRAINT services_priority_check
        CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

INSERT INTO security.permissions (code, name, description)
VALUES
    ('assets.read', 'Read Assets', 'Read company asset records.'),
    ('assets.create', 'Create Assets', 'Create asset master records.'),
    ('projects.read', 'Read Projects', 'Read project records.'),
    ('projects.create', 'Create Projects', 'Create project records.'),
    ('services.read', 'Read Services', 'Read service requests and work orders.'),
    ('services.create', 'Create Services', 'Create service requests and work orders.')
ON CONFLICT (code) DO NOTHING;
