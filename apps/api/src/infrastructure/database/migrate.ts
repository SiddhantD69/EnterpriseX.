import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { db } from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDirectory = path.resolve(
  __dirname,
  "../../../../../database/migrations",
);

const ensureMigrationTable = async (): Promise<void> => {
  await db.query(`
    CREATE SCHEMA IF NOT EXISTS core;

    CREATE TABLE IF NOT EXISTS core.schema_migrations (
      version VARCHAR(100) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

const runMigrations = async (): Promise<void> => {
  await ensureMigrationTable();

  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const version = file.split("_")[0];

    if (!version) {
      throw new Error(`Invalid migration filename: ${file}`);
    }

    const existingMigration = await db.query(
      "SELECT version FROM core.schema_migrations WHERE version = $1",
      [version],
    );

    if (existingMigration.rowCount && existingMigration.rowCount > 0) {
      console.log(`Skipping applied migration: ${file}`);
      continue;
    }

    const migrationPath = path.join(migrationsDirectory, file);
    const sql = await readFile(migrationPath, "utf8");
    const name = file.replace(/\.sql$/, "");

    const client = await db.connect();

    try {
      await client.query("BEGIN");
      await client.query(sql);

      await client.query(
        `INSERT INTO core.schema_migrations (version, name)
         VALUES ($1, $2)`,
        [version, name],
      );

      await client.query("COMMIT");

      console.log(`Applied migration: ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
};

runMigrations()
  .catch((error: unknown) => {
    console.error("Database migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });