-- EnterpriseX
-- Migration: 013_seed_core_configuration
-- Purpose: Seed deterministic development configuration definitions.

INSERT INTO core.configuration_definitions (
    key,
    name,
    description,
    owner_module,
    data_type,
    default_value,
    status
)
VALUES (
    'core.company.display_name',
    'Company Display Name',
    'Display name configuration for the active company context.',
    'core-platform',
    'STRING',
    NULL,
    'ACTIVE'
)
ON CONFLICT (key) DO NOTHING;
