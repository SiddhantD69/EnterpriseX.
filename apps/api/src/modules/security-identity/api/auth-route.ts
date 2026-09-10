import type { FastifyInstance } from "fastify";

import {
  authenticateUser,
  INVALID_CREDENTIALS_MESSAGE,
} from "../application/login-service.js";

type LoginRequestBody = {
  email?: unknown;
  password?: unknown;
};

const isLoginRequestBody = (
  body: unknown,
): body is {
  email: string;
  password: string;
} => {
  if (
    typeof body !== "object" ||
    body === null
  ) {
    return false;
  }

  const candidate =
    body as LoginRequestBody;

  return (
    typeof candidate.email === "string" &&
    typeof candidate.password === "string"
  );
};

const invalidCredentialsResponse = (
  reply: {
    code: (statusCode: number) => {
      send: (payload: unknown) => unknown;
    };
  },
) => {
  return reply
    .code(401)
    .send({
      error: {
        code: "INVALID_CREDENTIALS",
        message:
          INVALID_CREDENTIALS_MESSAGE,
      },
    });
};

export const registerAuthRoutes = (
  app: FastifyInstance,
): void => {
  app.post(
    "/api/v1/auth/login",
    async (request, reply) => {
      if (
        !isLoginRequestBody(
          request.body,
        )
      ) {
        return invalidCredentialsResponse(
          reply,
        );
      }

      try {
        const result =
          await authenticateUser({
            email: request.body.email,
            password: request.body.password,
          });

        return reply.code(200).send({
          user: {
            id: result.user.id,
            email: result.user.email,
            displayName:
              result.user.displayName,
          },
          session: {
            token: result.session.token,
            expiresAt:
              result.session.session.expiresAt,
          },
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message ===
            INVALID_CREDENTIALS_MESSAGE
        ) {
          return invalidCredentialsResponse(
            reply,
          );
        }

        request.log.error(
          {
            error,
          },
          "Authentication request failed",
        );

        return reply
          .code(500)
          .send({
            error: {
              code: "AUTHENTICATION_ERROR",
              message:
                "Authentication service unavailable.",
            },
          });
      }
    },
  );
};