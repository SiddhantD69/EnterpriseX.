import Fastify from "fastify";
import cors from "@fastify/cors";

import { env } from "./config/env.js";
import { db } from "./infrastructure/database/pool.js";
import { registerCoreContextRoute } from "./modules/core-platform/api/core-context-route.js";
import { registerAuthRoutes } from "./modules/security-identity/api/auth-route.js";

export const buildApp = () => {
  const app = Fastify({
    logger: true,
  });

  void app.register(cors, {
    origin: [
      "http://localhost:1420",
      "http://127.0.0.1:1420",
      "http://tauri.localhost",
      "tauri://localhost",
    ],
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
  registerAuthRoutes(app);

  return app;
};