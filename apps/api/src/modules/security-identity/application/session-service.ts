import {
  createSession,
  findSessionByTokenHash,
  markSessionExpired,
  revokeSession,
  touchSession,
} from "../infrastructure/session-repository.js";

import {
  isSessionActive,
  type Session,
} from "../domain/session.js";

import {
  generateSessionToken,
  hashSessionToken,
} from "../security/session-credential.js";

export type CreateSessionServiceInput = {
  userId: string;
  companyId?: string | null;
  lifetimeMinutes: number;
};

export type CreatedSession = {
  session: Session;
  token: string;
};

export const createAuthenticatedSession =
  async (
    input: CreateSessionServiceInput,
  ): Promise<CreatedSession> => {
    if (
      !Number.isInteger(
        input.lifetimeMinutes,
      )
    ) {
      throw new Error(
        "Session lifetime must be an integer.",
      );
    }

    if (
      input.lifetimeMinutes <= 0
    ) {
      throw new Error(
        "Session lifetime must be greater than zero.",
      );
    }

    const token =
      generateSessionToken();

    const tokenHash =
      hashSessionToken(token);

    const expiresAt =
      new Date(
        Date.now() +
          input.lifetimeMinutes *
            60 *
            1000,
      );

    const session =
      await createSession({
        userId:
          input.userId,
        companyId:
          input.companyId ?? null,
        tokenHash,
        expiresAt,
      });

    return {
      session,
      token,
    };
  };

export const validateSession =
  async (
    token: string,
    now: Date = new Date(),
  ): Promise<Session | null> => {
    if (!token) {
      return null;
    }

    const tokenHash =
      hashSessionToken(token);

    const session =
      await findSessionByTokenHash(
        tokenHash,
      );

    if (!session) {
      return null;
    }

    if (
      !isSessionActive(
        session,
        now,
      )
    ) {
      if (
        session.status ===
          "ACTIVE" &&
        session.expiresAt.getTime() <=
          now.getTime()
      ) {
        await markSessionExpired(
          session.id,
        );
      }

      return null;
    }

    await touchSession(
      session.id,
      now,
    );

    return session;
  };

export const revokeAuthenticatedSession =
  async (
    token: string,
  ): Promise<boolean> => {
    if (!token) {
      return false;
    }

    const tokenHash =
      hashSessionToken(token);

    const session =
      await findSessionByTokenHash(
        tokenHash,
      );

    if (
      !session ||
      session.status !==
        "ACTIVE"
    ) {
      return false;
    }

    await revokeSession(
      session.id,
    );

    return true;
  };