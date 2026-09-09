-- EnterpriseX
-- Development seed for Core Platform context
--
-- Purpose:
--   Create deterministic development data for local development:
--   - Organization
--   - Company
--   - Development user
--   - ERP Administrator role
--   - Read permissions
--   - User/company access
--   - Role permissions
--   - User role assignment
--
-- Important:
--   This migration creates NO authentication credentials.
--   It is development seed data only.

-- ============================================================
-- 1. Development Organization
-- ============================================================

INSERT INTO core.organizations (
    code,
    name,
    status
)
VALUES (
    'ENTX-DEV',
    'EnterpriseX Development Organization',
    'ACTIVE'
)
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 2. Development Company
-- ============================================================

INSERT INTO core.companies (
    organization_id,
    code,
    name,
    status
)
SELECT
    o.id,
    'ENTX-DEV-CO',
    'EnterpriseX Development Company',
    'ACTIVE'
FROM core.organizations o
WHERE o.code = 'ENTX-DEV'
ON CONFLICT (organization_id, code) DO NOTHING;


-- ============================================================
-- 3. Development User
-- ============================================================

INSERT INTO security.users (
    email,
    display_name,
    status
)
VALUES (
    'developer@enterprisex.local',
    'EnterpriseX Developer',
    'ACTIVE'
)
ON CONFLICT (email) DO NOTHING;


-- ============================================================
-- 4. ERP Administrator Role
-- ============================================================

INSERT INTO security.roles (
    code,
    name,
    description,
    status
)
VALUES (
    'ERP_ADMIN',
    'ERP Administrator',
    'Development administrator role for EnterpriseX.',
    'ACTIVE'
)
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 5. Development Permissions
-- ============================================================

INSERT INTO security.permissions (
    code,
    name,
    description
)
VALUES
    (
        'finance.read',
        'Read Finance',
        'Read access to Finance functionality.'
    ),
    (
        'procurement.read',
        'Read Procurement',
        'Read access to Procurement functionality.'
    ),
    (
        'supply_chain.read',
        'Read Supply Chain',
        'Read access to Supply Chain functionality.'
    ),
    (
        'inventory.read',
        'Read Inventory',
        'Read access to Inventory functionality.'
    ),
    (
        'warehouse.read',
        'Read Warehouse',
        'Read access to Warehouse functionality.'
    ),
    (
        'sales.read',
        'Read Sales',
        'Read access to Sales functionality.'
    ),
    (
        'crm.read',
        'Read CRM',
        'Read access to CRM functionality.'
    ),
    (
        'manufacturing.read',
        'Read Manufacturing',
        'Read access to Manufacturing functionality.'
    ),
    (
        'hr.read',
        'Read HR',
        'Read access to HR functionality.'
    ),
    (
        'assets.read',
        'Read Asset Management',
        'Read access to Asset Management functionality.'
    ),
    (
        'projects.read',
        'Read Projects',
        'Read access to Projects functionality.'
    ),
    (
        'service.read',
        'Read Service Management',
        'Read access to Service Management functionality.'
    )
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 6. User -> Organization/Company Access
-- ============================================================

INSERT INTO security.user_company_access (
    user_id,
    organization_id,
    company_id,
    status
)
SELECT
    u.id,
    o.id,
    c.id,
    'ACTIVE'
FROM security.users u
INNER JOIN core.organizations o
    ON o.code = 'ENTX-DEV'
INNER JOIN core.companies c
    ON c.organization_id = o.id
   AND c.code = 'ENTX-DEV-CO'
WHERE u.email = 'developer@enterprisex.local'
ON CONFLICT (user_id, company_id) DO NOTHING;


-- ============================================================
-- 7. ERP Administrator Role -> Permissions
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
  AND p.code IN (
      'finance.read',
      'procurement.read',
      'supply_chain.read',
      'inventory.read',
      'warehouse.read',
      'sales.read',
      'crm.read',
      'manufacturing.read',
      'hr.read',
      'assets.read',
      'projects.read',
      'service.read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- ============================================================
-- 8. Development User -> ERP Administrator Role
-- ============================================================

INSERT INTO security.user_roles (
    user_id,
    company_id,
    role_id,
    status
)
SELECT
    u.id,
    c.id,
    r.id,
    'ACTIVE'
FROM security.users u
INNER JOIN core.companies c
    ON c.code = 'ENTX-DEV-CO'
INNER JOIN security.roles r
    ON r.code = 'ERP_ADMIN'
WHERE u.email = 'developer@enterprisex.local'
ON CONFLICT (user_id, company_id, role_id) DO NOTHING;