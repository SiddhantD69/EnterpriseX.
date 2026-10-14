-- EnterpriseX
-- Migration: 020_add_company_scoped_custom_roles
-- Purpose: Support company-scoped custom roles while keeping shared system roles global.

ALTER TABLE security.roles
    ADD COLUMN IF NOT EXISTS company_id UUID NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'roles_company_fk'
    ) THEN
        ALTER TABLE security.roles
            ADD CONSTRAINT roles_company_fk
            FOREIGN KEY (company_id)
            REFERENCES core.companies(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS roles_company_id_idx
    ON security.roles (company_id);

CREATE UNIQUE INDEX IF NOT EXISTS roles_company_code_unique
    ON security.roles (company_id, code)
    WHERE company_id IS NOT NULL;

-- Preserve the global/shared system role pattern. Existing system roles remain global
-- by leaving company_id NULL; company-specific custom roles will set this column.
