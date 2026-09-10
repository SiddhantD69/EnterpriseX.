import { db } from "../../../infrastructure/database/pool.js";

import type {
  AuthenticatedCompanyContext,
  AuthenticatedContext,
  AuthenticatedOrganizationContext,
  AuthenticatedPermissionContext,
  AuthenticatedRoleContext,
  AuthenticatedUserContext,
} from "../domain/authenticated-context.js";

type AuthenticatedContextRow = {
  session_id: string;
  user_id: string;
  email: string;
  display_name: string;
  organization_id: string;
  organization_code: string;
  organization_name: string;
  company_id: string;
  company_code: string;
  company_name: string;
  role_id: string;
  role_code: string;
  role_name: string;
  permission_code: string;
  permission_name: string;
};

type AuthenticatedContextQueryResult = {
  rows: AuthenticatedContextRow[];
};

export const findAuthenticatedContextBySessionId =
  async (
    sessionId: string,
  ): Promise<AuthenticatedContext | null> => {
    const result =
      (await db.query<AuthenticatedContextRow>(
        `
          SELECT
            s.id AS session_id,

            u.id AS user_id,
            u.email,
            u.display_name,

            o.id AS organization_id,
            o.code AS organization_code,
            o.name AS organization_name,

            c.id AS company_id,
            c.code AS company_code,
            c.name AS company_name,

            r.id AS role_id,
            r.code AS role_code,
            r.name AS role_name,

            p.code AS permission_code,
            p.name AS permission_name

          FROM security.sessions s

          INNER JOIN security.users u
            ON u.id = s.user_id

          INNER JOIN security.user_company_access uca
            ON uca.user_id = u.id
           AND uca.status = 'ACTIVE'

          INNER JOIN core.companies c
            ON c.id = uca.company_id
           AND c.status = 'ACTIVE'

          INNER JOIN core.organizations o
            ON o.id = c.organization_id
           AND o.status = 'ACTIVE'

          INNER JOIN security.user_roles ur
            ON ur.user_id = u.id

          INNER JOIN security.roles r
            ON r.id = ur.role_id

          INNER JOIN security.role_permissions rp
            ON rp.role_id = r.id

          INNER JOIN security.permissions p
            ON p.id = rp.permission_id

          WHERE s.id = $1
            AND s.status = 'ACTIVE'
            AND s.expires_at > NOW()
            AND u.status = 'ACTIVE'

          ORDER BY
            r.code,
            p.code
        `,
        [sessionId],
      )) as AuthenticatedContextQueryResult;

    if (result.rows.length === 0) {
      return null;
    }

    const firstRow = result.rows[0];

    const user: AuthenticatedUserContext = {
      userId: firstRow.user_id,
      email: firstRow.email,
      displayName: firstRow.display_name,
    };

    const organization: AuthenticatedOrganizationContext = {
      id: firstRow.organization_id,
      code: firstRow.organization_code,
      name: firstRow.organization_name,
    };

    const company: AuthenticatedCompanyContext = {
      id: firstRow.company_id,
      code: firstRow.company_code,
      name: firstRow.company_name,
    };

    const roles = new Map<
      string,
      AuthenticatedRoleContext
    >();

    const permissions = new Map<
      string,
      AuthenticatedPermissionContext
    >();

    for (const row of result.rows) {
      roles.set(row.role_id, {
        id: row.role_id,
        code: row.role_code,
        name: row.role_name,
      });

      permissions.set(row.permission_code, {
        code: row.permission_code,
        name: row.permission_name,
      });
    }

    return {
      sessionId: firstRow.session_id,
      user,
      organization,
      company,
      roles: Array.from(roles.values()),
      permissions: Array.from(
        permissions.values(),
      ),
    };
  };