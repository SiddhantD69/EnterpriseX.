-- EnterpriseX
-- Core Platform Configuration permissions

INSERT INTO security.permissions (
    code,
    name,
    description
)
VALUES
(
    'core.configuration.read',
    'Read Core Configuration',
    'Read access to Core Platform configuration.'
),
(
    'core.configuration.write',
    'Write Core Configuration',
    'Write access to Core Platform configuration.'
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
      'core.configuration.read',
      'core.configuration.write'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
