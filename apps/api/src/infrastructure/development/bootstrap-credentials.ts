import { db } from "../database/pool.js";
import { hashPassword } from "../../modules/security-identity/security/password-hasher.js";
import { setPasswordHash } from "../../modules/security-identity/infrastructure/credential-repository.js";

const developmentUserEmail = "developer@enterprisex.local";

const bootstrapDevelopmentCredentials = async (): Promise<void> => {
  if ((process.env.NODE_ENV ?? "development") === "production") {
    throw new Error(
      "Development credential bootstrap is disabled in production.",
    );
  }

  const password = process.env.ENTERPRISEX_DEV_PASSWORD;

  if (!password) {
    throw new Error(
      "ENTERPRISEX_DEV_PASSWORD environment variable is required.",
    );
  }

  const result = await db.query<{ id: string }>(
    `
      SELECT id
      FROM security.users
      WHERE LOWER(email) = LOWER($1)
        AND status = 'ACTIVE'
      LIMIT 1
    `,
    [developmentUserEmail],
  );

  if (result.rowCount !== 1) {
    throw new Error(
      `Development user ${developmentUserEmail} was not found.`,
    );
  }

  const passwordHash = await hashPassword(password);

  await setPasswordHash(
    result.rows[0].id,
    passwordHash,
  );

  console.log(
    `Development credentials configured for ${developmentUserEmail}.`,
  );
};

try {
  await bootstrapDevelopmentCredentials();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await db.end();
}