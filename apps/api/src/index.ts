import Fastify from "fastify";
import { env } from "./config/env.js";

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