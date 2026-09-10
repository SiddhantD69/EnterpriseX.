import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
} from "../domain/authorization.js";

const sendForbidden = async (
  reply: FastifyReply,
): Promise<void> => {
  await reply.code(403).send({
    error: {
      code: "FORBIDDEN",
      message: "Forbidden.",
    },
  });
};

export const requirePermission = (
  permissionCode: string,
) => {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const context =
      request.authenticatedContext;

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

    if (
      !hasPermission(
        context,
        permissionCode,
      )
    ) {
      await sendForbidden(reply);
    }
  };
};

export const requireAnyPermission = (
  permissionCodes: string[],
) => {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const context =
      request.authenticatedContext;

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

    if (
      !hasAnyPermission(
        context,
        permissionCodes,
      )
    ) {
      await sendForbidden(reply);
    }
  };
};

export const requireAllPermissions = (
  permissionCodes: string[],
) => {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const context =
      request.authenticatedContext;

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

    if (
      !hasAllPermissions(
        context,
        permissionCodes,
      )
    ) {
      await sendForbidden(reply);
    }
  };
};