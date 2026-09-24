import { db } from "../../../infrastructure/database/pool.js";

export type SelectableCompany = {
  organizationId: string;
  organizationCode: string;
  organizationName: string;
  companyId: string;
  companyCode: string;
  companyName: string;
};

export const findSelectableCompaniesByUserId = async (
  userId: string,
): Promise<SelectableCompany[]> => {
  const result = await db.query<SelectableCompany>(
    `
      SELECT
        o.id AS "organizationId",
        o.code AS "organizationCode",
        o.name AS "organizationName",

        c.id AS "companyId",
        c.code AS "companyCode",
        c.name AS "companyName"

      FROM security.user_company_access uca

      INNER JOIN core.companies c
        ON c.id = uca.company_id
       AND c.organization_id = uca.organization_id
       AND c.status = 'ACTIVE'

      INNER JOIN core.organizations o
        ON o.id = c.organization_id
       AND o.status = 'ACTIVE'

      WHERE uca.user_id = $1
        AND uca.status = 'ACTIVE'

      ORDER BY
        o.code,
        c.code
    `,
    [userId],
  );

  return result.rows;
};

export const findSelectableCompanyByUserId = async (
  userId: string,
  companyId: string,
): Promise<SelectableCompany | null> => {
  const result = await db.query<SelectableCompany>(
    `
      SELECT
        o.id AS "organizationId",
        o.code AS "organizationCode",
        o.name AS "organizationName",

        c.id AS "companyId",
        c.code AS "companyCode",
        c.name AS "companyName"

      FROM security.user_company_access uca

      INNER JOIN core.companies c
        ON c.id = uca.company_id
       AND c.organization_id = uca.organization_id
       AND c.status = 'ACTIVE'

      INNER JOIN core.organizations o
        ON o.id = c.organization_id
       AND o.status = 'ACTIVE'

      WHERE uca.user_id = $1
        AND uca.company_id = $2
        AND uca.status = 'ACTIVE'
      LIMIT 1
    `,
    [userId, companyId],
  );

  return result.rows[0] ?? null;
};