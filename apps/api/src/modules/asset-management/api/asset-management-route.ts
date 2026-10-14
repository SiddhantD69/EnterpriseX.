import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { authenticationMiddleware } from "../../security-identity/api/authentication-middleware.js";
import { requirePermission } from "../../security-identity/api/authorization-middleware.js";
import {
  createAsset,
  createProject,
  createServiceRequest,
  listAssets,
  listProjects,
  listServices,
  AssetManagementConflictError,
  AssetManagementNotFoundError,
  AssetManagementValidationError,
} from "../application/asset-management-service.js";

const sendAssetManagementError = (error: unknown, request: FastifyRequest, reply: FastifyReply) => {
  if (error instanceof AssetManagementValidationError) {
    return reply.code(400).send({ error: "VALIDATION_ERROR", message: error.message });
  }
  if (error instanceof AssetManagementNotFoundError) {
    return reply.code(404).send({ error: error.code, message: error.message });
  }
  if (error instanceof AssetManagementConflictError) {
    return reply.code(409).send({ error: error.code, message: error.message });
  }

  request.log.error({ err: error }, "Asset/project/service request failed.");
  return reply.code(500).send({ error: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." });
};

export const registerAssetManagementRoutes = (app: FastifyInstance): void => {
  app.get(
    "/api/v1/assets",
    { preHandler: [authenticationMiddleware, requirePermission("assets.read")] },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(200).send({ data: await listAssets(context.company.id) });
      } catch (error) {
        return sendAssetManagementError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/assets",
    { preHandler: [authenticationMiddleware, requirePermission("assets.create")] },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(201).send({
          data: await createAsset(context.company.id, request.body, {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          }),
        });
      } catch (error) {
        return sendAssetManagementError(error, request, reply);
      }
    },
  );

  app.get(
    "/api/v1/projects",
    { preHandler: [authenticationMiddleware, requirePermission("projects.read")] },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(200).send({ data: await listProjects(context.company.id) });
      } catch (error) {
        return sendAssetManagementError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/projects",
    { preHandler: [authenticationMiddleware, requirePermission("projects.create")] },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(201).send({
          data: await createProject(context.company.id, request.body, {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          }),
        });
      } catch (error) {
        return sendAssetManagementError(error, request, reply);
      }
    },
  );

  app.get(
    "/api/v1/services",
    { preHandler: [authenticationMiddleware, requirePermission("services.read")] },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(200).send({ data: await listServices(context.company.id) });
      } catch (error) {
        return sendAssetManagementError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/services",
    { preHandler: [authenticationMiddleware, requirePermission("services.create")] },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(201).send({
          data: await createServiceRequest(context.company.id, request.body, {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          }),
        });
      } catch (error) {
        return sendAssetManagementError(error, request, reply);
      }
    },
  );
};
