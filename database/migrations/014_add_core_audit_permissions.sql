-- EnterpriseX
-- Migration: 014_add_core_audit_permissions
-- Purpose: Add Core Audit permissions and assign them to ERP_ADMIN.

INSERT INTO security.permissions (
    code,
    name
)
VALUES
    (
        'core.audit.read',
        'Read Core Audit'
    ),
    (
        'core.audit.write',
        'Write Core Audit'
    )
ON CONFLICT (code) DO NOTHING;

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
  AND p.code IN (
      'core.audit.read',
      'core.audit.write'
  )
ON CONFLICT DO NOTHING;