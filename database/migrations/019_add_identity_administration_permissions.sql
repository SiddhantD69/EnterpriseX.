INSERT INTO security.permissions (code, name, description)
VALUES
    ('core.organizations.read', 'Read Organizations', 'Read organization records.'),
    ('core.organizations.create', 'Create Organizations', 'Create organizations.'),
    ('core.organizations.update', 'Update Organizations', 'Update organization status.'),
    ('core.companies.read', 'Read Companies', 'Read companies in the authenticated organization.'),
    ('core.companies.create', 'Create Companies', 'Create companies in the authenticated organization.'),
    ('core.companies.update', 'Update Companies', 'Update company status in the authenticated organization.'),
    ('security.users.read', 'Read Users', 'Read users accessible to the authenticated company.'),
    ('security.users.create', 'Create Users', 'Create users with access to the authenticated company.'),
    ('security.users.update', 'Update Users', 'Update user details and lifecycle status.'),
    ('security.roles.read', 'Read Roles', 'Read roles and permissions.'),
    ('security.roles.create', 'Create Roles', 'Create roles and assign existing permissions.'),
    ('security.roles.update', 'Update Roles', 'Update non-system roles and their permissions.'),
    ('security.user_roles.manage', 'Manage User Roles', 'Assign and deactivate company-scoped user roles.'),
    ('security.user_company_access.manage', 'Manage Company Access', 'Grant access to companies in the authenticated organization.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO security.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM security.roles r
CROSS JOIN security.permissions p
WHERE r.code = 'ERP_ADMIN'
  AND p.code IN (
      'core.organizations.read',
      'core.organizations.create',
      'core.organizations.update',
      'core.companies.read',
      'core.companies.create',
      'core.companies.update',
      'security.users.read',
      'security.users.create',
      'security.users.update',
      'security.roles.read',
      'security.roles.create',
      'security.roles.update',
      'security.user_roles.manage',
      'security.user_company_access.manage'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;