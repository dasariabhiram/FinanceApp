import type { FastifyPluginAsync } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createAccountSchema } from "@finance/contracts";
import { accounts, type Db } from "@finance/db";
import { fail, ok } from "../../lib/envelope.js";
import { requireUser } from "../../plugins/auth.js";

const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(["CASH", "BANK", "CREDIT_CARD", "SAVINGS"]).optional(),
  isDefault: z.boolean().optional(),
});

export const accountsRoutes: FastifyPluginAsync<{ db: Db }> = async (app, opts) => {
  const { db } = opts;

  app.get("/v1/accounts", async (request, reply) => {
    try {
      const user = requireUser(request);
      const rows = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, user.sub))
        .orderBy(desc(accounts.createdAt));
      return ok(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          currency: r.currency,
          balanceMinor: r.balanceMinor.toString(),
          isDefault: r.isDefault,
          createdAt: r.createdAt.toISOString(),
        })),
      );
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 500;
      reply.code(status);
      return fail(status === 401 ? "Unauthorized" : "Failed to list accounts");
    }
  });

  app.post("/v1/accounts", async (request, reply) => {
    try {
      const user = requireUser(request);
      const parsed = createAccountSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return fail(parsed.error.issues[0]?.message ?? "Invalid body");
      }
      const input = parsed.data;

      const [row] = await db.transaction(async (tx) => {
        if (input.isDefault) {
          await tx
            .update(accounts)
            .set({ isDefault: false })
            .where(eq(accounts.userId, user.sub));
        }
        return tx
          .insert(accounts)
          .values({
            userId: user.sub,
            name: input.name,
            type: input.type,
            currency: input.currency,
            isDefault: input.isDefault ?? false,
          })
          .returning();
      });

      if (!row) {
        reply.code(500);
        return fail("Insert failed");
      }
      reply.code(201);
      return ok({
        id: row.id,
        name: row.name,
        type: row.type,
        currency: row.currency,
        balanceMinor: row.balanceMinor.toString(),
        isDefault: row.isDefault,
        createdAt: row.createdAt.toISOString(),
      });
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 500;
      reply.code(status);
      return fail(status === 401 ? "Unauthorized" : "Failed to create account");
    }
  });

  app.patch<{ Params: { id: string } }>("/v1/accounts/:id", async (request, reply) => {
    try {
      const user = requireUser(request);
      const parsed = updateAccountSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return fail(parsed.error.issues[0]?.message ?? "Invalid body");
      }
      const input = parsed.data;
      const [row] = await db.transaction(async (tx) => {
        if (input.isDefault === true) {
          await tx.update(accounts).set({ isDefault: false }).where(eq(accounts.userId, user.sub));
        }
        return tx
          .update(accounts)
          .set({
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.type !== undefined ? { type: input.type } : {}),
            ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
          })
          .where(and(eq(accounts.id, request.params.id), eq(accounts.userId, user.sub)))
          .returning();
      });
      if (!row) {
        reply.code(404);
        return fail("Account not found");
      }
      return ok({
        id: row.id,
        name: row.name,
        type: row.type,
        currency: row.currency,
        balanceMinor: row.balanceMinor.toString(),
        isDefault: row.isDefault,
        createdAt: row.createdAt.toISOString(),
      });
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 500;
      reply.code(status);
      return fail(status === 401 ? "Unauthorized" : "Failed to update account");
    }
  });

  app.delete<{ Params: { id: string } }>("/v1/accounts/:id", async (request, reply) => {
    try {
      const user = requireUser(request);
      const [row] = await db
        .delete(accounts)
        .where(and(eq(accounts.id, request.params.id), eq(accounts.userId, user.sub)))
        .returning();
      if (!row) {
        reply.code(404);
        return fail("Account not found");
      }
      return ok({ id: row.id });
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 500;
      reply.code(status);
      return fail(status === 401 ? "Unauthorized" : "Failed to delete account");
    }
  });
};
