import type { FastifyInstance } from "fastify";
import {
  getPlatformContext,
  type DevelopmentSession,
} from "../application/get-platform-context.js";

export const registerCoreContextRoute = (
  app: FastifyInstance,
): void => {
  app.get("/api/v1/core/context", async (_request, reply) => {
    const developmentSession: DevelopmentSession = {
      userId: await getDevelopmentUserId(),
      companyId: await getDevelopmentCompanyId(),
    };

    try {
      const context = await getPlatformContext(developmentSession);

      return reply.send({
        status: "ok",
        data: context,
      });
    } catch (error) {
      app.log.error(error);

      return reply.code(500).send({
        status: "error",
        message: "Unable to load platform context.",
      });
    }
  });
};

const getDevelopmentUserId = async (): Promise<string> => {
  const { db } = await import("../../../infrastructure/database/pool.js");

  const result = await db.query<{ id: string }>(
    `
      SELECT id
      FROM security.users
      WHERE email = $1
        AND status = 'ACTIVE'
    `,
    ["developer@enterprisex.local"],
  );

  if (result.rowCount !== 1) {
    throw new Error("Development user not found.");
  }

  return result.rows[0].id;
};

const getDevelopmentCompanyId = async (): Promise<string> => {
  const { db } = await import("../../../infrastructure/database/pool.js");

  const result = await db.query<{ id: string }>(
    `
      SELECT id
      FROM core.companies
      WHERE code = $1
        AND status = 'ACTIVE'
    `,
    ["ENTX-DEV-CO"],
  );

  if (result.rowCount !== 1) {
    throw new Error("Development company not found.");
  }

  return result.rows[0].id;
};