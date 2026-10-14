import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { authenticationMiddleware } from "../../../security-identity/api/authentication-middleware.js";
import { requirePermission } from "../../../security-identity/api/authorization-middleware.js";
import {
  MasterDataNotFoundError,
  MasterDataValidationError,
} from "../application/master-data-errors.js";
import {
  createCompanyMaterial,
  createCompanySupplier,
  createCurrencyDefinition,
  createUnitDefinition,
  getCurrencies,
  getMaterials,
  getSuppliers,
  getUnits,
  updateCompanyMaterialStatus,
  updateCompanySupplierStatus,
  updateCurrencyDefinitionStatus,
  updateUnitDefinitionStatus,
} from "../application/catalog-service.js";

const isPostgresError = (
  error: unknown,
  code: string,
  constraint: string,
): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === code &&
  "constraint" in error &&
  error.constraint === constraint;

const sendWriteError = (
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
  conflictConstraint?: string,
  conflictCode?: string,
  conflictMessage?: string,
) => {
  if (error instanceof MasterDataValidationError) {
    return reply.code(400).send({
      error: "VALIDATION_ERROR",
      message: error.message,
    });
  }

  if (error instanceof MasterDataNotFoundError) {
    return reply.code(404).send({
      error: error.code,
      message: error.message,
    });
  }

  if (
    conflictConstraint &&
    conflictCode &&
    isPostgresError(error, "23505", conflictConstraint)
  ) {
    return reply.code(409).send({
      error: conflictCode,
      message: conflictMessage ?? "A record with this code already exists.",
    });
  }

  request.log.error({ err: error }, "Core catalog request failed.");
  return reply.code(500).send({
    error: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred.",
  });
};

export const registerCatalogRoutes = (app: FastifyInstance): void => {
  app.get(
    "/api/v1/core/suppliers",
    {
      preHandler: [authenticationMiddleware, requirePermission("core.suppliers.read")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(200).send({ data: await getSuppliers(context.company.id) });
      } catch (error) {
        return sendWriteError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/core/suppliers",
    {
      preHandler: [authenticationMiddleware, requirePermission("core.suppliers.create")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        const supplier = await createCompanySupplier(context.company.id, request.body, {
          actorUserId: context.user.userId,
          organizationId: context.organization.id,
          logger: request.log,
        });
        return reply.code(201).send({ data: supplier });
      } catch (error) {
        return sendWriteError(
          error,
          request,
          reply,
          "suppliers_company_code_unique",
          "SUPPLIER_CODE_CONFLICT",
          "A supplier with this code already exists in this company.",
        );
      }
    },
  );

  app.put<{
    Params: { supplierId: string };
  }>(
    "/api/v1/core/suppliers/:supplierId/status",
    {
      preHandler: [authenticationMiddleware, requirePermission("core.suppliers.update")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        const supplier = await updateCompanySupplierStatus(
          context.company.id,
          request.params.supplierId,
          request.body,
          {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          },
        );
        return reply.code(200).send({ data: supplier });
      } catch (error) {
        return sendWriteError(error, request, reply);
      }
    },
  );

  app.get(
    "/api/v1/core/materials",
    {
      preHandler: [authenticationMiddleware, requirePermission("core.materials.read")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(200).send({ data: await getMaterials(context.company.id) });
      } catch (error) {
        return sendWriteError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/core/materials",
    {
      preHandler: [authenticationMiddleware, requirePermission("core.materials.create")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        const material = await createCompanyMaterial(context.company.id, request.body, {
          actorUserId: context.user.userId,
          organizationId: context.organization.id,
          logger: request.log,
        });
        return reply.code(201).send({ data: material });
      } catch (error) {
        return sendWriteError(
          error,
          request,
          reply,
          "materials_company_code_unique",
          "MATERIAL_CODE_CONFLICT",
          "A material with this code already exists in this company.",
        );
      }
    },
  );

  app.put<{
    Params: { materialId: string };
  }>(
    "/api/v1/core/materials/:materialId/status",
    {
      preHandler: [authenticationMiddleware, requirePermission("core.materials.update")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        const material = await updateCompanyMaterialStatus(
          context.company.id,
          request.params.materialId,
          request.body,
          {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          },
        );
        return reply.code(200).send({ data: material });
      } catch (error) {
        return sendWriteError(error, request, reply);
      }
    },
  );

  app.get(
    "/api/v1/core/currencies",
    {
      preHandler: [authenticationMiddleware, requirePermission("core.currencies.read")],
    },
    async (request, reply) => {
      if (!request.authenticatedContext) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(200).send({ data: await getCurrencies() });
      } catch (error) {
        return sendWriteError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/core/currencies",
    {
      preHandler: [authenticationMiddleware, requirePermission("core.currencies.create")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        const currency = await createCurrencyDefinition(request.body, context.company.id, {
          actorUserId: context.user.userId,
          organizationId: context.organization.id,
          logger: request.log,
        });
        return reply.code(201).send({ data: currency });
      } catch (error) {
        return sendWriteError(error, request, reply, "currencies_pkey", "CURRENCY_CODE_CONFLICT");
      }
    },
  );

  app.put<{
    Params: { code: string };
  }>(
    "/api/v1/core/currencies/:code/status",
    {
      preHandler: [authenticationMiddleware, requirePermission("core.currencies.update")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        const currency = await updateCurrencyDefinitionStatus(request.params.code, request.body, context.company.id, {
          actorUserId: context.user.userId,
          organizationId: context.organization.id,
          logger: request.log,
        });
        return reply.code(200).send({ data: currency });
      } catch (error) {
        return sendWriteError(error, request, reply);
      }
    },
  );

  app.get(
    "/api/v1/core/units-of-measure",
    {
      preHandler: [authenticationMiddleware, requirePermission("core.units_of_measure.read")],
    },
    async (request, reply) => {
      if (!request.authenticatedContext) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(200).send({ data: await getUnits() });
      } catch (error) {
        return sendWriteError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/core/units-of-measure",
    {
      preHandler: [authenticationMiddleware, requirePermission("core.units_of_measure.create")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        const unit = await createUnitDefinition(request.body, context.company.id, {
          actorUserId: context.user.userId,
          organizationId: context.organization.id,
          logger: request.log,
        });
        return reply.code(201).send({ data: unit });
      } catch (error) {
        return sendWriteError(error, request, reply, "units_of_measure_pkey", "UNIT_CODE_CONFLICT");
      }
    },
  );

  app.put<{
    Params: { code: string };
  }>(
    "/api/v1/core/units-of-measure/:code/status",
    {
      preHandler: [authenticationMiddleware, requirePermission("core.units_of_measure.update")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        const unit = await updateUnitDefinitionStatus(request.params.code, request.body, context.company.id, {
          actorUserId: context.user.userId,
          organizationId: context.organization.id,
          logger: request.log,
        });
        return reply.code(200).send({ data: unit });
      } catch (error) {
        return sendWriteError(error, request, reply);
      }
    },
  );
};