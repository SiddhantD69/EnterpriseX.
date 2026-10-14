import type { PoolClient } from "pg";

import { db } from "../../../infrastructure/database/pool.js";
import type { SecurityUserStatus } from "./user-repository.js";

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  status: SecurityUserStatus;
  createdAt: string;
};

export type AdminRole = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  companyId: string | null;
  permissionCodes: string[];
};

export type AdminPermission = {
  code: string;
  name: string;
  description: string | null;
};

export type CompanyAccess = {
  companyId: string;
  companyCode: string;
  companyName: string;
  status: "ACTIVE" | "INACTIVE";
};

export type UserRoleAssignment = {
  roleId: string;
  roleCode: string;
  roleName: string;
  status: "ACTIVE" | "INACTIVE";
};

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  status: SecurityUserStatus;
  created_at: Date | string;
};

const mapUser = (row: UserRow): AdminUser => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
  status: row.status,
  createdAt: new Date(row.created_at).toISOString(),
});

export const listUsersForCompany = async (
  companyId: string,
): Promise<AdminUser[]> => {
  const result = await db.query<UserRow>(
    `
      SELECT DISTINCT u.id, u.email, u.display_name, u.status, u.created_at
      FROM security.users u
      INNER JOIN security.user_company_access access
        ON access.user_id = u.id AND access.company_id = $1
      WHERE access.status = 'ACTIVE'
      ORDER BY u.email
      LIMIT 500
    `,
    [companyId],
  );
  return result.rows.map(mapUser);
};

export const createUserWithCompanyAccess = async (
  client: PoolClient,
  input: {
    email: string;
    displayName: string;
    passwordHash: string;
    organizationId: string;
    companyId: string;
  },
): Promise<AdminUser> => {
  const user = await client.query<UserRow>(
    `
      INSERT INTO security.users (email, display_name, status)
      VALUES ($1, $2, 'ACTIVE')
      RETURNING id, email, display_name, status, created_at
    `,
    [input.email, input.displayName],
  );
  const row = user.rows[0];
  await client.query(
    `
      INSERT INTO security.user_credentials (user_id, password_hash, password_changed_at)
      VALUES ($1, $2, NOW())
    `,
    [row.id, input.passwordHash],
  );
  await client.query(
    `
      INSERT INTO security.user_company_access (
        user_id, organization_id, company_id, status
      )
      VALUES ($1, $2, $3, 'ACTIVE')
    `,
    [row.id, input.organizationId, input.companyId],
  );
  return mapUser(row);
};

export const updateCompanyUser = async (
  client: PoolClient,
  companyId: string,
  userId: string,
  input: { email: string; displayName: string; status: "ACTIVE" | "INACTIVE" },
): Promise<AdminUser | null> => {
  const result = await client.query<UserRow>(
    `
      UPDATE security.users u
      SET email = $1, display_name = $2, status = $3, updated_at = NOW()
      WHERE u.id = $4
        AND EXISTS (
          SELECT 1 FROM security.user_company_access access
          WHERE access.user_id = u.id
            AND access.company_id = $5
        )
      RETURNING u.id, u.email, u.display_name, u.status, u.created_at
    `,
    [input.email, input.displayName, input.status, userId, companyId],
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
};

export const getUserCompanyAccess = async (
  userId: string,
  organizationId: string,
): Promise<CompanyAccess[]> => {
  const result = await db.query<{
    company_id: string;
    company_code: string;
    company_name: string;
    status: CompanyAccess["status"];
  }>(
    `
      SELECT access.company_id, company.code AS company_code,
             company.name AS company_name, access.status
      FROM security.user_company_access access
      INNER JOIN core.companies company ON company.id = access.company_id
      WHERE access.user_id = $1
        AND access.organization_id = $2
      ORDER BY company.code
    `,
    [userId, organizationId],
  );
  return result.rows.map((row) => ({
    companyId: row.company_id,
    companyCode: row.company_code,
    companyName: row.company_name,
    status: row.status,
  }));
};

export const grantCompanyAccess = async (
  client: PoolClient,
  organizationId: string,
  companyId: string,
  userId: string,
): Promise<void> => {
  await client.query(
    `
      INSERT INTO security.user_company_access (
        user_id, organization_id, company_id, status
      )
      VALUES ($1, $2, $3, 'ACTIVE')
      ON CONFLICT (user_id, company_id)
      DO UPDATE SET status = 'ACTIVE', updated_at = NOW()
    `,
    [userId, organizationId, companyId],
  );
};

export const listRoles = async (companyId: string): Promise<AdminRole[]> => {
  const roleResult = await db.query<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    status: AdminRole["status"];
    company_id: string | null;
  }>(
    `
      SELECT id, code, name, description, status, company_id
      FROM security.roles
      WHERE company_id IS NULL OR company_id = $1
      ORDER BY code
      LIMIT 500
    `,
    [companyId],
  );
  const permissionResult = await db.query<{
    role_id: string;
    permission_code: string;
  }>(
    `
      SELECT rp.role_id, permission.code AS permission_code
      FROM security.role_permissions rp
      INNER JOIN security.permissions permission ON permission.id = rp.permission_id
      INNER JOIN security.roles role ON role.id = rp.role_id
      WHERE role.company_id IS NULL OR role.company_id = $1
      ORDER BY permission.code
    `,
    [companyId],
  );
  const permissions = new Map<string, string[]>();
  for (const row of permissionResult.rows) {
    const current = permissions.get(row.role_id) ?? [];
    current.push(row.permission_code);
    permissions.set(row.role_id, current);
  }
  return roleResult.rows.map((role) => ({
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    status: role.status,
    companyId: role.company_id,
    permissionCodes: permissions.get(role.id) ?? [],
  }));
};

export const listPermissions = async (): Promise<AdminPermission[]> => {
  const result = await db.query<AdminPermission>(
    `SELECT code, name, description FROM security.permissions ORDER BY code LIMIT 1000`,
  );
  return result.rows;
};

export const createRole = async (
  client: PoolClient,
  input: { code: string; name: string; description: string | null; companyId: string },
): Promise<{ id: string; code: string; name: string; description: string | null; status: "ACTIVE"; companyId: string }> => {
  const result = await client.query<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    status: "ACTIVE";
    company_id: string;
  }>(
    `
      INSERT INTO security.roles (code, name, description, company_id, status)
      VALUES ($1, $2, $3, $4, 'ACTIVE')
      RETURNING id, code, name, description, company_id, status
    `,
    [input.code, input.name, input.description, input.companyId],
  );
  const row = result.rows[0];
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    status: row.status,
    companyId: row.company_id,
  };
};

export const assignPermissionsToRole = async (
  client: PoolClient,
  roleId: string,
  permissionCodes: string[],
): Promise<void> => {
  const permissionResult = await client.query<{ id: string; code: string }>(
    `SELECT id, code FROM security.permissions WHERE code = ANY($1::varchar[])`,
    [permissionCodes],
  );
  if (permissionResult.rowCount !== permissionCodes.length) {
    const found = new Set(permissionResult.rows.map((row) => row.code));
    const missing = permissionCodes.filter((code) => !found.has(code));
    throw new Error(`Unknown permission codes: ${missing.join(", ")}`);
  }
  for (const permission of permissionResult.rows) {
    await client.query(
      `INSERT INTO security.role_permissions (role_id, permission_id) VALUES ($1, $2)`,
      [roleId, permission.id],
    );
  }
};

export const replaceRolePermissions = async (
  client: PoolClient,
  roleId: string,
  permissionCodes: string[],
): Promise<void> => {
  await client.query(`DELETE FROM security.role_permissions WHERE role_id = $1`, [roleId]);
  await assignPermissionsToRole(client, roleId, permissionCodes);
};

export const updateRole = async (
  client: PoolClient,
  companyId: string,
  roleId: string,
  input: { name: string; description: string | null; status: "ACTIVE" | "INACTIVE" },
): Promise<{ id: string; code: string; name: string; description: string | null; status: "ACTIVE" | "INACTIVE"; companyId: string } | null> => {
  const result = await client.query<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    status: "ACTIVE" | "INACTIVE";
    company_id: string;
  }>(
    `
      UPDATE security.roles
      SET name = $1, description = $2, status = $3, updated_at = NOW()
      WHERE id = $4
        AND code <> 'ERP_ADMIN'
        AND company_id = $5
      RETURNING id, code, name, description, company_id, status
    `,
    [input.name, input.description, input.status, roleId, companyId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    status: row.status,
    companyId: row.company_id,
  };
};

export const listUserRoleAssignments = async (
  companyId: string,
  userId: string,
): Promise<UserRoleAssignment[]> => {
  const result = await db.query<{
    role_id: string;
    role_code: string;
    role_name: string;
    status: UserRoleAssignment["status"];
  }>(
    `
      SELECT ur.role_id, role.code AS role_code, role.name AS role_name, ur.status
      FROM security.user_roles ur
      INNER JOIN security.roles role ON role.id = ur.role_id
      WHERE ur.company_id = $1 AND ur.user_id = $2
      ORDER BY role.code
    `,
    [companyId, userId],
  );
  return result.rows.map((row) => ({
    roleId: row.role_id,
    roleCode: row.role_code,
    roleName: row.role_name,
    status: row.status,
  }));
};

export const assignRoleToCompanyUser = async (
  client: PoolClient,
  companyId: string,
  userId: string,
  roleId: string,
  status: "ACTIVE" | "INACTIVE",
): Promise<boolean> => {
  const result = await client.query(
    `
      INSERT INTO security.user_roles (user_id, role_id, company_id, status)
      SELECT $1, role.id, $2, $4
      FROM security.roles role
      WHERE role.id = $3
        AND role.status = 'ACTIVE'
        AND (role.company_id IS NULL OR role.company_id = $2)
        AND EXISTS (
          SELECT 1 FROM security.user_company_access access
          WHERE access.user_id = $1 AND access.company_id = $2 AND access.status = 'ACTIVE'
        )
      ON CONFLICT (user_id, company_id, role_id)
      DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
    `,
    [userId, companyId, roleId, status],
  );
  return (result.rowCount ?? 0) === 1;
};