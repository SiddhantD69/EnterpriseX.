-- EnterpriseX
-- Migration: 005_create_authorization_schema
-- Purpose: Create the foundational Security & Identity authorization model.

CREATE SCHEMA IF NOT EXISTS security;

-- ============================================================
-- Roles
-- ============================================================

CREATE TABLE IF NOT EXISTS security.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT roles_code_unique
        UNIQUE (code),

    CONSTRAINT roles_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

-- ============================================================
-- Permissions
-- ============================================================

CREATE TABLE IF NOT EXISTS security.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(150) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT permissions_code_unique
        UNIQUE (code)
);

-- ============================================================
-- Role Permissions
-- ============================================================

CREATE TABLE IF NOT EXISTS security.role_permissions (
    role_id UUID NOT NULL,
    permission_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT role_permissions_pk
        PRIMARY KEY (role_id, permission_id),

    CONSTRAINT role_permissions_role_fk
        FOREIGN KEY (role_id)
        REFERENCES security.roles(id),

    CONSTRAINT role_permissions_permission_fk
        FOREIGN KEY (permission_id)
        REFERENCES security.permissions(id)
);

CREATE INDEX IF NOT EXISTS role_permissions_permission_id_idx
    ON security.role_permissions (permission_id);

-- ============================================================
-- User Roles
-- Company-scoped role assignments
-- ============================================================

CREATE TABLE IF NOT EXISTS security.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,
    company_id UUID NOT NULL,
    role_id UUID NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_roles_user_fk
        FOREIGN KEY (user_id)
        REFERENCES security.users(id),

    CONSTRAINT user_roles_company_fk
        FOREIGN KEY (company_id)
        REFERENCES core.companies(id),

    CONSTRAINT user_roles_role_fk
        FOREIGN KEY (role_id)
        REFERENCES security.roles(id),

    CONSTRAINT user_roles_unique
        UNIQUE (user_id, company_id, role_id),

    CONSTRAINT user_roles_status_check
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX IF NOT EXISTS user_roles_user_id_idx
    ON security.user_roles (user_id);

CREATE INDEX IF NOT EXISTS user_roles_company_id_idx
    ON security.user_roles (company_id);

CREATE INDEX IF NOT EXISTS user_roles_role_id_idx
    ON security.user_roles (role_id);

CREATE INDEX IF NOT EXISTS user_roles_user_company_idx
    ON security.user_roles (user_id, company_id);

-- ============================================================
-- Authorization Integrity
-- ============================================================

-- A user role assignment must only be meaningful for a company
-- that the user is permitted to access.
--
-- Enforcement of this business rule will be handled by the
-- authorization/application layer until a stronger database-level
-- composite relationship is introduced.
