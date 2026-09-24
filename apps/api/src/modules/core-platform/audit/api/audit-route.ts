import type {
  FastifyInstance,
} from "fastify";

import {
  authenticationMiddleware,
} from "../../../security-identity/api/authentication-middleware.js";

import {
  requirePermission,
} from "../../../security-identity/api/authorization-middleware.js";

import {
  listAuditEvents,
} from "../application/list-audit-events.js";

type AuditEventsQuery = {
  limit?: string;
  offset?: string;
  action?: string;
  entityType?: string;
  status?: string;
};

export const registerAuditRoutes = (
  app: FastifyInstance,
): void => {
  app.get<{
    Querystring: AuditEventsQuery;
  }>(
    "/api/v1/core/audit/events",
    {
      preHandler: [
        authenticationMiddleware,
        requirePermission(
          "core.audit.read",
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

      const limit = Math.min(
        Math.max(
          Number(request.query.limit ?? 50),
          1,
        ),
        100,
      );

      const offset = Math.max(
        Number(request.query.offset ?? 0),
        0,
      );

      const events =
        await listAuditEvents({
          organizationId:
            context.organization.id,
          companyId:
            context.company.id,
          limit,
          offset,
          action:
            request.query.action,
          entityType:
            request.query.entityType,
          status:
            request.query.status,
        });

      return reply.code(200).send({
        status: "ok",
        data: events,
        pagination: {
          limit,
          offset,
          count: events.length,
        },
      });
    },
  );
};