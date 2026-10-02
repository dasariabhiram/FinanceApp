import type { FastifyPluginAsync } from "fastify";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createTransactionSchema } from "@finance/contracts";
import { accounts, transactions, type Db } from "@finance/db";
import { fail, ok } from "../../lib/envelope.js";
import { requireUser } from "../../plugins/auth.js";

const updateTxSchema = z.object({
  category: z.string().min(1).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function mapTx(r: typeof transactions.$inferSelect) {
  return {
    id: r.id,
    accountId: r.accountId,
    type: r.type,
    amountMinor: r.amountMinor.toString(),
    category: r.category,
    description: r.description,
    occurredOn: r.occurredOn,
    status: r.status as "POSTED" | "PENDING_REVIEW",
    createdAt: r.createdAt.toISOString(),
  };
}

export const transactionsRoutes: FastifyPluginAsync<{ db: Db }> = async (app, opts) => {
  const { db } = opts;

  app.get("/v1/transactions", async (request, reply) => {
    try {
      const user = requireUser(request);
      const q = request.query as { accountId?: string; type?: string; search?: string };
      const conditions = [eq(transactions.userId, user.sub)];
      if (typeof q.accountId === "string" && q.accountId) {
        conditions.push(eq(transactions.accountId, q.accountId));
      }
      if (q.type === "INCOME" || q.type === "EXPENSE") {
        conditions.push(eq(transactions.type, q.type));
      }
      if (typeof q.search === "string" && q.search.trim()) {
        const s = `%${q.search.trim()}%`;
        conditions.push(
          sql`(${transactions.category} ilike ${s} or coalesce(${transactions.description}, '') ilike ${s})`,
        );
      }

      const rows = await db
        .select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
        .limit(100);

      return ok(rows.map(mapTx));
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 500;
      reply.code(status);
      return fail(status === 401 ? "Unauthorized" : "Failed to list transactions");
    }
  });

  app.post("/v1/transactions", async (request, reply) => {
    try {
      const user = requireUser(request);
      const parsed = createTransactionSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return fail(parsed.error.issues[0]?.message ?? "Invalid body");
      }
      const input = parsed.data;
      const amount = BigInt(input.amountMinor);
      if (amount <= 0n) {
        reply.code(400);
        return fail("amountMinor must be positive");
      }
      const signed = input.type === "EXPENSE" ? -amount : amount;

      const row = await db.transaction(async (tx) => {
        const [account] = await tx
          .select({ id: accounts.id })
          .from(accounts)
          .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, user.sub)))
          .limit(1);
        if (!account) {
          const err = new Error("Account not found");
          (err as Error & { statusCode?: number }).statusCode = 404;
          throw err;
        }

        const [existing] = await tx
          .select()
          .from(transactions)
          .where(and(eq(transactions.userId, user.sub), eq(transactions.idempotencyKey, input.idempotencyKey)))
          .limit(1);
        if (existing) return existing;

        const [created] = await tx
          .insert(transactions)
          .values({
            userId: user.sub,
            accountId: input.accountId,
            type: input.type,
            amountMinor: signed,
            category: input.category,
            description: input.description ?? null,
            occurredOn: input.occurredOn,
            idempotencyKey: input.idempotencyKey,
            status: "POSTED",
          })
          .returning();

        await tx
          .update(accounts)
          .set({ balanceMinor: sql`${accounts.balanceMinor} + ${signed}` })
          .where(eq(accounts.id, input.accountId));

        return created!;
      });

      reply.code(201);
      return ok(mapTx(row));
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 500;
      reply.code(status);
      return fail(
        status === 401 ? "Unauthorized" : status === 404 ? "Account not found" : "Failed to create transaction",
      );
    }
  });

  app.patch<{ Params: { id: string } }>("/v1/transactions/:id", async (request, reply) => {
    try {
      const user = requireUser(request);
      const parsed = updateTxSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return fail(parsed.error.issues[0]?.message ?? "Invalid body");
      }
      const input = parsed.data;
      const [row] = await db
        .update(transactions)
        .set({
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.occurredOn !== undefined ? { occurredOn: input.occurredOn } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(transactions.id, request.params.id), eq(transactions.userId, user.sub)))
        .returning();
      if (!row) {
        reply.code(404);
        return fail("Not found");
      }
      return ok(mapTx(row));
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 500;
      reply.code(status);
      return fail(status === 401 ? "Unauthorized" : "Failed to update transaction");
    }
  });

  app.delete<{ Params: { id: string } }>("/v1/transactions/:id", async (request, reply) => {
    try {
      const user = requireUser(request);
      await db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(transactions)
          .where(and(eq(transactions.id, request.params.id), eq(transactions.userId, user.sub)))
          .limit(1);
        if (!row) {
          const err = new Error("Not found");
          (err as Error & { statusCode?: number }).statusCode = 404;
          throw err;
        }
        await tx.delete(transactions).where(eq(transactions.id, row.id));
        await tx
          .update(accounts)
          .set({ balanceMinor: sql`${accounts.balanceMinor} - ${row.amountMinor}` })
          .where(eq(accounts.id, row.accountId));
      });
      return ok({ id: request.params.id });
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 500;
      reply.code(status);
      return fail(status === 401 ? "Unauthorized" : status === 404 ? "Not found" : "Failed to delete");
    }
  });
};
