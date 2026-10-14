
-- EnterpriseX
-- Migration: 016_add_core_master_data_permissions
-- Purpose: Add permissions for Core Master Data APIs.

INSERT INTO security.permissions (code, name, description)
VALUES
    (
        'core.plants.read',
        'Read Plants',
        'Read plants belonging to the authenticated company.'
    ),
    (
        'core.plants.create',
        'Create Plants',
        'Create plants for the authenticated company.'
    ),
    (
        'core.plants.update',
        'Update Plants',
        'Update plants belonging to the authenticated company.'
    ),
    (
        'core.warehouses.read',
        'Read Warehouses',
        'Read warehouses belonging to the authenticated company.'
    ),
    (
        'core.warehouses.create',
        'Create Warehouses',
        'Create warehouses for the authenticated company.'
    ),
    (
        'core.warehouses.update',
        'Update Warehouses',
        'Update warehouses belonging to the authenticated company.'
    ),
    (
        'core.storage_locations.read',
        'Read Storage Locations',
        'Read storage locations belonging to the authenticated company.'
    ),
    (
        'core.storage_locations.create',
        'Create Storage Locations',
        'Create storage locations for the authenticated company.'
    ),
    (
        'core.storage_locations.update',
        'Update Storage Locations',
        'Update storage locations belonging to the authenticated company.'
    )
ON CONFLICT (code) DO NOTHING;


-- Grant master-data permissions to ERP_ADMIN.
INSERT INTO security.role_permissions (role_id, permission_id)
SELECT
    r.id,
    p.id
FROM security.roles AS r
CROSS JOIN security.permissions AS p
WHERE r.code = 'ERP_ADMIN'
  AND p.code IN (
      'core.plants.read',
      'core.plants.create',
      'core.plants.update',
      'core.warehouses.read',
      'core.warehouses.create',
      'core.warehouses.update',
      'core.storage_locations.read',
      'core.storage_locations.create',
      'core.storage_locations.update'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
