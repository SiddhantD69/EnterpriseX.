-- EnterpriseX
-- Migration: 002_create_migration_tracking
-- Purpose: Track executed database migrations.

CREATE TABLE IF NOT EXISTS core.schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);