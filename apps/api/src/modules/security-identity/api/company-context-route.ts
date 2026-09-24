import type { FastifyInstance } from "fastify";

import {
  getSelectableCompanies,
  selectCompanyContext,
} from "../application/company-context-service.js";

type CompanyContextRequestBody = {
  companyId?: unknown;
};

const BEARER_PREFIX = "Bearer ";

const getBearerToken = (
  authorization: string | undefined,
): string | null => {
  if (
    !authorization ||
    !authorization.startsWith(
      BEARER_PREFIX,
    )
  ) {
    return null;
  }

  const token = authorization
    .slice(BEARER_PREFIX.length)
    .trim();

  return token || null;
};

const sendAuthenticationRequired = (
  reply: {
    code: (
      statusCode: number,
    ) => {
      send: (
        payload: unknown,
      ) => unknown;
    };
  },
) => {
  return reply.code(401).send({
    error: {
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication required.",
    },
  });
};

const isCompanyContextRequestBody = (
  body: unknown,
): body is {
  companyId: string;
} => {
  if (
    typeof body !== "object" ||
    body === null
  ) {
    return false;
  }

  const candidate =
    body as CompanyContextRequestBody;

  return (
    typeof candidate.companyId ===
      "string" &&
    candidate.companyId.trim().length > 0
  );
};

const sendInvalidCompanyContext = (
  reply: {
    code: (
      statusCode: number,
    ) => {
      send: (
        payload: unknown,
      ) => unknown;
    };
  },
) => {
  return reply.code(400).send({
    error: {
      code: "INVALID_COMPANY_CONTEXT",
      message: "A valid companyId is required.",
    },
  });
};

const sendCompanyContextForbidden = (
  reply: {
    code: (
      statusCode: number,
    ) => {
      send: (
        payload: unknown,
      ) => unknown;
    };
  },
) => {
  return reply.code(403).send({
    error: {
      code: "COMPANY_CONTEXT_FORBIDDEN",
      message: "Company context is not allowed.",
    },
  });
};

export const registerCompanyContextRoutes = (
  app: FastifyInstance,
): void => {
  app.get(
    "/api/v1/auth/companies",
    async (request, reply) => {
      const token = getBearerToken(
        request.headers.authorization,
      );

      if (!token) {
        return sendAuthenticationRequired(reply);
      }

      const result =
        await getSelectableCompanies(token);

      if (
        result.status ===
        "AUTHENTICATION_REQUIRED"
      ) {
        return sendAuthenticationRequired(reply);
      }

      return reply.code(200).send({
        companies: result.companies.map(
          (company) => ({
            organization: {
              id: company.organizationId,
              code: company.organizationCode,
              name: company.organizationName,
            },
            company: {
              id: company.companyId,
              code: company.companyCode,
              name: company.companyName,
            },
          }),
        ),
      });
    },
  );

  app.post(
    "/api/v1/auth/company-context",
    async (request, reply) => {
      const token = getBearerToken(
        request.headers.authorization,
      );

      if (!token) {
        return sendAuthenticationRequired(reply);
      }

      if (
        !isCompanyContextRequestBody(
          request.body,
        )
      ) {
        return sendInvalidCompanyContext(reply);
      }

      const result =
        await selectCompanyContext(
          token,
          request.body.companyId.trim(),
        );

      if (
        result.status ===
        "AUTHENTICATION_REQUIRED"
      ) {
        return sendAuthenticationRequired(reply);
      }

      if (
        result.status ===
        "COMPANY_NOT_ALLOWED"
      ) {
        return sendCompanyContextForbidden(reply);
      }

      if (
        result.status ===
        "SESSION_UPDATE_FAILED"
      ) {
        return sendAuthenticationRequired(reply);
      }

      return reply.code(200).send({
        companyContext: {
          status: "SELECTED",
          organizationId:
            result.company.organizationId,
          companyId:
            result.company.companyId,
        },
        organization: {
          id: result.company.organizationId,
          code: result.company.organizationCode,
          name: result.company.organizationName,
        },
        company: {
          id: result.company.companyId,
          code: result.company.companyCode,
          name: result.company.companyName,
        },
      });
    },
  );
};
