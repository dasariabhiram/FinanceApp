import type { FastifyPluginAsync } from "fastify";
import { ok } from "../../lib/envelope.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () =>
    ok({
      status: "ok",
      service: "finance-api",
      timestamp: new Date().toISOString(),
    }),
  );
};
