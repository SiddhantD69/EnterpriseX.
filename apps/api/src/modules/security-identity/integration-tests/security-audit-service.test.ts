import assert from "node:assert/strict";
import test, { after, before, describe } from "node:test";

import { db } from "../../../infrastructure/database/pool.js";
import {
  recordAccountLocked,
  recordLoginFailure,
  recordLoginSuccess,
  recordSessionCreated,
  recordSessionRevoked,
} from "../application/security-audit-service.js";

const TEST_USER_EMAIL =
  "security-audit-test@enterprisex.local";

let testUserId: string;

describe("Security Audit Service", () => {
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
          'Security Audit Test User',
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
        DELETE FROM core.audit_events
        WHERE actor_user_id = $1
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

  test("records a successful login event", async () => {
    await recordLoginSuccess({
      userId: testUserId,
      requestId: "request-login-success",
      correlationId: "correlation-login",
    });

    const result = await db.query<{
      action: string;
      status: string;
      entity_type: string;
      entity_id: string;
      source_module: string;
      request_id: string | null;
      correlation_id: string | null;
      metadata: Record<string, unknown> | null;
    }>(
      `
        SELECT
          action,
          status,
          entity_type,
          entity_id,
          source_module,
          request_id,
          correlation_id,
          metadata
        FROM core.audit_events
        WHERE actor_user_id = $1
          AND action = 'LOGIN_SUCCESS'
        ORDER BY occurred_at DESC
        LIMIT 1
      `,
      [testUserId],
    );

    assert.equal(result.rowCount, 1);

    const event = result.rows[0];

    assert.equal(event.action, "LOGIN_SUCCESS");
    assert.equal(event.status, "SUCCESS");
    assert.equal(event.entity_type, "USER");
    assert.equal(event.entity_id, testUserId);
    assert.equal(
      event.source_module,
      "security-identity",
    );
    assert.equal(
      event.request_id,
      "request-login-success",
    );
    assert.equal(
      event.correlation_id,
      "correlation-login",
    );
    assert.equal(event.metadata, null);
  });

  test("records a failed login event", async () => {
    await recordLoginFailure({
      userId: testUserId,
      requestId: "request-login-failure",
      reason: "invalid_credentials",
    });

    const result = await db.query<{
      action: string;
      status: string;
      entity_id: string | null;
      metadata: Record<string, unknown> | null;
    }>(
      `
        SELECT
          action,
          status,
          entity_id,
          metadata
        FROM core.audit_events
        WHERE actor_user_id = $1
          AND action = 'LOGIN_FAILED'
        ORDER BY occurred_at DESC
        LIMIT 1
      `,
      [testUserId],
    );

    assert.equal(result.rowCount, 1);

    const event = result.rows[0];

    assert.equal(event.action, "LOGIN_FAILED");
    assert.equal(event.status, "FAILURE");
    assert.equal(event.entity_id, testUserId);

    assert.deepEqual(
      event.metadata,
      {
        reason: "invalid_credentials",
      },
    );
  });

  test("records an anonymous failed login event", async () => {
    await recordLoginFailure({
      userId: null,
      requestId: "request-unknown-user",
      reason: "invalid_credentials",
    });

    const result = await db.query<{
      action: string;
      status: string;
      actor_user_id: string | null;
      entity_id: string | null;
    }>(
      `
        SELECT
          action,
          status,
          actor_user_id,
          entity_id
        FROM core.audit_events
        WHERE request_id = 'request-unknown-user'
        LIMIT 1
      `,
    );

    assert.equal(result.rowCount, 1);

    const event = result.rows[0];

    assert.equal(event.action, "LOGIN_FAILED");
    assert.equal(event.status, "FAILURE");
    assert.equal(event.actor_user_id, null);
    assert.equal(event.entity_id, null);
  });

  test("records an account locked event", async () => {
    await recordAccountLocked({
      userId: testUserId,
      requestId: "request-account-locked",
    });

    const result = await db.query<{
      action: string;
      status: string;
      entity_type: string;
      entity_id: string;
    }>(
      `
        SELECT
          action,
          status,
          entity_type,
          entity_id
        FROM core.audit_events
        WHERE actor_user_id = $1
          AND action = 'ACCOUNT_LOCKED'
        ORDER BY occurred_at DESC
        LIMIT 1
      `,
      [testUserId],
    );

    assert.equal(result.rowCount, 1);

    const event = result.rows[0];

    assert.equal(
      event.action,
      "ACCOUNT_LOCKED",
    );
    assert.equal(
      event.status,
      "FAILURE",
    );
    assert.equal(
      event.entity_type,
      "USER",
    );
    assert.equal(
      event.entity_id,
      testUserId,
    );
  });

  test("records session creation without storing the session token", async () => {
    const sessionId =
      "00000000-0000-0000-0000-000000000001";

    await recordSessionCreated({
      userId: testUserId,
      sessionId,
      requestId: "request-session-created",
    });

    const result = await db.query<{
      action: string;
      status: string;
      entity_type: string;
      entity_id: string;
      metadata: Record<string, unknown> | null;
    }>(
      `
        SELECT
          action,
          status,
          entity_type,
          entity_id,
          metadata
        FROM core.audit_events
        WHERE actor_user_id = $1
          AND action = 'SESSION_CREATED'
        ORDER BY occurred_at DESC
        LIMIT 1
      `,
      [testUserId],
    );

    assert.equal(result.rowCount, 1);

    const event = result.rows[0];

    assert.equal(
      event.action,
      "SESSION_CREATED",
    );
    assert.equal(
      event.status,
      "SUCCESS",
    );
    assert.equal(
      event.entity_type,
      "SESSION",
    );
    assert.equal(
      event.entity_id,
      sessionId,
    );
    assert.equal(event.metadata, null);
  });

  test("records session revocation", async () => {
    const sessionId =
      "00000000-0000-0000-0000-000000000002";

    await recordSessionRevoked({
      userId: testUserId,
      sessionId,
      requestId: "request-session-revoked",
    });

    const result = await db.query<{
      action: string;
      status: string;
      entity_type: string;
      entity_id: string;
    }>(
      `
        SELECT
          action,
          status,
          entity_type,
          entity_id
        FROM core.audit_events
        WHERE actor_user_id = $1
          AND action = 'SESSION_REVOKED'
        ORDER BY occurred_at DESC
        LIMIT 1
      `,
      [testUserId],
    );

    assert.equal(result.rowCount, 1);

    const event = result.rows[0];

    assert.equal(
      event.action,
      "SESSION_REVOKED",
    );
    assert.equal(
      event.status,
      "SUCCESS",
    );
    assert.equal(
      event.entity_type,
      "SESSION",
    );
    assert.equal(
      event.entity_id,
      sessionId,
    );
  });

  test("does not store passwords or password hashes in audit metadata", async () => {
    await recordLoginFailure({
      userId: testUserId,
      requestId: "request-sensitive-data-check",
      reason: "invalid_credentials",
    });

    const result = await db.query<{
      metadata: Record<string, unknown> | null;
    }>(
      `
        SELECT metadata
        FROM core.audit_events
        WHERE request_id = 'request-sensitive-data-check'
        LIMIT 1
      `,
    );

    assert.equal(result.rowCount, 1);

    const metadataText =
      JSON.stringify(result.rows[0].metadata);

    assert.equal(
      metadataText.includes("password"),
      false,
    );

    assert.equal(
      metadataText.includes("passwordHash"),
      false,
    );
  });
});