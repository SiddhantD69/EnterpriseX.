import { db } from "../../../infrastructure/database/pool.js";
import type { PlatformContext } from "../domain/platform-context.js";

export type DevelopmentSession = {
  userId: string;
  companyId: string;
};

export const getPlatformContext = async (
  session: DevelopmentSession,
): Promise<PlatformContext> => {
  const userResult = await db.query<{
    id: string;
    email: string;
    display_name: string;
  }>(
    `
      SELECT
        u.id,
        u.email,
        u.display_name
      FROM security.users u
      WHERE u.id = $1
        AND u.status = 'ACTIVE'
    `,
    [session.userId],
  );

  if (userResult.rowCount !== 1) {
    throw new Error("User context not found.");
  }

  const companyResult = await db.query<{
    company_id: string;
    company_code: string;
    company_name: string;
    organization_id: string;
    organization_code: string;
    organization_name: string;
  }>(
    `
      SELECT
        c.id AS company_id,
        c.code AS company_code,
        c.name AS company_name,
        o.id AS organization_id,
        o.code AS organization_code,
        o.name AS organization_name
      FROM core.companies c
      INNER JOIN core.organizations o
        ON o.id = c.organization_id
      INNER JOIN security.user_company_access uca
        ON uca.company_id = c.id
       AND uca.organization_id = c.organization_id
      WHERE c.id = $1
        AND uca.user_id = $2
        AND uca.status = 'ACTIVE'
        AND c.status = 'ACTIVE'
    `,
    [session.companyId, session.userId],
  );

  if (companyResult.rowCount !== 1) {
    throw new Error("Company context not found.");
  }

  const permissionResult = await db.query<{
    code: string;
    name: string;
  }>(
    `
      SELECT DISTINCT
        p.code,
        p.name
      FROM security.permissions p
      INNER JOIN security.role_permissions rp
        ON rp.permission_id = p.id
      INNER JOIN security.user_roles ur
        ON ur.role_id = rp.role_id
      WHERE ur.user_id = $1
        AND ur.company_id = $2
      ORDER BY p.code
    `,
    [session.userId, session.companyId],
  );

  const user = userResult.rows[0];
  const company = companyResult.rows[0];

  return {
    user: {
      userId: user.id,
      email: user.email,
      displayName: user.display_name,
    },

    organization: {
      id: company.organization_id,
      code: company.organization_code,
      name: company.organization_name,
    },

    company: {
      id: company.company_id,
      code: company.company_code,
      name: company.company_name,
    },

    permissions: permissionResult.rows,
  };
};