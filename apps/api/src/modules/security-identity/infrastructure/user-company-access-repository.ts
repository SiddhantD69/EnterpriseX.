import { db } from "../../../infrastructure/database/pool.js";

export type UserCompanyAccess = {
  organizationId: string;
  companyId: string;
};

export const findActiveCompanyAccessByUserId =
  async (
    userId: string,
  ): Promise<UserCompanyAccess[]> => {
    const result =
      await db.query<UserCompanyAccess>(
        `
          SELECT
            organization_id AS "organizationId",
            company_id AS "companyId"
          FROM security.user_company_access
          WHERE user_id = $1
            AND status = 'ACTIVE'
          ORDER BY company_id
        `,
        [userId],
      );

    return result.rows;
  };