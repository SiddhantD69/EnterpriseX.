
import type { FastifyInstance } from "fastify";

import { authenticationMiddleware } from "../../../security-identity/api/authentication-middleware.js";
import { requirePermission } from "../../../security-identity/api/authorization-middleware.js";

import {
  createCompanyPlant,
  getPlants,
  PlantValidationError,
} from "../application/plant-service.js";

export const registerPlantRoutes = (app: FastifyInstance): void => {
  app.get(
    "/api/v1/core/plants",
    {
      preHandler: [
        authenticationMiddleware,
        requirePermission("core.plants.read"),
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
        const plants = await getPlants(context.company.id);

        return reply.code(200).send({ data: plants });
      } catch (error) {
        request.log.error(
          { err: error },
          "Plant listing failed.",
        );

        return reply.code(500).send({
          error: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        });
      }
    },
  );

  app.post(
    "/api/v1/core/plants",
    {
      preHandler: [
        authenticationMiddleware,
        requirePermission("core.plants.create"),
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
        const plant = await createCompanyPlant(
          context.company.id,
          request.body,
          {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          },
        );

        return reply.code(201).send({ data: plant });
      } catch (error) {
        if (error instanceof PlantValidationError) {
          return reply.code(400).send({
            error: "VALIDATION_ERROR",
            message: error.message,
          });
        }

        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "23505" &&
          "constraint" in error &&
          error.constraint === "plants_company_code_unique"
        ) {
          return reply.code(409).send({
            error: "PLANT_CODE_CONFLICT",
            message:
              "A plant with this code already exists in this company.",
          });
        }

        request.log.error(
          { err: error },
          "Plant creation failed.",
        );

        return reply.code(500).send({
          error: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        });
      }
    },
  );
};
