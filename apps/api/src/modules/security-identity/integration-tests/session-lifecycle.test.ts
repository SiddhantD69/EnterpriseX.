import {
  after,
  before,
  describe,
  it,
} from "node:test";

import assert from "node:assert/strict";

import { db } from "../../../infrastructure/database/pool.js";

import {
  createAuthenticatedSession,
  revokeAuthenticatedSession,
  validateSession,
} from "../application/session-service.js";

const DEVELOPMENT_USER_EMAIL =
  "developer@enterprisex.local";

let developmentUserId: string;

describe("Session Lifecycle", () => {
  before(async () => {
    const result = await db.query<{ id: string }>(
      `
        SELECT id
        FROM security.users
        WHERE email = $1
          AND status = 'ACTIVE'
      `,
      [DEVELOPMENT_USER_EMAIL],
    );

    assert.equal(result.rowCount, 1);

    developmentUserId = result.rows[0].id;
  });

  after(async () => {
    if (developmentUserId) {
      await db.query(
        `
          DELETE FROM security.sessions
          WHERE user_id = $1
        `,
        [developmentUserId],
      );
    }

    await db.end();
  });

  it("creates an active session in PostgreSQL", async () => {
    const result = await createAuthenticatedSession({
      userId: developmentUserId,
      lifetimeMinutes: 30,
    });

    assert.ok(result.token);
    assert.equal(result.token.length, 64);

    assert.equal(result.session.userId, developmentUserId);
    assert.equal(result.session.status, "ACTIVE");
    assert.equal(result.session.tokenHash.length, 64);
    assert.equal(result.session.revokedAt, null);

    const databaseResult = await db.query<{
      status: string;
      token_hash: string;
    }>(
      `
        SELECT
          status,
          token_hash
        FROM security.sessions
        WHERE id = $1
      `,
      [result.session.id],
    );

    assert.equal(databaseResult.rowCount, 1);
    assert.equal(databaseResult.rows[0].status, "ACTIVE");

    assert.notEqual(
      databaseResult.rows[0].token_hash,
      result.token,
    );
  });

  it("validates an active session", async () => {
    const created = await createAuthenticatedSession({
      userId: developmentUserId,
      lifetimeMinutes: 30,
    });

    const validated = await validateSession(
      created.token,
    );

    assert.ok(validated);
    assert.equal(validated.id, created.session.id);
    assert.equal(validated.status, "ACTIVE");
  });

  it("rejects an invalid session token", async () => {
    const result = await validateSession(
      "invalid-session-token",
    );

    assert.equal(result, null);
  });

  it("revokes an active session", async () => {
    const created = await createAuthenticatedSession({
      userId: developmentUserId,
      lifetimeMinutes: 30,
    });

    const revoked = await revokeAuthenticatedSession(
      created.token,
    );

    assert.equal(revoked, true);

    const validated = await validateSession(
      created.token,
    );

    assert.equal(validated, null);

    const databaseResult = await db.query<{
      status: string;
      revoked_at: Date | null;
    }>(
      `
        SELECT
          status,
          revoked_at
        FROM security.sessions
        WHERE id = $1
      `,
      [created.session.id],
    );

    assert.equal(databaseResult.rowCount, 1);
    assert.equal(databaseResult.rows[0].status, "REVOKED");
    assert.ok(databaseResult.rows[0].revoked_at);
  });

  it("rejects an expired session", async () => {
    const created = await createAuthenticatedSession({
      userId: developmentUserId,
      lifetimeMinutes: 1,
    });

    const futureTime = new Date(
      created.session.expiresAt.getTime() + 1000,
    );

    const validated = await validateSession(
      created.token,
      futureTime,
    );

    assert.equal(validated, null);

    const databaseResult = await db.query<{
      status: string;
    }>(
      `
        SELECT status
        FROM security.sessions
        WHERE id = $1
      `,
      [created.session.id],
    );

    assert.equal(databaseResult.rowCount, 1);
    assert.equal(databaseResult.rows[0].status, "EXPIRED");
  });

  it("rejects revocation of an already revoked session", async () => {
    const created = await createAuthenticatedSession({
      userId: developmentUserId,
      lifetimeMinutes: 30,
    });

    const firstRevoke =
      await revokeAuthenticatedSession(
        created.token,
      );

    const secondRevoke =
      await revokeAuthenticatedSession(
        created.token,
      );

    assert.equal(firstRevoke, true);
    assert.equal(secondRevoke, false);
  });
});