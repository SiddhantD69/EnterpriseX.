import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { authenticationMiddleware } from "../../security-identity/api/authentication-middleware.js";
import { requireAnyPermission } from "../../security-identity/api/authorization-middleware.js";
import {
  OrganizationAdminConflictError,
  createCompanyInOrganization,
  createOrganizationWithInitialCompany,
  getCurrentOrganization,
  listCurrentOrganizationCompanies,
  updateCompanyInOrganization,
  updateCurrentOrganizationName,
} from "../application/organization-admin-service.js";
import {
  MasterDataNotFoundError,
  MasterDataValidationError,
} from "../master-data/application/master-data-errors.js";

const sendOrganizationCompanyError = (
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply => {
  if (error instanceof MasterDataValidationError) {
    return reply.code(400).send({ error: "VALIDATION_ERROR", message: error.message });
  }
  if (error instanceof MasterDataNotFoundError) {
    return reply.code(404).send({ error: error.code, message: error.message });
  }
  if (error instanceof OrganizationAdminConflictError) {
    return reply.code(409).send({ error: error.code, message: error.message });
  }

  request.log.error({ err: error }, "Organization or company administration request failed.");
  return reply.code(500).send({ error: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." });
};

export const registerOrganizationCompanyRoutes = (app: FastifyInstance): void => {
  app.get(
    "/api/v1/core/organizations",
    {
      preHandler: [
        authenticationMiddleware,
        requireAnyPermission(["core.organizations.read", "core.organization.read"]),
      ],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }

      try {
        return reply.code(200).send({ data: await getCurrentOrganization(context.organization.id) });
      } catch (error) {
        return sendOrganizationCompanyError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/core/organizations",
    {
      preHandler: [
        authenticationMiddleware,
        requireAnyPermission(["core.organizations.create", "core.organization.create"]),
      ],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }

      try {
        const result = await createOrganizationWithInitialCompany(
          {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            companyId: context.company.id,
            logger: request.log,
          },
          request.body,
        );
        return reply.code(201).send({ data: result });
      } catch (error) {
        return sendOrganizationCompanyError(error, request, reply);
      }
    },
  );

  app.put(
    "/api/v1/core/organizations",
    {
      preHandler: [
        authenticationMiddleware,
        requireAnyPermission(["core.organizations.update", "core.organization.update"]),
      ],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }

      try {
        const organization = await updateCurrentOrganizationName(context.organization.id, request.body, {
          actorUserId: context.user.userId,
          organizationId: context.organization.id,
          companyId: context.company.id,
          logger: request.log,
        });
        return reply.code(200).send({ data: organization });
      } catch (error) {
        return sendOrganizationCompanyError(error, request, reply);
      }
    },
  );

  app.get(
    "/api/v1/core/companies",
    {
      preHandler: [
        authenticationMiddleware,
        requireAnyPermission(["core.companies.read", "core.company.read"]),
      ],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }

      try {
        return reply.code(200).send({ data: await listCurrentOrganizationCompanies(context.organization.id) });
      } catch (error) {
        return sendOrganizationCompanyError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/core/companies",
    {
      preHandler: [
        authenticationMiddleware,
        requireAnyPermission(["core.companies.create", "core.company.create"]),
      ],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }

      try {
        const company = await createCompanyInOrganization(
          context.company.id,
          request.body,
          {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            companyId: context.company.id,
            logger: request.log,
          },
        );
        return reply.code(201).send({ data: company });
      } catch (error) {
        return sendOrganizationCompanyError(error, request, reply);
      }
    },
  );

  app.put<{ Params: { companyId: string } }>(
    "/api/v1/core/companies/:companyId",
    {
      preHandler: [
        authenticationMiddleware,
        requireAnyPermission(["core.companies.update", "core.company.update"]),
      ],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }

      try {
        const company = await updateCompanyInOrganization(
          context.company.id,
          request.params.companyId,
          request.body,
          {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            companyId: context.company.id,
            logger: request.log,
          },
        );
        return reply.code(200).send({ data: company });
      } catch (error) {
        return sendOrganizationCompanyError(error, request, reply);
      }
    },
  );
};
