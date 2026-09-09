import Fastify from "fastify";
import { env } from "./config/env.js";
import { db } from "./infrastructure/database/pool.js";
import { registerCoreContextRoute } from "./modules/core-platform/api/core-context-route.js";

const app = Fastify({
  logger: true,
});

app.get("/health", async () => {
  return {
    status: "ok",
    service: "enterprisex-api",
    environment: env.nodeEnv,
  };
});

app.get("/health/db", async () => {
  const result = await db.query("SELECT 1 AS connected");

  return {
    status: "ok",
    database: result.rows[0].connected === 1,
  };
});

registerCoreContextRoute(app);

const start = async (): Promise<void> => {
  try {
    await app.listen({
      port: env.port,
      host: env.host,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();