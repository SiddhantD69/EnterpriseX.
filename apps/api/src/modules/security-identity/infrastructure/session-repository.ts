import { randomUUID } from "node:crypto";

import { db } from "../../../infrastructure/database/pool.js";

import type {
  CreateSessionInput,
  Session,
  SessionStatus,
} from "../domain/session.js";

type SessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  status: SessionStatus;
  created_at: Date;
  expires_at: Date;
  last_seen_at: Date;
  revoked_at: Date | null;
};

const mapSession = (row: SessionRow): Session => {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at,
  };
};

export const createSession = async (
  input: CreateSessionInput,
): Promise<Session> => {
  const id = randomUUID();

  const result = await db.query<SessionRow>(
    `
      INSERT INTO security.sessions (
        id,
        user_id,
        token_hash,
        status,
        expires_at
      )
      VALUES ($1, $2, $3, 'ACTIVE', $4)
      RETURNING
        id,
        user_id,
        token_hash,
        status,
        created_at,
        expires_at,
        last_seen_at,
        revoked_at
    `,
    [
      id,
      input.userId,
      input.tokenHash,
      input.expiresAt,
    ],
  );

  return mapSession(result.rows[0]);
};

export const findSessionByTokenHash = async (
  tokenHash: string,
): Promise<Session | null> => {
  const result = await db.query<SessionRow>(
    `
      SELECT
        id,
        user_id,
        token_hash,
        status,
        created_at,
        expires_at,
        last_seen_at,
        revoked_at
      FROM security.sessions
      WHERE token_hash = $1
      LIMIT 1
    `,
    [tokenHash],
  );

  if (result.rowCount !== 1) {
    return null;
  }

  return mapSession(result.rows[0]);
};

export const markSessionExpired = async (
  sessionId: string,
): Promise<void> => {
  await db.query(
    `
      UPDATE security.sessions
      SET status = 'EXPIRED'
      WHERE id = $1
        AND status = 'ACTIVE'
    `,
    [sessionId],
  );
};

export const touchSession = async (
  sessionId: string,
  lastSeenAt: Date = new Date(),
): Promise<void> => {
  await db.query(
    `
      UPDATE security.sessions
      SET last_seen_at = $2
      WHERE id = $1
        AND status = 'ACTIVE'
    `,
    [sessionId, lastSeenAt],
  );
};

export const revokeSession = async (
  sessionId: string,
  revokedAt: Date = new Date(),
): Promise<void> => {
  await db.query(
    `
      UPDATE security.sessions
      SET
        status = 'REVOKED',
        revoked_at = $2
      WHERE id = $1
        AND status = 'ACTIVE'
    `,
    [sessionId, revokedAt],
  );
};