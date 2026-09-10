import type { FastifyInstance } from "fastify";

import {
  authenticationMiddleware,
} from "../../security-identity/api/authentication-middleware.js";

import {
  requirePermission,
} from "../../security-identity/api/authorization-middleware.js";

export const registerCoreContextRoute = (
  app: FastifyInstance,
): void => {
  app.get(
    "/api/v1/core/context",
    {
      preHandler: [
        authenticationMiddleware,
        requirePermission(
          "core.organization.read",
        ),
      ],
    },
    async (request, reply) => {
      const context =
        request.authenticatedContext;

      if (!context) {
        return reply.code(401).send({
          error: {
            code:
              "AUTHENTICATION_REQUIRED",
            message:
              "Authentication required.",
          },
        });
      }

      return reply.code(200).send({
        user: {
          id: context.user.userId,
          email: context.user.email,
          displayName:
            context.user.displayName,
        },

        organization: {
          id: context.organization.id,
          code: context.organization.code,
          name: context.organization.name,
        },

        company: {
          id: context.company.id,
          code: context.company.code,
          name: context.company.name,
        },

        roles: context.roles.map(
          (role) => ({
            id: role.id,
            code: role.code,
            name: role.name,
          }),
        ),

        permissions:
          context.permissions.map(
            (permission) => ({
              code: permission.code,
              name: permission.name,
            }),
          ),
      });
    },
  );
};