import type {
  FastifyInstance,
} from "fastify";

import {
  authenticationMiddleware,
} from "../../../security-identity/api/authentication-middleware.js";

import {
  requirePermission,
} from "../../../security-identity/api/authorization-middleware.js";

import {
  getConfiguration,
} from "../application/get-configuration.js";

import {
  setConfiguration,
} from "../application/set-configuration.js";

import {
  recordAuditEvent,
} from "../../audit/application/record-audit-event.js";

import type {
  ConfigurationScopeType,
} from "../domain/configuration.js";

type ConfigurationParams = {
  key: string;
};

type SetConfigurationBody = {
  scopeType: ConfigurationScopeType;
  scopeId?: string | null;
  value: string;
};

const isScopeType = (
  value: unknown,
): value is ConfigurationScopeType => {
  return (
    value === "SYSTEM" ||
    value === "ORGANIZATION" ||
    value === "COMPANY"
  );
};

export const registerConfigurationRoutes = (
  app: FastifyInstance,
): void => {
  app.get<{
    Params: ConfigurationParams;
  }>(
    "/api/v1/core/configuration/:key",
    {
      preHandler: [
        authenticationMiddleware,
        requirePermission(
          "core.configuration.read",
        ),
      ],
    },
    async (request, reply) => {
      const context =
        request.authenticatedContext;

      if (!context) {
        return reply.code(401).send({
          error: {
            code:
              "AUTHENTICATION_REQUIRED",
            message:
              "Authentication required.",
          },
        });
      }

      const configuration =
        await getConfiguration(
          request.params.key,
          "COMPANY",
          context.company.id,
        );

      if (!configuration) {
        return reply.code(404).send({
          error: {
            code:
              "CONFIGURATION_NOT_FOUND",
            message:
              "Configuration definition not found.",
          },
        });
      }

      return reply.code(200).send({
        status: "ok",
        data: configuration,
      });
    },
  );

  app.put<{
    Params: ConfigurationParams;
    Body: SetConfigurationBody;
  }>(
    "/api/v1/core/configuration/:key",
    {
      preHandler: [
        authenticationMiddleware,
        requirePermission(
          "core.configuration.write",
        ),
      ],
    },
    async (request, reply) => {
      const context =
        request.authenticatedContext;

      if (!context) {
        return reply.code(401).send({
          error: {
            code:
              "AUTHENTICATION_REQUIRED",
            message:
              "Authentication required.",
          },
        });
      }

      const {
        scopeType,
        scopeId,
        value,
      } = request.body;

      if (!isScopeType(scopeType)) {
        return reply.code(400).send({
          error: {
            code:
              "INVALID_CONFIGURATION_SCOPE",
            message:
              "Invalid configuration scope.",
          },
        });
      }

      if (
        typeof value !== "string"
      ) {
        return reply.code(400).send({
          error: {
            code:
              "INVALID_CONFIGURATION_VALUE",
            message:
              "Configuration value must be a string.",
          },
        });
      }

      let resolvedScopeId =
        scopeId ?? null;

      if (
        scopeType === "COMPANY"
      ) {
        resolvedScopeId =
          context.company.id;
      }

      if (
        scopeType === "ORGANIZATION"
      ) {
        resolvedScopeId =
          context.organization.id;
      }

      if (
        scopeType === "SYSTEM"
      ) {
        resolvedScopeId = null;
      }

      try {
        const configuration =
          await setConfiguration(
            request.params.key,
            scopeType,
            resolvedScopeId,
            value,
          );

        await recordAuditEvent({
          actorUserId:
            context.user.userId,

          organizationId:
            context.organization.id,

          companyId:
            context.company.id,

          action:
            "CONFIGURATION_UPDATED",

          entityType:
            "CONFIGURATION",

          entityId:
            configuration.id,

          status:
            "SUCCESS",

          afterData: {
            key:
              request.params.key,

            scopeType,

            scopeId:
              resolvedScopeId,

            value,
          },

          sourceModule:
            "core-platform",

          metadata: {
            operation:
              "configuration.update",
          },
        });

        return reply.code(200).send({
          status: "ok",
          data: configuration,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith(
            "Configuration definition not found:",
          )
        ) {
          return reply.code(404).send({
            error: {
              code:
                "CONFIGURATION_NOT_FOUND",
              message:
                "Configuration definition not found.",
            },
          });
        }

        throw error;
      }
    },
  );
};