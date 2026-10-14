import assert from "node:assert/strict";
import test from "node:test";

import { getEnvConfig } from "./env.js";

test("development defaults keep local setup working without production secrets", () => {
  const config = getEnvConfig({ NODE_ENV: "development" });

  assert.equal(config.nodeEnv, "development");
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 3000);
  assert.equal(config.database.password, "change_me");
});

test("production requires DATABASE_PASSWORD and rejects missing values", () => {
  assert.throws(
    () => getEnvConfig({ NODE_ENV: "production" }),
    /DATABASE_PASSWORD is required in production and must not use the local development fallback\./,
  );
});

test("production accepts explicit credentials and preserves values", () => {
  const config = getEnvConfig({
    NODE_ENV: "production",
    API_HOST: "0.0.0.0",
    API_PORT: "4000",
    DATABASE_HOST: "db.internal",
    DATABASE_PORT: "5432",
    DATABASE_NAME: "enterprisex_prod",
    DATABASE_USER: "enterprisex_app",
    DATABASE_PASSWORD: "s3cr3t-prod-password",
  });

  assert.equal(config.nodeEnv, "production");
  assert.equal(config.host, "0.0.0.0");
  assert.equal(config.port, 4000);
  assert.equal(config.database.name, "enterprisex_prod");
  assert.equal(config.database.password, "s3cr3t-prod-password");
});

test("invalid numeric ports are rejected", () => {
  assert.throws(
    () => getEnvConfig({ NODE_ENV: "development", API_PORT: "abc" }),
    /API_PORT must be an integer port between 1 and 65535\./,
  );
});
