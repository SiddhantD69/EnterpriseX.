import { db } from "../../../infrastructure/database/pool.js";

export type SecurityUserStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "LOCKED";

export type SecurityUser = {
  id: string;
  email: string;
  displayName: string;
  status: SecurityUserStatus;
};

type SecurityUserRow = {
  id: string;
  email: string;
  display_name: string;
  status: SecurityUserStatus;
};

const mapUser = (
  row: SecurityUserRow,
): SecurityUser => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
  status: row.status,
});

export const findUserByEmail = async (
  email: string,
): Promise<SecurityUser | null> => {
  const result = await db.query<SecurityUserRow>(
    `
      SELECT
        id,
        email,
        display_name,
        status
      FROM security.users
      WHERE email = $1
      LIMIT 1
    `,
    [email],
  );

  if (result.rowCount !== 1) {
    return null;
  }

  return mapUser(result.rows[0]);
};