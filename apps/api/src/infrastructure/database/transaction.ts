import type { FastifyBaseLogger } from "fastify";
import type { PoolClient } from "pg";

import { db } from "./pool.js";

export const withDatabaseTransaction = async <T>(
  operation: (client: PoolClient) => Promise<T>,
  logger?: Pick<FastifyBaseLogger, "error">,
): Promise<T> => {
  const client = await db.connect();
  let releaseError: Error | undefined;

  try {
    await client.query("BEGIN");

    const result = await operation(client);

    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      releaseError = new Error(
        "Database transaction rollback failed.",
      );

      try {
        logger?.error(
          "Database transaction rollback failed.",
        );
      } catch {}
    }

    throw error;
  } finally {
    client.release(releaseError);
  }
};