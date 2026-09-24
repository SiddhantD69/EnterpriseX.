-- EnterpriseX
-- Add Core Platform context permission to the development administrator role
--
-- Purpose:
--   The authenticated ERP context endpoint requires
--   core.organization.read.
--
--   Migration 008 predates this permission and therefore the
--   development ERP_ADMIN role does not have it.
--
--   This migration adds the permission and assigns it to ERP_ADMIN.

-- ============================================================
-- 1. Core organization read permission
-- ============================================================

INSERT INTO security.permissions (
    code,
    name,
    description
)
VALUES (
    'core.organization.read',
    'Read Core Organization',
    'Read access required to load the authenticated ERP organization context.'
)
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 2. ERP Administrator -> Core organization read
-- ============================================================

INSERT INTO security.role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM security.roles r
CROSS JOIN security.permissions p
WHERE r.code = 'ERP_ADMIN'
  AND p.code = 'core.organization.read'
ON CONFLICT (role_id, permission_id) DO NOTHING;