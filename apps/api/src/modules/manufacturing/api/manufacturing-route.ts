import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { authenticationMiddleware } from "../../security-identity/api/authentication-middleware.js";
import { requirePermission } from "../../security-identity/api/authorization-middleware.js";
import {
  confirmProduction,
  createBom,
  createProductionOrder,
  issueMaterials,
  listBoms,
  listProductionOrders,
  ManufacturingConflictError,
  ManufacturingNotFoundError,
  ManufacturingValidationError,
} from "../application/manufacturing-service.js";

const sendManufacturingError = (error: unknown, request: FastifyRequest, reply: FastifyReply) => {
  if (error instanceof ManufacturingValidationError) {
    return reply.code(400).send({ error: "VALIDATION_ERROR", message: error.message });
  }
  if (error instanceof ManufacturingNotFoundError) {
    return reply.code(404).send({ error: error.code, message: error.message });
  }
  if (error instanceof ManufacturingConflictError) {
    return reply.code(409).send({ error: error.code, message: error.message });
  }

  request.log.error({ err: error }, "Manufacturing request failed.");
  return reply.code(500).send({ error: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." });
};

export const registerManufacturingRoutes = (app: FastifyInstance): void => {
  app.get(
    "/api/v1/manufacturing/boms",
    {
      preHandler: [authenticationMiddleware, requirePermission("manufacturing.boms.read")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(200).send({ data: await listBoms(context.company.id) });
      } catch (error) {
        return sendManufacturingError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/manufacturing/boms",
    {
      preHandler: [authenticationMiddleware, requirePermission("manufacturing.boms.create")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(201).send({
          data: await createBom(context.company.id, context.user.userId, request.body, {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          }),
        });
      } catch (error) {
        return sendManufacturingError(error, request, reply);
      }
    },
  );

  app.get(
    "/api/v1/manufacturing/production-orders",
    {
      preHandler: [authenticationMiddleware, requirePermission("manufacturing.orders.read")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(200).send({ data: await listProductionOrders(context.company.id) });
      } catch (error) {
        return sendManufacturingError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/manufacturing/production-orders",
    {
      preHandler: [authenticationMiddleware, requirePermission("manufacturing.orders.create")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(201).send({
          data: await createProductionOrder(context.company.id, context.user.userId, request.body, {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          }),
        });
      } catch (error) {
        return sendManufacturingError(error, request, reply);
      }
    },
  );

  app.post<{ Params: { orderId: string } }>(
    "/api/v1/manufacturing/production-orders/:orderId/issue",
    {
      preHandler: [authenticationMiddleware, requirePermission("manufacturing.orders.issue")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(200).send({
          data: await issueMaterials(context.company.id, request.params.orderId, context.user.userId, request.body, {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          }),
        });
      } catch (error) {
        return sendManufacturingError(error, request, reply);
      }
    },
  );

  app.post<{ Params: { orderId: string } }>(
    "/api/v1/manufacturing/production-orders/:orderId/confirm",
    {
      preHandler: [authenticationMiddleware, requirePermission("manufacturing.orders.confirm")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(200).send({
          data: await confirmProduction(context.company.id, request.params.orderId, context.user.userId, request.body, {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          }),
        });
      } catch (error) {
        return sendManufacturingError(error, request, reply);
      }
    },
  );
};
