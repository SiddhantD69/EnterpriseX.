import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { authenticationMiddleware } from "./authentication-middleware.js";
import { requirePermission } from "./authorization-middleware.js";
import {
  AdministrationConflictError,
  AdministrationForbiddenError,
  createCompanyUser,
  createSecurityRole,
  getCompanyUserRoles,
  getCompanyUsers,
  getPermissions,
  getRoles,
  getUserCompanyAccess,
  grantUserCompanyAccess,
  setCompanyUserRole,
  updateCompanyUser,
  updateSecurityRole,
} from "../application/administration-service.js";
import {
  MasterDataNotFoundError,
  MasterDataValidationError,
} from "../../core-platform/master-data/application/master-data-errors.js";

const sendAdminError = (
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
  if (error instanceof AdministrationConflictError) {
    return reply.code(409).send({ error: error.code, message: error.message });
  }
  if (error instanceof AdministrationForbiddenError) {
    return reply.code(403).send({ error: "FORBIDDEN", message: error.message });
  }
  if (
    typeof error === "object" && error !== null && "code" in error &&
    error.code === "23505" && "constraint" in error &&
    error.constraint === "users_email_unique"
  ) {
    return reply.code(409).send({ error: "USER_EMAIL_CONFLICT", message: "An account with this email already exists." });
  }
  if (
    typeof error === "object" && error !== null && "code" in error &&
    error.code === "23505" && "constraint" in error &&
    error.constraint === "roles_code_unique"
  ) {
    return reply.code(409).send({ error: "ROLE_CODE_CONFLICT", message: "A role with this code already exists." });
  }
  request.log.error({ err: error }, "Identity administration request failed.");
  return reply.code(500).send({ error: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." });
};

export const registerAdministrationRoutes = (app: FastifyInstance): void => {
  app.get(
    "/api/v1/security/users",
    {
      preHandler: [authenticationMiddleware, requirePermission("security.users.read")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        return reply.code(200).send({ data: await getCompanyUsers(context.company.id) });
      } catch (error) {
        return sendAdminError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/security/users",
    {
      preHandler: [authenticationMiddleware, requirePermission("security.users.create")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        const user = await createCompanyUser(
          context.company.id,
          context.organization.id,
          request.body,
          {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          },
        );
        return reply.code(201).send({ data: user });
      } catch (error) {
        return sendAdminError(error, request, reply);
      }
    },
  );

  app.put<{
    Params: { userId: string };
  }>(
    "/api/v1/security/users/:userId",
    {
      preHandler: [authenticationMiddleware, requirePermission("security.users.update")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        const user = await updateCompanyUser(
          context.company.id,
          request.params.userId,
          request.body,
          {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          },
        );
        return reply.code(200).send({ data: user });
      } catch (error) {
        return sendAdminError(error, request, reply);
      }
    },
  );

  app.get<{
    Params: { userId: string };
  }>(
    "/api/v1/security/users/:userId/company-access",
    {
      preHandler: [authenticationMiddleware, requirePermission("security.users.read")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        return reply.code(200).send({
          data: await getUserCompanyAccess(request.params.userId, context.organization.id),
        });
      } catch (error) {
        return sendAdminError(error, request, reply);
      }
    },
  );

  app.post<{
    Params: { userId: string };
  }>(
    "/api/v1/security/users/:userId/company-access",
    {
      preHandler: [authenticationMiddleware, requirePermission("security.user_company_access.manage")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        const access = await grantUserCompanyAccess(
          context.company.id,
          context.organization.id,
          request.params.userId,
          request.body,
          {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          },
        );
        return reply.code(201).send({ data: access });
      } catch (error) {
        return sendAdminError(error, request, reply);
      }
    },
  );

  app.get(
    "/api/v1/security/roles",
    {
      preHandler: [authenticationMiddleware, requirePermission("security.roles.read")],
    },
    async (request, reply) => {
      if (!request.authenticatedContext) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        return reply.code(200).send({ data: await getRoles(context.company.id) });
      } catch (error) {
        return sendAdminError(error, request, reply);
      }
    },
  );

  app.get(
    "/api/v1/security/permissions",
    {
      preHandler: [authenticationMiddleware, requirePermission("security.roles.read")],
    },
    async (request, reply) => {
      if (!request.authenticatedContext) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        return reply.code(200).send({ data: await getPermissions() });
      } catch (error) {
        return sendAdminError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/security/roles",
    {
      preHandler: [authenticationMiddleware, requirePermission("security.roles.create")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        const role = await createSecurityRole(context.company.id, request.body, {
          actorUserId: context.user.userId,
          organizationId: context.organization.id,
          grantedPermissionCodes: context.permissions.map((permission) => permission.code),
          logger: request.log,
        });
        return reply.code(201).send({ data: role });
      } catch (error) {
        return sendAdminError(error, request, reply);
      }
    },
  );

  app.put<{
    Params: { roleId: string };
  }>(
    "/api/v1/security/roles/:roleId",
    {
      preHandler: [authenticationMiddleware, requirePermission("security.roles.update")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        const role = await updateSecurityRole(
          context.company.id,
          request.params.roleId,
          request.body,
          {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            grantedPermissionCodes: context.permissions.map((permission) => permission.code),
            logger: request.log,
          },
        );
        return reply.code(200).send({ data: role });
      } catch (error) {
        return sendAdminError(error, request, reply);
      }
    },
  );

  app.get<{
    Params: { userId: string };
  }>(
    "/api/v1/security/users/:userId/roles",
    {
      preHandler: [authenticationMiddleware, requirePermission("security.roles.read")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        return reply.code(200).send({ data: await getCompanyUserRoles(context.company.id, request.params.userId) });
      } catch (error) {
        return sendAdminError(error, request, reply);
      }
    },
  );

  app.put<{
    Params: { userId: string; roleId: string };
  }>(
    "/api/v1/security/users/:userId/roles/:roleId",
    {
      preHandler: [authenticationMiddleware, requirePermission("security.user_roles.manage")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      try {
        const assignment = await setCompanyUserRole(
          context.company.id,
          request.params.userId,
          request.params.roleId,
          request.body,
          {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          },
        );
        return reply.code(200).send({ data: assignment });
      } catch (error) {
        return sendAdminError(error, request, reply);
      }
    },
  );
};