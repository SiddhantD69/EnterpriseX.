-- EnterpriseX
-- Migration: 006_create_configuration_schema
-- Purpose: Create the foundational Core Platform configuration model.

CREATE SCHEMA IF NOT EXISTS core;

-- ============================================================
-- Configuration Definitions
-- ============================================================

CREATE TABLE IF NOT EXISTS core.configuration_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    key VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    owner_module VARCHAR(100) NOT NULL,

    data_type VARCHAR(20) NOT NULL,

    default_value TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT configuration_definitions_key_unique
        UNIQUE (key),

    CONSTRAINT configuration_definitions_data_type_check
        CHECK (
            data_type IN (
                'STRING',
                'INTEGER',
                'DECIMAL',
                'BOOLEAN',
                'DATE',
                'DATETIME',
                'JSON'
            )
        ),

    CONSTRAINT configuration_definitions_status_check
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE'
            )
        )
);

-- ============================================================
-- Configuration Values
-- ============================================================

CREATE TABLE IF NOT EXISTS core.configuration_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    configuration_definition_id UUID NOT NULL,

    scope_type VARCHAR(20) NOT NULL,

    scope_id UUID,

    value TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT configuration_values_definition_fk
        FOREIGN KEY (configuration_definition_id)
        REFERENCES core.configuration_definitions(id),

    CONSTRAINT configuration_values_scope_type_check
        CHECK (
            scope_type IN (
                'SYSTEM',
                'ORGANIZATION',
                'COMPANY'
            )
        ),

    CONSTRAINT configuration_values_scope_integrity_check
        CHECK (
            (scope_type = 'SYSTEM' AND scope_id IS NULL)
            OR
            (scope_type IN ('ORGANIZATION', 'COMPANY') AND scope_id IS NOT NULL)
        )
);

-- ============================================================
-- Configuration Value Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS configuration_values_definition_id_idx
    ON core.configuration_values (configuration_definition_id);

CREATE INDEX IF NOT EXISTS configuration_values_scope_idx
    ON core.configuration_values (scope_type, scope_id);

CREATE INDEX IF NOT EXISTS configuration_values_definition_scope_idx
    ON core.configuration_values (
        configuration_definition_id,
        scope_type,
        scope_id
    );

-- ============================================================
-- Scope-Aware Uniqueness
-- ============================================================

-- System configuration:
-- One value per configuration definition.

CREATE UNIQUE INDEX IF NOT EXISTS configuration_values_system_unique_idx
    ON core.configuration_values (configuration_definition_id)
    WHERE scope_type = 'SYSTEM';

-- Organization configuration:
-- One value per configuration definition and organization.

CREATE UNIQUE INDEX IF NOT EXISTS configuration_values_organization_unique_idx
    ON core.configuration_values (
        configuration_definition_id,
        scope_id
    )
    WHERE scope_type = 'ORGANIZATION';

-- Company configuration:
-- One value per configuration definition and company.

CREATE UNIQUE INDEX IF NOT EXISTS configuration_values_company_unique_idx
    ON core.configuration_values (
        configuration_definition_id,
        scope_id
    )
    WHERE scope_type = 'COMPANY';
