import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { authenticationMiddleware } from "../../security-identity/api/authentication-middleware.js";
import { requirePermission } from "../../security-identity/api/authorization-middleware.js";
import {
  createAccount,
  createJournal,
  listAccounts,
  listJournals,
  postJournal,
  FinanceConflictError,
  FinanceNotFoundError,
  FinanceValidationError,
} from "../application/finance-service.js";

const sendFinanceError = (
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (error instanceof FinanceValidationError) {
    return reply.code(400).send({ error: "VALIDATION_ERROR", message: error.message });
  }
  if (error instanceof FinanceNotFoundError) {
    return reply.code(404).send({ error: error.code, message: error.message });
  }
  if (error instanceof FinanceConflictError) {
    return reply.code(409).send({ error: error.code, message: error.message });
  }

  request.log.error({ err: error }, "Finance request failed.");
  return reply.code(500).send({ error: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." });
};

export const registerFinanceRoutes = (app: FastifyInstance): void => {
  app.get(
    "/api/v1/finance/accounts",
    {
      preHandler: [authenticationMiddleware, requirePermission("finance.accounts.read")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(200).send({ data: await listAccounts(context.company.id) });
      } catch (error) {
        return sendFinanceError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/finance/accounts",
    {
      preHandler: [authenticationMiddleware, requirePermission("finance.accounts.create")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(201).send({
          data: await createAccount(context.company.id, request.body, {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          }),
        });
      } catch (error) {
        return sendFinanceError(error, request, reply);
      }
    },
  );

  app.get(
    "/api/v1/finance/journals",
    {
      preHandler: [authenticationMiddleware, requirePermission("finance.journals.read")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(200).send({ data: await listJournals(context.company.id) });
      } catch (error) {
        return sendFinanceError(error, request, reply);
      }
    },
  );

  app.post(
    "/api/v1/finance/journals",
    {
      preHandler: [authenticationMiddleware, requirePermission("finance.journals.create")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(201).send({
          data: await createJournal(context.company.id, context.user.userId, request.body, {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          }),
        });
      } catch (error) {
        return sendFinanceError(error, request, reply);
      }
    },
  );

  app.post<{
    Params: { journalId: string };
  }>(
    "/api/v1/finance/journals/:journalId/post",
    {
      preHandler: [authenticationMiddleware, requirePermission("finance.journals.post")],
    },
    async (request, reply) => {
      const context = request.authenticatedContext;
      if (!context) {
        return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Authentication is required." });
      }
      try {
        return reply.code(200).send({
          data: await postJournal(context.company.id, request.params.journalId, {
            actorUserId: context.user.userId,
            organizationId: context.organization.id,
            logger: request.log,
          }),
        });
      } catch (error) {
        return sendFinanceError(error, request, reply);
      }
    },
  );
};
