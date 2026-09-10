import assert from "node:assert/strict";
import test, {
  after,
  before,
  describe,
} from "node:test";
import { randomUUID } from "node:crypto";

import { buildApp } from "../../../app.js";
import { db } from "../../../infrastructure/database/pool.js";
import { hashSessionToken } from "../security/session-credential.js";
import { hashPassword } from "../security/password-hasher.js";

const TEST_EMAIL =
  `auth-route-test-${randomUUID()}@enterprisex.local`;

const TEST_PASSWORD =
  "EnterpriseX-Test-Password-123!";

const TEST_DISPLAY_NAME =
  "Authentication Route Test User";

let testUserId: string;

const createTestUser = async (): Promise<void> => {
  const userResult = await db.query<{ id: string }>(
    `
      INSERT INTO security.users (
        email,
        display_name,
        status
      )
      VALUES ($1, $2, 'ACTIVE')
      RETURNING id
    `,
    [
      TEST_EMAIL,
      TEST_DISPLAY_NAME,
    ],
  );

  testUserId = userResult.rows[0].id;

  const passwordHash =
    await hashPassword(TEST_PASSWORD);

  await db.query(
    `
      INSERT INTO security.user_credentials (
        user_id,
        password_hash,
        password_changed_at,
        failed_login_attempts,
        locked_until
      )
      VALUES ($1, $2, NOW(), 0, NULL)
    `,
    [
      testUserId,
      passwordHash,
    ],
  );
};

const deleteTestUser = async (): Promise<void> => {
  await db.query(
    `
      DELETE FROM core.audit_events
      WHERE actor_user_id = $1
         OR entity_id = $1
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
      DELETE FROM security.user_company_access
      WHERE user_id = $1
    `,
    [testUserId],
  );

  await db.query(
    `
      DELETE FROM security.user_roles
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
};

describe("POST /api/v1/auth/login", () => {
  let app: ReturnType<typeof buildApp>;

  before(async () => {
    await createTestUser();

    app = buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
    await deleteTestUser();
    await db.end();
  });

  test("logs in with valid credentials", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    });

    assert.equal(response.statusCode, 200);

    const body = response.json();

    assert.equal(
      body.user.email,
      TEST_EMAIL,
    );

    assert.equal(
      body.user.displayName,
      TEST_DISPLAY_NAME,
    );

    assert.equal(
      typeof body.user.id,
      "string",
    );

    assert.equal(
      typeof body.session.token,
      "string",
    );

    assert.ok(
      body.session.token.length > 0,
    );

    assert.ok(
      body.session.expiresAt,
    );

    assert.equal(
      "password" in body.user,
      false,
    );

    assert.equal(
      "passwordHash" in body.user,
      false,
    );
  });

  test("rejects an incorrect password", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: TEST_EMAIL,
        password: "Wrong-Password-123!",
      },
    });

    assert.equal(response.statusCode, 401);

    const body = response.json();

    assert.equal(
      body.error.code,
      "INVALID_CREDENTIALS",
    );

    assert.equal(
      body.error.message,
      "Invalid email or password.",
    );
  });

  test("rejects an unknown email", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email:
          "does-not-exist@enterprisex.local",
        password: TEST_PASSWORD,
      },
    });

    assert.equal(response.statusCode, 401);

    const body = response.json();

    assert.equal(
      body.error.code,
      "INVALID_CREDENTIALS",
    );

    assert.equal(
      body.error.message,
      "Invalid email or password.",
    );
  });

  test("rejects a request with missing credentials", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {},
    });

    assert.equal(response.statusCode, 401);

    const body = response.json();

    assert.equal(
      body.error.code,
      "INVALID_CREDENTIALS",
    );
  });

  test("rejects a JSON request body with invalid field types", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: 12345,
        password: true,
      },
    });

    assert.equal(response.statusCode, 401);

    const body = response.json();

    assert.equal(
      body.error.code,
      "INVALID_CREDENTIALS",
    );

    assert.equal(
      body.error.message,
      "Invalid email or password.",
    );
  });

  test("creates a database session after successful login", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    });

    assert.equal(response.statusCode, 200);

    const body = response.json();

    const sessionResult = await db.query<{
      id: string;
      user_id: string;
      status: string;
      token_hash: string;
    }>(
      `
        SELECT
          id,
          user_id,
          status,
          token_hash
        FROM security.sessions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [testUserId],
    );

    assert.equal(
      sessionResult.rowCount,
      1,
    );

    const session =
      sessionResult.rows[0];

    assert.equal(
      session.user_id,
      testUserId,
    );

    assert.equal(
      session.status,
      "ACTIVE",
    );

    assert.equal(
      session.token_hash,
      hashSessionToken(
        body.session.token,
      ),
    );
  });

  test("records successful authentication audit events", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    });

    assert.equal(response.statusCode, 200);

    const result = await db.query<{
      action: string;
      status: string;
      source_module: string;
    }>(
      `
        SELECT
          action,
          status,
          source_module
        FROM core.audit_events
        WHERE actor_user_id = $1
          AND action IN (
            'LOGIN_SUCCESS',
            'SESSION_CREATED'
          )
        ORDER BY occurred_at DESC
      `,
      [testUserId],
    );

    assert.ok(
      result.rows.some(
        (
          row: {
            action: string;
            status: string;
            source_module: string;
          },
        ) =>
          row.action === "LOGIN_SUCCESS" &&
          row.status === "SUCCESS" &&
          row.source_module ===
            "security-identity",
      ),
    );

    assert.ok(
      result.rows.some(
        (
          row: {
            action: string;
            status: string;
            source_module: string;
          },
        ) =>
          row.action === "SESSION_CREATED" &&
          row.status === "SUCCESS" &&
          row.source_module ===
            "security-identity",
      ),
    );
  });
});