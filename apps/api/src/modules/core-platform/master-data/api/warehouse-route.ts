import type { FastifyInstance } from "fastify";

import { authenticationMiddleware } from "../../../security-identity/api/authentication-middleware.js";
import { requirePermission } from "../../../security-identity/api/authorization-middleware.js";
import {
  MasterDataNotFoundError,
  MasterDataValidationError,
} from "../application/master-data-errors.js";
import {
  createCompanyWarehouse,
  getWarehouse,
  getWarehouses,
  updateCompanyWarehouse,
} from "../application/warehouse-service.js";

type WarehouseParams = {
  warehouseId: string;
};

const isPostgresError = (
  error: unknown,
  code: string,
  constraint?: string,
): boolean => {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    error.code !== code
  ) {
    return false;
  }

  return constraint === undefined ||
    ("constraint" in error && error.constraint === constraint);
};

export const registerWarehouseRoutes = (
  app: FastifyInstance,
): void => {
  app.get(
    "/api/v1/core/warehouses",
    {
      preHandler: [
        authenticationMiddleware,
        requirePermission("core.warehouses.read"),
      ],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;

      if (!context) {
        return reply.code(401).send({
          error: "UNAUTHENTICATED",
          message: "Authentication is required.",
        });
      }

      try {
        return reply.code(200).send({
          data: await getWarehouses(context.company.id),
        });
      } catch (error) {
        request.log.error({ err: error }, "Warehouse listing failed.");
        return reply.code(500).send({
          error: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        });
      }
    },
  );

  app.get<{
    Params: WarehouseParams;
  }>(
    "/api/v1/core/warehouses/:warehouseId",
    {
      preHandler: [
        authenticationMiddleware,
        requirePermission("core.warehouses.read"),
      ],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;

      if (!context) {
        return reply.code(401).send({
          error: "UNAUTHENTICATED",
          message: "Authentication is required.",
        });
      }

      try {
        return reply.code(200).send({
          data: await getWarehouse(
            context.company.id,
            request.params.warehouseId,
          ),
        });
      } catch (error) {
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

        request.log.error({ err: error }, "Warehouse lookup failed.");
        return reply.code(500).send({
          error: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        });
      }
    },
  );

  app.post(
    "/api/v1/core/warehouses",
    {
      preHandler: [
        authenticationMiddleware,
        requirePermission("core.warehouses.create"),
      ],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;

      if (!context) {
        return reply.code(401).send({
          error: "UNAUTHENTICATED",
          message: "Authentication is required.",
        });
      }

      try {
        const warehouse = await createCompanyWarehouse(
          context.company.id,
          request.body,
          {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          },
        );

        return reply.code(201).send({ data: warehouse });
      } catch (error) {
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
          isPostgresError(error, "23505", "warehouses_company_code_unique")
        ) {
          return reply.code(409).send({
            error: "WAREHOUSE_CODE_CONFLICT",
            message: "A warehouse with this code already exists in this company.",
          });
        }

        if (
          isPostgresError(error, "23503", "warehouses_plant_company_fk")
        ) {
          return reply.code(404).send({
            error: "PLANT_NOT_FOUND",
            message: "Plant not found for this company.",
          });
        }

        request.log.error({ err: error }, "Warehouse creation failed.");
        return reply.code(500).send({
          error: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        });
      }
    },
  );

  app.put<{
    Params: WarehouseParams;
  }>(
    "/api/v1/core/warehouses/:warehouseId",
    {
      preHandler: [
        authenticationMiddleware,
        requirePermission("core.warehouses.update"),
      ],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;

      if (!context) {
        return reply.code(401).send({
          error: "UNAUTHENTICATED",
          message: "Authentication is required.",
        });
      }

      try {
        const warehouse = await updateCompanyWarehouse(
          context.company.id,
          request.params.warehouseId,
          request.body,
          {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          },
        );

        return reply.code(200).send({ data: warehouse });
      } catch (error) {
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
          isPostgresError(error, "23505", "warehouses_company_code_unique")
        ) {
          return reply.code(409).send({
            error: "WAREHOUSE_CODE_CONFLICT",
            message: "A warehouse with this code already exists in this company.",
          });
        }

        if (
          isPostgresError(error, "23503", "warehouses_plant_company_fk")
        ) {
          return reply.code(404).send({
            error: "PLANT_NOT_FOUND",
            message: "Plant not found for this company.",
          });
        }

        request.log.error({ err: error }, "Warehouse update failed.");
        return reply.code(500).send({
          error: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        });
      }
    },
  );
};