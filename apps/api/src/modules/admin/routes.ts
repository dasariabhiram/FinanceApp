import type { FastifyPluginAsync } from "fastify";
import { desc, eq } from "drizzle-orm";
import { createOrganizationSchema } from "@finance/contracts";
import { organizations, orgMemberships, profiles, type Db } from "@finance/db";
import { fail, ok } from "../../lib/envelope.js";
import { requirePlatformAdmin } from "../../lib/platform-admin.js";
import { inviteUserByEmail } from "../../lib/supabase-admin.js";

export const adminRoutes: FastifyPluginAsync<{ db: Db }> = async (app, opts) => {
  const { db } = opts;

  app.get("/v1/admin/organizations", async (request, reply) => {
    try {
      await requirePlatformAdmin(db, request);
      const rows = await db.select().from(organizations).orderBy(desc(organizations.createdAt));
      return ok(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          status: r.status,
          timezone: r.timezone,
          createdAt: r.createdAt.toISOString(),
        })),
      );
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 500;
      reply.code(status);
      return fail(status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : "Failed to list orgs");
    }
  });

  app.post("/v1/admin/organizations", async (request, reply) => {
    try {
      await requirePlatformAdmin(db, request);
      const parsed = createOrganizationSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return fail(parsed.error.issues[0]?.message ?? "Invalid body");
      }
      const input = parsed.data;
      const [existing] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, input.slug))
        .limit(1);
      if (existing) {
        reply.code(409);
        return fail("Slug already in use");
      }

      const org = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(organizations)
          .values({
            name: input.name,
            slug: input.slug,
            status: "active",
          })
          .returning();

        const [profile] = await tx
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.email, input.ownerEmail.toLowerCase()))
          .limit(1);

        if (profile) {
          await tx.insert(orgMemberships).values({
            orgId: created!.id,
            userId: profile.id,
            role: "org_owner",
          });
        }

        return created!;
      });

      const invite = await inviteUserByEmail(input.ownerEmail);
      reply.code(201);
      return ok({
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          status: org.status,
          timezone: org.timezone,
          createdAt: org.createdAt.toISOString(),
        },
        inviteSent: invite.ok,
        inviteError: invite.ok ? null : invite.error,
      });
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 500;
      reply.code(status);
      return fail(status === 403 ? "Forbidden" : "Failed to create organization");
    }
  });

  app.patch<{ Params: { id: string } }>("/v1/admin/organizations/:id/status", async (request, reply) => {
    try {
      await requirePlatformAdmin(db, request);
      const status = (request.body as { status?: string })?.status;
      if (status !== "active" && status !== "suspended") {
        reply.code(400);
        return fail("status must be active or suspended");
      }
      const [row] = await db
        .update(organizations)
        .set({ status, updatedAt: new Date() })
        .where(eq(organizations.id, request.params.id))
        .returning();
      if (!row) {
        reply.code(404);
        return fail("Not found");
      }
      return ok({
        id: row.id,
        status: row.status,
      });
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 500;
      reply.code(status);
      return fail(status === 403 ? "Forbidden" : "Failed to update status");
    }
  });
};
