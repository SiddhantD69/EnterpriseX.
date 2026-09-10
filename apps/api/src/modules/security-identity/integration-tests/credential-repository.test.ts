import assert from "node:assert/strict";
import test, { after, before, describe } from "node:test";

import { db } from "../../../infrastructure/database/pool.js";
import {
  findCredentialsByUserId,
  lockUserUntil,
  recordFailedLoginAttempt,
  resetLoginFailures,
  setPasswordHash,
} from "../infrastructure/credential-repository.js";

const TEST_USER_EMAIL = "credential-test@enterprisex.local";

let testUserId: string;

describe("Credential Repository", () => {
  before(async () => {
    const existingUser = await db.query<{ id: string }>(
      `
        SELECT id
        FROM security.users
        WHERE email = $1
        LIMIT 1
      `,
      [TEST_USER_EMAIL],
    );

    if (existingUser.rowCount === 1) {
      testUserId = existingUser.rows[0].id;

      await db.query(
        `
          DELETE FROM security.user_credentials
          WHERE user_id = $1
        `,
        [testUserId],
      );

      return;
    }

    const result = await db.query<{ id: string }>(
      `
        INSERT INTO security.users (
          email,
          display_name,
          status
        )
        VALUES (
          $1,
          'Credential Repository Test User',
          'ACTIVE'
        )
        RETURNING id
      `,
      [TEST_USER_EMAIL],
    );

    testUserId = result.rows[0].id;
  });

  after(async () => {
    await db.query(
      `
        DELETE FROM security.user_credentials
        WHERE user_id = $1
      `,
      [testUserId],
    );

    await db.query(
      `
        DELETE FROM security.users
        WHERE id = $1
      `,
      [testUserId],
    );

    await db.end();
  });

  test("returns null when credentials do not exist", async () => {
    const credentials = await findCredentialsByUserId(
      testUserId,
    );

    assert.equal(credentials, null);
  });

  test("creates and retrieves password credentials", async () => {
    const passwordHash =
      "$argon2id$v=19$m=65536,t=3,p=4$test-salt$test-hash";

    await setPasswordHash(
      testUserId,
      passwordHash,
    );

    const credentials =
      await findCredentialsByUserId(testUserId);

    assert.ok(credentials);
    assert.equal(credentials.userId, testUserId);
    assert.equal(
      credentials.passwordHash,
      passwordHash,
    );
    assert.equal(
      credentials.failedLoginAttempts,
      0,
    );
    assert.equal(
      credentials.lockedUntil,
      null,
    );
    assert.equal(
      credentials.lastLoginAt,
      null,
    );
  });

  test("records failed login attempts", async () => {
    await recordFailedLoginAttempt(testUserId);

    let credentials =
      await findCredentialsByUserId(testUserId);

    assert.ok(credentials);
    assert.equal(
      credentials.failedLoginAttempts,
      1,
    );

    await recordFailedLoginAttempt(testUserId);

    credentials =
      await findCredentialsByUserId(testUserId);

    assert.ok(credentials);
    assert.equal(
      credentials.failedLoginAttempts,
      2,
    );
  });

  test("stores an account lock timestamp", async () => {
    const lockedUntil = new Date(
      Date.now() + 15 * 60 * 1000,
    );

    await lockUserUntil(
      testUserId,
      lockedUntil,
    );

    const credentials =
      await findCredentialsByUserId(testUserId);

    assert.ok(credentials);
    assert.ok(credentials.lockedUntil);

    assert.equal(
      credentials.lockedUntil.getTime(),
      lockedUntil.getTime(),
    );
  });

  test("resets login failures after successful authentication", async () => {
    const lastLoginAt = new Date();

    await resetLoginFailures(
      testUserId,
      lastLoginAt,
    );

    const credentials =
      await findCredentialsByUserId(testUserId);

    assert.ok(credentials);

    assert.equal(
      credentials.failedLoginAttempts,
      0,
    );

    assert.equal(
      credentials.lockedUntil,
      null,
    );

    assert.ok(credentials.lastLoginAt);

    assert.equal(
      credentials.lastLoginAt.getTime(),
      lastLoginAt.getTime(),
    );
  });

  test("updates an existing password hash", async () => {
    const firstHash =
      "$argon2id$v=19$m=65536,t=3,p=4$first-salt$first-hash";

    const secondHash =
      "$argon2id$v=19$m=65536,t=3,p=4$second-salt$second-hash";

    await setPasswordHash(
      testUserId,
      firstHash,
    );

    await recordFailedLoginAttempt(testUserId);

    await setPasswordHash(
      testUserId,
      secondHash,
    );

    const credentials =
      await findCredentialsByUserId(testUserId);

    assert.ok(credentials);

    assert.equal(
      credentials.passwordHash,
      secondHash,
    );

    assert.equal(
      credentials.failedLoginAttempts,
      0,
    );

    assert.equal(
      credentials.lockedUntil,
      null,
    );

    assert.ok(credentials.passwordChangedAt);
  });
});