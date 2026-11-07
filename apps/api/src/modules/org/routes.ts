import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { isPlatformAdmin } from "../../lib/platform-admin.js";
import { listMemberships } from "../../lib/org-context.js";
import { fail, ok } from "../../lib/envelope.js";
import { requireUser } from "../../plugins/auth.js";
import type { Db } from "@finance/db";

export const orgRoutes: FastifyPluginAsync<{ db: Db }> = async (app, opts) => {
  const { db } = opts;

  app.get("/v1/me/memberships", async (request, reply) => {
    try {
      const user = requireUser(request);
      const rows = await listMemberships(db, user.sub);
      const platformAdmin = await isPlatformAdmin(db, user.sub);
      return ok({
        memberships: rows.map((r) => ({
          orgId: r.orgId,
          orgName: r.orgName,
          orgSlug: r.orgSlug,
          role: r.role,
          orgStatus: r.orgStatus,
        })),
        platformAdmin,
      });
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 500;
      reply.code(status);
      return fail(status === 401 ? "Unauthorized" : "Failed to load memberships");
    }
  });

  app.get("/v1/admin/me", async (request, reply) => {
    try {
      const user = requireUser(request);
      const platformAdmin = await isPlatformAdmin(db, user.sub);
      return ok({ platformAdmin });
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 500;
      reply.code(status);
      return fail(status === 401 ? "Unauthorized" : "Failed");
    }
  });
};
