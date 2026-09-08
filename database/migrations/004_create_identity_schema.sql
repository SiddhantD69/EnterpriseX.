-- EnterpriseX
-- Migration: 004_create_identity_schema
-- Purpose: Create the foundational Security & Identity user model.

CREATE SCHEMA IF NOT EXISTS security;

-- ============================================================
-- USERS
-- Canonical enterprise user identity.
-- ============================================================

CREATE TABLE IF NOT EXISTS security.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    email VARCHAR(320) NOT NULL,
    display_name VARCHAR(255) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_email_unique
        UNIQUE (email),

    CONSTRAINT users_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOCKED'))
);

-- ============================================================
-- USER CREDENTIALS
-- Authentication material is kept separate from user identity.
-- Passwords are NEVER stored directly.
-- ============================================================

CREATE TABLE IF NOT EXISTS security.user_credentials (
    user_id UUID PRIMARY KEY,

    password_hash VARCHAR(255),

    password_changed_at TIMESTAMPTZ,

    failed_login_attempts INTEGER NOT NULL DEFAULT 0,

    locked_until TIMESTAMPTZ,

    last_login_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_credentials_user_fk
        FOREIGN KEY (user_id)
        REFERENCES security.users(id)
        ON DELETE CASCADE,

    CONSTRAINT user_credentials_failed_attempts_check
        CHECK (failed_login_attempts >= 0)
);

-- ============================================================
-- USER ORGANIZATION / COMPANY ACCESS
--
-- Defines where a user is allowed to operate.
-- Roles and permissions are deliberately handled separately.
-- ============================================================

CREATE TABLE IF NOT EXISTS security.user_company_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    company_id UUID NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_company_access_user_fk
        FOREIGN KEY (user_id)
        REFERENCES security.users(id),

    CONSTRAINT user_company_access_organization_fk
        FOREIGN KEY (organization_id)
        REFERENCES core.organizations(id),

    CONSTRAINT user_company_access_company_fk
        FOREIGN KEY (company_id)
        REFERENCES core.companies(id),

    CONSTRAINT user_company_access_unique
        UNIQUE (user_id, company_id),

    CONSTRAINT user_company_access_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX IF NOT EXISTS user_company_access_user_id_idx
    ON security.user_company_access (user_id);

CREATE INDEX IF NOT EXISTS user_company_access_organization_id_idx
    ON security.user_company_access (organization_id);

CREATE INDEX IF NOT EXISTS user_company_access_company_id_idx
    ON security.user_company_access (company_id);