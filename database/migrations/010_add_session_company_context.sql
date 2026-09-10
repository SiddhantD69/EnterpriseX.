-- EnterpriseX
-- Migration 010
-- Add explicit company context to authenticated sessions

ALTER TABLE security.sessions
ADD COLUMN company_id UUID;

ALTER TABLE security.sessions
ADD CONSTRAINT fk_security_sessions_company
FOREIGN KEY (company_id)
REFERENCES core.companies(id);

CREATE INDEX IF NOT EXISTS idx_security_sessions_company_id
ON security.sessions(company_id);