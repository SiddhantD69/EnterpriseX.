import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { authenticationMiddleware } from "../../security-identity/api/authentication-middleware.js";
import { requirePermission } from "../../security-identity/api/authorization-middleware.js";
import {
  MasterDataNotFoundError,
  MasterDataValidationError,
} from "../../core-platform/master-data/application/master-data-errors.js";
import {
  createPurchaseOrderFromRequisition,
  createRequisition,
  getCompanyPurchaseOrders,
  getCompanyRequisition,
  getCompanyRequisitions,
  ProcurementConflictError,
  submitRequisition,
  updateDraftRequisition,
} from "../application/procurement-service.js";
import {
  createMatchedSupplierInvoice,
  getCompanySupplierInvoices,
} from "../application/supplier-invoice-service.js";

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
  if (
    typeof error === "object" && error !== null && "code" in error &&
    error.code === "23505" && "constraint" in error &&
    error.constraint === "purchase_orders_company_number_unique"
  ) {
    return reply.code(409).send({
      error: "PURCHASE_ORDER_NUMBER_CONFLICT",
      message: "Purchase-order number already exists.",
    });
  }
  if (
    typeof error === "object" && error !== null && "code" in error &&
    error.code === "23505" && "constraint" in error &&
    error.constraint === "supplier_invoices_supplier_number_unique"
  ) {
    return reply.code(409).send({
      error: "DUPLICATE_SUPPLIER_INVOICE",
      message: "This supplier invoice number has already been recorded.",
    });
  }
  request.log.error({ err: error }, "Procurement request failed.");
  return reply.code(500).send({
    error: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred.",
  });
};

export const registerProcurementRoutes = (app: FastifyInstance): void => {
  app.get(
    "/api/v1/procurement/requisitions",
    {
      preHandler: [authenticationMiddleware, requirePermission("procurement.requisitions.read")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        return reply.code(200).send({ data: await getCompanyRequisitions(context.company.id) });
      } catch (error) {
        return sendError(error, request, reply);
      }
    },
  );

  app.get<{
    Params: { requisitionId: string };
  }>(
    "/api/v1/procurement/requisitions/:requisitionId",
    {
      preHandler: [authenticationMiddleware, requirePermission("procurement.requisitions.read")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        return reply.code(200).send({ data: await getCompanyRequisition(context.company.id, request.params.requisitionId) });
      } catch (error) {
        return sendError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/procurement/requisitions",
    {
      preHandler: [authenticationMiddleware, requirePermission("procurement.requisitions.create")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        const requisition = await createRequisition(
          context.company.id,
          context.user.userId,
          request.body,
          {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          },
        );
        return reply.code(201).send({ data: requisition });
      } catch (error) {
        return sendError(error, request, reply);
      }
    },
  );

  app.put<{
    Params: { requisitionId: string };
  }>(
    "/api/v1/procurement/requisitions/:requisitionId",
    {
      preHandler: [authenticationMiddleware, requirePermission("procurement.requisitions.update")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        const requisition = await updateDraftRequisition(
          context.company.id,
          request.params.requisitionId,
          request.body,
          {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          },
        );
        return reply.code(200).send({ data: requisition });
      } catch (error) {
        return sendError(error, request, reply);
      }
    },
  );

  app.post<{
    Params: { requisitionId: string };
  }>(
    "/api/v1/procurement/requisitions/:requisitionId/submit",
    {
      preHandler: [authenticationMiddleware, requirePermission("procurement.requisitions.submit")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        return reply.code(200).send({
          data: await submitRequisition(
            context.company.id,
            request.params.requisitionId,
            {
              actorUserId: context.user.userId,
              organizationId: context.organization.id,
              logger: request.log,
            },
          ),
        });
      } catch (error) {
        return sendError(error, request, reply);
      }
    },
  );

  app.get(
    "/api/v1/procurement/purchase-orders",
    {
      preHandler: [authenticationMiddleware, requirePermission("procurement.purchase_orders.read")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        return reply.code(200).send({ data: await getCompanyPurchaseOrders(context.company.id) });
      } catch (error) {
        return sendError(error, request, reply);
      }
    },
  );

  app.post<{
    Params: { requisitionId: string };
  }>(
    "/api/v1/procurement/requisitions/:requisitionId/purchase-order",
    {
      preHandler: [authenticationMiddleware, requirePermission("procurement.purchase_orders.create")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        const purchaseOrder = await createPurchaseOrderFromRequisition(
          context.company.id,
          request.params.requisitionId,
          context.user.userId,
          request.body,
          {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          },
        );
        return reply.code(201).send({ data: purchaseOrder });
      } catch (error) {
        return sendError(error, request, reply);
      }
    },
  );

  app.post<{
    Params: { purchaseOrderId: string };
  }>(
    "/api/v1/procurement/purchase-orders/:purchaseOrderId/supplier-invoices",
    {
      preHandler: [authenticationMiddleware, requirePermission("procurement.supplier_invoices.create")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        const invoice = await createMatchedSupplierInvoice(
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
        return reply.code(201).send({ data: invoice });
      } catch (error) {
        return sendError(error, request, reply);
      }
    },
  );

  app.get(
    "/api/v1/procurement/supplier-invoices",
    {
      preHandler: [authenticationMiddleware, requirePermission("procurement.supplier_invoices.read")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        return reply.code(200).send({ data: await getCompanySupplierInvoices(context.company.id) });
      } catch (error) {
        return sendError(error, request, reply);
      }
    },
  );
};