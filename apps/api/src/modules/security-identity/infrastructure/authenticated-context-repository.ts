import { db } from "../../../infrastructure/database/pool.js";

import type {
  AuthenticatedContext,
  AuthenticatedPermissionContext,
  AuthenticatedRoleContext,
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

  role_id: string | null;
  role_code: string | null;
  role_name: string | null;

  permission_code: string | null;
  permission_name: string | null;
};

export const findAuthenticatedContextBySessionId =
  async (
    sessionId: string,
  ): Promise<AuthenticatedContext | null> => {
    const result =
      await db.query<AuthenticatedContextRow>(
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
           AND uca.company_id = s.company_id
           AND uca.status = 'ACTIVE'

          INNER JOIN core.companies c
            ON c.id = s.company_id
           AND c.organization_id = uca.organization_id
           AND c.status = 'ACTIVE'

          INNER JOIN core.organizations o
            ON o.id = c.organization_id
           AND o.status = 'ACTIVE'

          LEFT JOIN security.user_roles ur
            ON ur.user_id = u.id
           AND ur.company_id = c.id
           AND ur.status = 'ACTIVE'

          LEFT JOIN security.roles r
            ON r.id = ur.role_id
           AND r.status = 'ACTIVE'

          LEFT JOIN security.role_permissions rp
            ON rp.role_id = r.id

          LEFT JOIN security.permissions p
            ON p.id = rp.permission_id

          WHERE s.id = $1
            AND s.status = 'ACTIVE'
            AND s.company_id IS NOT NULL
            AND s.expires_at > NOW()
            AND u.status = 'ACTIVE'

          ORDER BY
            r.code NULLS LAST,
            p.code NULLS LAST
        `,
        [sessionId],
      );

    if (result.rows.length === 0) {
      return null;
    }

    const firstRow =
      result.rows[0];

    const roles =
      new Map<
        string,
        AuthenticatedRoleContext
      >();

    const permissions =
      new Map<
        string,
        AuthenticatedPermissionContext
      >();

    for (const row of result.rows) {
      if (
        row.role_id &&
        row.role_code &&
        row.role_name
      ) {
        roles.set(
          row.role_id,
          {
            id: row.role_id,
            code: row.role_code,
            name: row.role_name,
          },
        );
      }

      if (
        row.permission_code &&
        row.permission_name
      ) {
        permissions.set(
          row.permission_code,
          {
            code:
              row.permission_code,
            name:
              row.permission_name,
          },
        );
      }
    }

    return {
      sessionId:
        firstRow.session_id,

      user: {
        userId:
          firstRow.user_id,
        email:
          firstRow.email,
        displayName:
          firstRow.display_name,
      },

      organization: {
        id:
          firstRow.organization_id,
        code:
          firstRow.organization_code,
        name:
          firstRow.organization_name,
      },

      company: {
        id:
          firstRow.company_id,
        code:
          firstRow.company_code,
        name:
          firstRow.company_name,
      },

      roles: Array.from(
        roles.values(),
      ),

      permissions: Array.from(
        permissions.values(),
      ),
    };
  };