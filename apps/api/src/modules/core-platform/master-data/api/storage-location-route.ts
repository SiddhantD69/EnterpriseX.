import type { FastifyInstance } from "fastify";

import { authenticationMiddleware } from "../../../security-identity/api/authentication-middleware.js";
import { requirePermission } from "../../../security-identity/api/authorization-middleware.js";
import {
  MasterDataNotFoundError,
  MasterDataValidationError,
} from "../application/master-data-errors.js";
import {
  createCompanyStorageLocation,
  getStorageLocation,
  getStorageLocations,
  updateCompanyStorageLocation,
} from "../application/storage-location-service.js";

type StorageLocationParams = {
  storageLocationId: string;
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

export const registerStorageLocationRoutes = (
  app: FastifyInstance,
): void => {
  app.get(
    "/api/v1/core/storage-locations",
    {
      preHandler: [
        authenticationMiddleware,
        requirePermission("core.storage_locations.read"),
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
          data: await getStorageLocations(context.company.id),
        });
      } catch (error) {
        request.log.error({ err: error }, "Storage location listing failed.");
        return reply.code(500).send({
          error: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        });
      }
    },
  );

  app.get<{
    Params: StorageLocationParams;
  }>(
    "/api/v1/core/storage-locations/:storageLocationId",
    {
      preHandler: [
        authenticationMiddleware,
        requirePermission("core.storage_locations.read"),
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
          data: await getStorageLocation(
            context.company.id,
            request.params.storageLocationId,
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

        request.log.error({ err: error }, "Storage location lookup failed.");
        return reply.code(500).send({
          error: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        });
      }
    },
  );

  app.post(
    "/api/v1/core/storage-locations",
    {
      preHandler: [
        authenticationMiddleware,
        requirePermission("core.storage_locations.create"),
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
        const storageLocation = await createCompanyStorageLocation(
          context.company.id,
          request.body,
          {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          },
        );

        return reply.code(201).send({ data: storageLocation });
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
          isPostgresError(
            error,
            "23505",
            "storage_locations_company_code_unique",
          )
        ) {
          return reply.code(409).send({
            error: "STORAGE_LOCATION_CODE_CONFLICT",
            message:
              "A storage location with this code already exists in this warehouse.",
          });
        }

        if (
          isPostgresError(
            error,
            "23503",
            "storage_locations_warehouse_company_fk",
          )
        ) {
          return reply.code(404).send({
            error: "WAREHOUSE_NOT_FOUND",
            message: "Warehouse not found for this company.",
          });
        }

        request.log.error({ err: error }, "Storage location creation failed.");
        return reply.code(500).send({
          error: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        });
      }
    },
  );

  app.put<{
    Params: StorageLocationParams;
  }>(
    "/api/v1/core/storage-locations/:storageLocationId",
    {
      preHandler: [
        authenticationMiddleware,
        requirePermission("core.storage_locations.update"),
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
        const storageLocation = await updateCompanyStorageLocation(
          context.company.id,
          request.params.storageLocationId,
          request.body,
          {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          },
        );

        return reply.code(200).send({ data: storageLocation });
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
          isPostgresError(
            error,
            "23505",
            "storage_locations_company_code_unique",
          )
        ) {
          return reply.code(409).send({
            error: "STORAGE_LOCATION_CODE_CONFLICT",
            message:
              "A storage location with this code already exists in this warehouse.",
          });
        }

        if (
          isPostgresError(
            error,
            "23503",
            "storage_locations_warehouse_company_fk",
          )
        ) {
          return reply.code(404).send({
            error: "WAREHOUSE_NOT_FOUND",
            message: "Warehouse not found for this company.",
          });
        }

        request.log.error({ err: error }, "Storage location update failed.");
        return reply.code(500).send({
          error: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        });
      }
    },
  );
};