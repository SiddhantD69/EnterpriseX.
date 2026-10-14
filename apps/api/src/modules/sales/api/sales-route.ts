import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { authenticationMiddleware } from "../../security-identity/api/authentication-middleware.js";
import { requirePermission } from "../../security-identity/api/authorization-middleware.js";
import {
  createCustomer,
  createOrder,
  listCustomers,
  listOrders,
  SalesConflictError,
  SalesNotFoundError,
  SalesValidationError,
} from "../application/sales-service.js";

const sendSalesError = (error: unknown, request: FastifyRequest, reply: FastifyReply) => {
  if (error instanceof SalesValidationError) {
    return reply.code(400).send({ error: "VALIDATION_ERROR", message: error.message });
  }
  if (error instanceof SalesNotFoundError) {
    return reply.code(404).send({ error: error.code, message: error.message });
  }
  if (error instanceof SalesConflictError) {
    return reply.code(409).send({ error: error.code, message: error.message });
  }

  request.log.error({ err: error }, "Sales request failed.");
  return reply.code(500).send({ error: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." });
};

export const registerSalesRoutes = (app: FastifyInstance): void => {
  app.get(
    "/api/v1/sales/customers",
    {
      preHandler: [authenticationMiddleware, requirePermission("sales.customers.read")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(200).send({ data: await listCustomers(context.company.id) });
      } catch (error) {
        return sendSalesError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/sales/customers",
    {
      preHandler: [authenticationMiddleware, requirePermission("sales.customers.create")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(201).send({
          data: await createCustomer(context.company.id, request.body, {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          }),
        });
      } catch (error) {
        return sendSalesError(error, request, reply);
      }
    },
  );

  app.get(
    "/api/v1/sales/orders",
    {
      preHandler: [authenticationMiddleware, requirePermission("sales.orders.read")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(200).send({ data: await listOrders(context.company.id) });
      } catch (error) {
        return sendSalesError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/sales/orders",
    {
      preHandler: [authenticationMiddleware, requirePermission("sales.orders.create")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(201).send({
          data: await createOrder(context.company.id, context.user.userId, request.body, {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          }),
        });
      } catch (error) {
        return sendSalesError(error, request, reply);
      }
    },
  );
};
