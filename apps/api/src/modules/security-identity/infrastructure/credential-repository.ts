import { db } from "../../../infrastructure/database/pool.js";

export type UserCredential = {
  userId: string;
  passwordHash: string | null;
  passwordChangedAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
};

type UserCredentialRow = {
  user_id: string;
  password_hash: string | null;
  password_changed_at: Date | null;
  failed_login_attempts: number;
  locked_until: Date | null;
  last_login_at: Date | null;
};

const mapCredential = (
  row: UserCredentialRow,
): UserCredential => ({
  userId: row.user_id,
  passwordHash: row.password_hash,
  passwordChangedAt: row.password_changed_at,
  failedLoginAttempts: row.failed_login_attempts,
  lockedUntil: row.locked_until,
  lastLoginAt: row.last_login_at,
});

export const findCredentialsByUserId = async (
  userId: string,
): Promise<UserCredential | null> => {
  const result = await db.query<UserCredentialRow>(
    `
      SELECT
        user_id,
        password_hash,
        password_changed_at,
        failed_login_attempts,
        locked_until,
        last_login_at
      FROM security.user_credentials
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  );

  if (result.rowCount !== 1) {
    return null;
  }

  return mapCredential(result.rows[0]);
};

export const setPasswordHash = async (
  userId: string,
  passwordHash: string,
  changedAt: Date = new Date(),
): Promise<void> => {
  await db.query(
    `
      INSERT INTO security.user_credentials (
        user_id,
        password_hash,
        password_changed_at,
        failed_login_attempts,
        locked_until
      )
      VALUES ($1, $2, $3, 0, NULL)
      ON CONFLICT (user_id)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        password_changed_at = EXCLUDED.password_changed_at,
        failed_login_attempts = 0,
        locked_until = NULL,
        updated_at = NOW()
    `,
    [userId, passwordHash, changedAt],
  );
};

export const recordFailedLoginAttempt = async (
  userId: string,
): Promise<void> => {
  await db.query(
    `
      UPDATE security.user_credentials
      SET
        failed_login_attempts = failed_login_attempts + 1,
        updated_at = NOW()
      WHERE user_id = $1
    `,
    [userId],
  );
};

export const lockUserUntil = async (
  userId: string,
  lockedUntil: Date,
): Promise<void> => {
  await db.query(
    `
      UPDATE security.user_credentials
      SET
        locked_until = $2,
        updated_at = NOW()
      WHERE user_id = $1
    `,
    [userId, lockedUntil],
  );
};

export const resetLoginFailures = async (
  userId: string,
  lastLoginAt: Date = new Date(),
): Promise<void> => {
  await db.query(
    `
      UPDATE security.user_credentials
      SET
        failed_login_attempts = 0,
        locked_until = NULL,
        last_login_at = $2,
        updated_at = NOW()
      WHERE user_id = $1
    `,
    [userId, lastLoginAt],
  );
};