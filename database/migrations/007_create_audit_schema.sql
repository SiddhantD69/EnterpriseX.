-- EnterpriseX
-- Migration: 007_create_audit_schema
-- Purpose: Create the foundational Core Audit event model.

CREATE SCHEMA IF NOT EXISTS core;

CREATE TABLE IF NOT EXISTS core.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    actor_user_id UUID,

    organization_id UUID,
    company_id UUID,

    action VARCHAR(100) NOT NULL,

    entity_type VARCHAR(150) NOT NULL,
    entity_id UUID,

    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',

    before_data JSONB,
    after_data JSONB,

    request_id VARCHAR(100),

    correlation_id VARCHAR(100),

    source_module VARCHAR(100) NOT NULL,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT audit_events_actor_user_fk
        FOREIGN KEY (actor_user_id)
        REFERENCES security.users(id),

    CONSTRAINT audit_events_organization_fk
        FOREIGN KEY (organization_id)
        REFERENCES core.organizations(id),

    CONSTRAINT audit_events_company_fk
        FOREIGN KEY (company_id)
        REFERENCES core.companies(id),

    CONSTRAINT audit_events_status_check
        CHECK (
            status IN (
                'SUCCESS',
                'FAILURE'
            )
        )
);

CREATE INDEX IF NOT EXISTS audit_events_occurred_at_idx
    ON core.audit_events (occurred_at);

CREATE INDEX IF NOT EXISTS audit_events_actor_user_id_idx
    ON core.audit_events (actor_user_id);

CREATE INDEX IF NOT EXISTS audit_events_organization_id_idx
    ON core.audit_events (organization_id);

CREATE INDEX IF NOT EXISTS audit_events_company_id_idx
    ON core.audit_events (company_id);

CREATE INDEX IF NOT EXISTS audit_events_action_idx
    ON core.audit_events (action);

CREATE INDEX IF NOT EXISTS audit_events_entity_idx
    ON core.audit_events (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS audit_events_source_module_idx
    ON core.audit_events (source_module);

CREATE INDEX IF NOT EXISTS audit_events_request_id_idx
    ON core.audit_events (request_id);

CREATE INDEX IF NOT EXISTS audit_events_correlation_id_idx
    ON core.audit_events (correlation_id);