import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import {
  validateSession,
} from "../application/session-service.js";

import {
  findAuthenticatedContextBySessionId,
} from "../infrastructure/authenticated-context-repository.js";

import type {
  AuthenticatedContext,
} from "../domain/authenticated-context.js";

declare module "fastify" {
  interface FastifyRequest {
    authenticatedContext: AuthenticatedContext | null;
  }
}

const BEARER_PREFIX = "Bearer ";

const getBearerToken = (
  request: FastifyRequest,
): string | null => {
  const authorization =
    request.headers.authorization;

  if (!authorization) {
    return null;
  }

  if (
    !authorization.startsWith(
      BEARER_PREFIX,
    )
  ) {
    return null;
  }

  const token =
    authorization.slice(
      BEARER_PREFIX.length,
    ).trim();

  if (!token) {
    return null;
  }

  return token;
};

export const authenticationMiddleware =
  async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    request.authenticatedContext = null;

    const token =
      getBearerToken(request);

    if (!token) {
      await reply.code(401).send({
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message:
            "Authentication required.",
        },
      });

      return;
    }

    const session =
      await validateSession(token);

    if (!session) {
      await reply.code(401).send({
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message:
            "Authentication required.",
        },
      });

      return;
    }

    const context =
      await findAuthenticatedContextBySessionId(
        session.id,
      );

    if (!context) {
      await reply.code(401).send({
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message:
            "Authentication required.",
        },
      });

      return;
    }

    request.authenticatedContext =
      context;
  };