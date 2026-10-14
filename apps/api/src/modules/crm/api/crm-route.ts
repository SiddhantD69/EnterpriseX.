import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { authenticationMiddleware } from "../../security-identity/api/authentication-middleware.js";
import { requirePermission } from "../../security-identity/api/authorization-middleware.js";
import {
  createLead,
  createOpportunity,
  listLeads,
  listOpportunities,
  CrmConflictError,
  CrmNotFoundError,
  CrmValidationError,
} from "../application/crm-service.js";

const sendCrmError = (error: unknown, request: FastifyRequest, reply: FastifyReply) => {
  if (error instanceof CrmValidationError) {
    return reply.code(400).send({ error: "VALIDATION_ERROR", message: error.message });
  }
  if (error instanceof CrmNotFoundError) {
    return reply.code(404).send({ error: error.code, message: error.message });
  }
  if (error instanceof CrmConflictError) {
    return reply.code(409).send({ error: error.code, message: error.message });
  }

  request.log.error({ err: error }, "CRM request failed.");
  return reply.code(500).send({ error: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." });
};

export const registerCrmRoutes = (app: FastifyInstance): void => {
  app.get(
    "/api/v1/crm/leads",
    { preHandler: [authenticationMiddleware, requirePermission("crm.leads.read")] },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(200).send({ data: await listLeads(context.company.id) });
      } catch (error) {
        return sendCrmError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/crm/leads",
    { preHandler: [authenticationMiddleware, requirePermission("crm.leads.create")] },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(201).send({
          data: await createLead(context.company.id, request.body, {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          }),
        });
      } catch (error) {
        return sendCrmError(error, request, reply);
      }
    },
  );

  app.get(
    "/api/v1/crm/opportunities",
    { preHandler: [authenticationMiddleware, requirePermission("crm.opportunities.read")] },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(200).send({ data: await listOpportunities(context.company.id) });
      } catch (error) {
        return sendCrmError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/crm/opportunities",
    { preHandler: [authenticationMiddleware, requirePermission("crm.opportunities.create")] },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(201).send({
          data: await createOpportunity(context.company.id, request.body, {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          }),
        });
      } catch (error) {
        return sendCrmError(error, request, reply);
      }
    },
  );
};
