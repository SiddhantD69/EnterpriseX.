import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { authenticationMiddleware } from "../../security-identity/api/authentication-middleware.js";
import { requirePermission } from "../../security-identity/api/authorization-middleware.js";
import {
  MasterDataNotFoundError,
  MasterDataValidationError,
} from "../../core-platform/master-data/application/master-data-errors.js";
import { createGoodsReceipt } from "../application/goods-receipt-service.js";
import { getStockBalances, getStockMovements } from "../infrastructure/inventory-repository.js";
import { ProcurementConflictError } from "../../procurement/application/procurement-service.js";

const sendError = (
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (error instanceof MasterDataValidationError) {
    return reply.code(400).send({ error: "VALIDATION_ERROR", message: error.message });
  }
  if (error instanceof MasterDataNotFoundError) {
    return reply.code(404).send({ error: error.code, message: error.message });
  }
  if (error instanceof ProcurementConflictError) {
    return reply.code(409).send({ error: error.code, message: error.message });
  }
  request.log.error({ err: error }, "Inventory request failed.");
  return reply.code(500).send({
    error: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred.",
  });
};

export const registerInventoryRoutes = (app: FastifyInstance): void => {
  app.get(
    "/api/v1/inventory/stock-balances",
    {
      preHandler: [authenticationMiddleware, requirePermission("inventory.stock.read")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        return reply.code(200).send({ data: await getStockBalances(context.company.id) });
      } catch (error) {
        return sendError(error, request, reply);
      }
    },
  );

  app.get(
    "/api/v1/inventory/stock-movements",
    {
      preHandler: [authenticationMiddleware, requirePermission("inventory.stock.read")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        return reply.code(200).send({ data: await getStockMovements(context.company.id) });
      } catch (error) {
        return sendError(error, request, reply);
      }
    },
  );

  app.post<{
    Params: { purchaseOrderId: string };
  }>(
    "/api/v1/inventory/purchase-orders/:purchaseOrderId/receipts",
    {
      preHandler: [authenticationMiddleware, requirePermission("inventory.goods_receipts.create")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        const receipt = await createGoodsReceipt(
          context.company.id,
          request.params.purchaseOrderId,
          context.user.userId,
          request.body,
          {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          },
        );
        return reply.code(201).send({ data: receipt });
      } catch (error) {
        return sendError(error, request, reply);
      }
    },
  );
};