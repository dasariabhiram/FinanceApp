import Fastify from "fastify";
import cors from "@fastify/cors";
import { createDb } from "@finance/db";
import { getEnv } from "./env.js";
import { authPlugin } from "./plugins/auth.js";
import { healthRoutes } from "./modules/health/routes.js";
import { accountsRoutes } from "./modules/accounts/routes.js";
import { transactionsRoutes } from "./modules/transactions/routes.js";
import { summaryRoutes } from "./modules/summary/routes.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { orgRoutes } from "./modules/org/routes.js";
import { voiceRoutes } from "./modules/voice/routes.js";
import { fail } from "./lib/envelope.js";

export async function buildApp() {
  const env = getEnv();
  const app = Fastify({
    logger: env.NODE_ENV !== "production",
    bodyLimit: 1_048_576,
  });

  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    try {
      const raw = typeof body === "string" ? body : body?.toString?.() ?? "";
      done(null, raw.trim() === "" ? {} : JSON.parse(raw));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  const serverless = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const db = createDb(env.DATABASE_URL, { max: serverless ? 1 : 8 });

  await app.register(cors, {
    origin: env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
    credentials: false,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Org-Id"],
  });

  await app.register(authPlugin);
  await app.register(healthRoutes, { db });
  await app.register(accountsRoutes, { db });
  await app.register(transactionsRoutes, { db });
  await app.register(summaryRoutes, { db });
  await app.register(orgRoutes, { db });
  await app.register(adminRoutes, { db });
  await app.register(voiceRoutes, { db });

  app.setErrorHandler((error, _request, reply) => {
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    app.log.error(error);
    reply.code(status).send(fail(status === 401 ? "Unauthorized" : "Internal server error"));
  });

  return app;
}
