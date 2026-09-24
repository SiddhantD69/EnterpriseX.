import {
  findSessionByTokenHash,
} from "../infrastructure/session-repository.js";

import {
  hashSessionToken,
} from "../security/session-credential.js";

import type {
  Session,
} from "../domain/session.js";

export type AuthenticatedSession = {
  session: Session;
};

export const authenticateSessionToken = async (
  token: string,
): Promise<AuthenticatedSession | null> => {
  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);

  const session =
    await findSessionByTokenHash(tokenHash);

  if (!session) {
    return null;
  }

  if (session.status !== "ACTIVE") {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return {
    session,
  };
};