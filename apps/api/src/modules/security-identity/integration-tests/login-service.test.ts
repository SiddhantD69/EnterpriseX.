import assert from "node:assert/strict";
import test, { after, before, describe } from "node:test";

import { db } from "../../../infrastructure/database/pool.js";
import {
  authenticateUser,
  INVALID_CREDENTIALS_MESSAGE,
} from "../application/login-service.js";
import { hashPassword } from "../security/password-hasher.js";
import {
  findCredentialsByUserId,
  setPasswordHash,
} from "../infrastructure/credential-repository.js";

const TEST_USER_EMAIL =
  "login-service-test@enterprisex.local";

const TEST_PASSWORD =
  "EnterpriseX-Test-Password-123!";

const WRONG_PASSWORD =
  "EnterpriseX-Wrong-Password-456!";

let testUserId: string;

describe("Login Service", () => {
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
          DELETE FROM core.audit_events
          WHERE actor_user_id = $1
        `,
        [testUserId],
      );

      await db.query(
        `
          DELETE FROM security.sessions
          WHERE user_id = $1
        `,
        [testUserId],
      );

      await db.query(
        `
          DELETE FROM security.user_credentials
          WHERE user_id = $1
        `,
        [testUserId],
      );

      await db.query(
        `
          UPDATE security.users
          SET
            status = 'ACTIVE',
            updated_at = NOW()
          WHERE id = $1
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
          'Login Service Test User',
          'ACTIVE'
        )
        RETURNING id
      `,
      [TEST_USER_EMAIL],
    );

    testUserId = result.rows[0].id;
  });

  after(async () => {
    /*
     * Audit events reference security.users through
     * audit_events_actor_user_fk.
     *
     * Therefore audit events must be removed before
     * deleting the test user.
     */

    await db.query(
      `
        DELETE FROM core.audit_events
        WHERE actor_user_id = $1
      `,
      [testUserId],
    );

    await db.query(
      `
        DELETE FROM security.sessions
        WHERE user_id = $1
      `,
      [testUserId],
    );

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

  test("rejects login when credentials do not exist", async () => {
    await assert.rejects(
      () =>
        authenticateUser({
          email: TEST_USER_EMAIL,
          password: TEST_PASSWORD,
        }),
      new Error(INVALID_CREDENTIALS_MESSAGE),
    );
  });

  test("authenticates a user with the correct password", async () => {
    const passwordHash =
      await hashPassword(TEST_PASSWORD);

    await setPasswordHash(
      testUserId,
      passwordHash,
    );

    const result = await authenticateUser({
      email: TEST_USER_EMAIL,
      password: TEST_PASSWORD,
    });

    assert.equal(
      result.user.id,
      testUserId,
    );

    assert.equal(
      result.user.email,
      TEST_USER_EMAIL,
    );

    assert.ok(result.session.token);
    assert.ok(result.session.session.id);

    assert.equal(
      result.session.session.userId,
      testUserId,
    );

    assert.equal(
      result.session.session.status,
      "ACTIVE",
    );
  });

  test("resets failed attempts after successful authentication", async () => {
    const passwordHash =
      await hashPassword(TEST_PASSWORD);

    await setPasswordHash(
      testUserId,
      passwordHash,
    );

    await db.query(
      `
        UPDATE security.user_credentials
        SET
          failed_login_attempts = 3,
          locked_until = NULL
        WHERE user_id = $1
      `,
      [testUserId],
    );

    const beforeLogin =
      await findCredentialsByUserId(
        testUserId,
      );

    assert.ok(beforeLogin);

    assert.equal(
      beforeLogin.failedLoginAttempts,
      3,
    );

    const loginTime = new Date();

    await authenticateUser(
      {
        email: TEST_USER_EMAIL,
        password: TEST_PASSWORD,
      },
      loginTime,
    );

    const afterLogin =
      await findCredentialsByUserId(
        testUserId,
      );

    assert.ok(afterLogin);

    assert.equal(
      afterLogin.failedLoginAttempts,
      0,
    );

    assert.equal(
      afterLogin.lockedUntil,
      null,
    );

    assert.ok(afterLogin.lastLoginAt);

    assert.equal(
      afterLogin.lastLoginAt.getTime(),
      loginTime.getTime(),
    );
  });

  test("rejects an incorrect password with a generic error", async () => {
    const passwordHash =
      await hashPassword(TEST_PASSWORD);

    await setPasswordHash(
      testUserId,
      passwordHash,
    );

    await assert.rejects(
      () =>
        authenticateUser({
          email: TEST_USER_EMAIL,
          password: WRONG_PASSWORD,
        }),
      new Error(INVALID_CREDENTIALS_MESSAGE),
    );
  });

  test("increments failed login attempts", async () => {
    const passwordHash =
      await hashPassword(TEST_PASSWORD);

    await setPasswordHash(
      testUserId,
      passwordHash,
    );

    await assert.rejects(
      () =>
        authenticateUser({
          email: TEST_USER_EMAIL,
          password: WRONG_PASSWORD,
        }),
      new Error(INVALID_CREDENTIALS_MESSAGE),
    );

    const credentials =
      await findCredentialsByUserId(
        testUserId,
      );

    assert.ok(credentials);

    assert.equal(
      credentials.failedLoginAttempts,
      1,
    );
  });

  test("locks the account after five failed attempts", async () => {
    const passwordHash =
      await hashPassword(TEST_PASSWORD);

    await setPasswordHash(
      testUserId,
      passwordHash,
    );

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await assert.rejects(
        () =>
          authenticateUser({
            email: TEST_USER_EMAIL,
            password: WRONG_PASSWORD,
          }),
        new Error(INVALID_CREDENTIALS_MESSAGE),
      );
    }

    const credentials =
      await findCredentialsByUserId(
        testUserId,
      );

    assert.ok(credentials);

    assert.equal(
      credentials.failedLoginAttempts,
      5,
    );

    assert.ok(credentials.lockedUntil);

    assert.ok(
      credentials.lockedUntil.getTime() >
        Date.now(),
    );
  });

  test("rejects login while the account is locked", async () => {
    const passwordHash =
      await hashPassword(TEST_PASSWORD);

    await setPasswordHash(
      testUserId,
      passwordHash,
    );

    const lockedUntil = new Date(
      Date.now() + 15 * 60 * 1000,
    );

    await db.query(
      `
        UPDATE security.user_credentials
        SET
          failed_login_attempts = 5,
          locked_until = $2
        WHERE user_id = $1
      `,
      [testUserId, lockedUntil],
    );

    await assert.rejects(
      () =>
        authenticateUser({
          email: TEST_USER_EMAIL,
          password: TEST_PASSWORD,
        }),
      new Error(INVALID_CREDENTIALS_MESSAGE),
    );
  });

  test("allows login when an old lock timestamp has expired", async () => {
    const passwordHash =
      await hashPassword(TEST_PASSWORD);

    await setPasswordHash(
      testUserId,
      passwordHash,
    );

    const now = new Date();

    const expiredLock = new Date(
      now.getTime() - 60 * 1000,
    );

    await db.query(
      `
        UPDATE security.user_credentials
        SET
          failed_login_attempts = 5,
          locked_until = $2
        WHERE user_id = $1
      `,
      [testUserId, expiredLock],
    );

    const result = await authenticateUser(
      {
        email: TEST_USER_EMAIL,
        password: TEST_PASSWORD,
      },
      now,
    );

    assert.equal(
      result.user.id,
      testUserId,
    );

    assert.equal(
      result.session.session.status,
      "ACTIVE",
    );
  });

  test("rejects authentication for an inactive user", async () => {
    const passwordHash =
      await hashPassword(TEST_PASSWORD);

    await setPasswordHash(
      testUserId,
      passwordHash,
    );

    await db.query(
      `
        UPDATE security.users
        SET
          status = 'INACTIVE',
          updated_at = NOW()
        WHERE id = $1
      `,
      [testUserId],
    );

    await assert.rejects(
      () =>
        authenticateUser({
          email: TEST_USER_EMAIL,
          password: TEST_PASSWORD,
        }),
      new Error(INVALID_CREDENTIALS_MESSAGE),
    );

    await db.query(
      `
        UPDATE security.users
        SET
          status = 'ACTIVE',
          updated_at = NOW()
        WHERE id = $1
      `,
      [testUserId],
    );
  });

  test("uses the same generic error for an unknown email", async () => {
    await assert.rejects(
      () =>
        authenticateUser({
          email: "unknown-user@enterprisex.local",
          password: TEST_PASSWORD,
        }),
      new Error(INVALID_CREDENTIALS_MESSAGE),
    );
  });

  test("normalizes email before authentication", async () => {
    const passwordHash =
      await hashPassword(TEST_PASSWORD);

    await setPasswordHash(
      testUserId,
      passwordHash,
    );

    const result = await authenticateUser({
      email: `  ${TEST_USER_EMAIL.toUpperCase()}  `,
      password: TEST_PASSWORD,
    });

    assert.equal(
      result.user.id,
      testUserId,
    );

    assert.equal(
      result.user.email,
      TEST_USER_EMAIL,
    );
  });
});