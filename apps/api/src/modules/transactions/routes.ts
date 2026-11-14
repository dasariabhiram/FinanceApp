import type { FastifyPluginAsync } from "fastify";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { createTransactionSchema, updateTransactionSchema } from "@finance/contracts";
import { accounts, transactions, type Db } from "@finance/db";
import { fail, ok } from "../../lib/envelope.js";
import { requireUser } from "../../plugins/auth.js";
import { resolveOrgContext } from "../../lib/org-context.js";
import { balanceDeltasForUpdate, toSignedMinor } from "./tx-amount.js";


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
      const org = await resolveOrgContext(db, user, request);
      const q = request.query as {
        accountId?: string;
        type?: string;
        search?: string;
        from?: string;
        to?: string;
        limit?: string;
      };
      const isoDay = /^\d{4}-\d{2}-\d{2}$/;
      const conditions = [eq(transactions.orgId, org.orgId)];
      if (typeof q.accountId === "string" && q.accountId) {
        conditions.push(eq(transactions.accountId, q.accountId));
      }
      if (q.type === "INCOME" || q.type === "EXPENSE") {
        conditions.push(eq(transactions.type, q.type));
      }
      if (typeof q.from === "string" && isoDay.test(q.from)) {
        conditions.push(gte(transactions.occurredOn, q.from));
      }
      if (typeof q.to === "string" && isoDay.test(q.to)) {
        conditions.push(lt(transactions.occurredOn, q.to));
      }
      if (typeof q.search === "string" && q.search.trim()) {
        const s = `%${q.search.trim()}%`;
        conditions.push(
          sql`(${transactions.category} ilike ${s} or coalesce(${transactions.description}, '') ilike ${s})`,
        );
      }

      const limitRaw = Number(q.limit ?? "500");
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 2000) : 500;

      const rows = await db
        .select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
        .limit(limit);

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
      const org = await resolveOrgContext(db, user, request, { requireWritable: true });
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
      let signed: bigint;
      try {
        signed = toSignedMinor(input.type, amount);
      } catch {
        reply.code(400);
        return fail("amountMinor must be positive");
      }

      const row = await db.transaction(async (tx) => {
        const [account] = await tx
          .select({ id: accounts.id })
          .from(accounts)
          .where(and(eq(accounts.id, input.accountId), eq(accounts.orgId, org.orgId)))
          .limit(1);
        if (!account) {
          const err = new Error("Account not found");
          (err as Error & { statusCode?: number }).statusCode = 404;
          throw err;
        }

        const [existing] = await tx
          .select()
          .from(transactions)
          .where(and(eq(transactions.orgId, org.orgId), eq(transactions.idempotencyKey, input.idempotencyKey)))
          .limit(1);
        if (existing) return existing;

        const [created] = await tx
          .insert(transactions)
          .values({
            orgId: org.orgId,
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
      const org = await resolveOrgContext(db, user, request, { requireWritable: true });
      const parsed = updateTransactionSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return fail(parsed.error.issues[0]?.message ?? "Invalid body");
      }
      const input = parsed.data;

      const row = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(transactions)
          .where(and(eq(transactions.id, request.params.id), eq(transactions.orgId, org.orgId)))
          .limit(1);
        if (!existing) {
          const err = new Error("Not found");
          (err as Error & { statusCode?: number }).statusCode = 404;
          throw err;
        }

        const nextType = input.type ?? (existing.type as "INCOME" | "EXPENSE");
        let nextSigned = existing.amountMinor;
        if (input.amountMinor !== undefined || input.type !== undefined) {
          const abs =
            input.amountMinor !== undefined
              ? BigInt(input.amountMinor.replace(/^-/, ""))
              : existing.amountMinor < 0n
                ? -existing.amountMinor
                : existing.amountMinor;
          try {
            nextSigned = toSignedMinor(nextType, abs);
          } catch {
            const err = new Error("amountMinor must be positive");
            (err as Error & { statusCode?: number }).statusCode = 400;
            throw err;
          }
        }

        const nextAccountId = input.accountId ?? existing.accountId;
        if (input.accountId) {
          const [account] = await tx
            .select({ id: accounts.id })
            .from(accounts)
            .where(and(eq(accounts.id, nextAccountId), eq(accounts.orgId, org.orgId)))
            .limit(1);
          if (!account) {
            const err = new Error("Account not found");
            (err as Error & { statusCode?: number }).statusCode = 404;
            throw err;
          }
        }

        const deltas = balanceDeltasForUpdate(
          { accountId: existing.accountId, signedMinor: existing.amountMinor },
          { accountId: nextAccountId, signedMinor: nextSigned },
        );
        for (const [accountId, delta] of deltas) {
          if (delta === 0n) continue;
          await tx
            .update(accounts)
            .set({ balanceMinor: sql`${accounts.balanceMinor} + ${delta}` })
            .where(eq(accounts.id, accountId));
        }

        const [updated] = await tx
          .update(transactions)
          .set({
            accountId: nextAccountId,
            type: nextType,
            amountMinor: nextSigned,
            ...(input.category !== undefined ? { category: input.category } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.occurredOn !== undefined ? { occurredOn: input.occurredOn } : {}),
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, existing.id))
          .returning();

        return updated!;
      });

      return ok(mapTx(row));
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 500;
      reply.code(status);
      const msg = e instanceof Error ? e.message : "Failed to update transaction";
      return fail(
        status === 401
          ? "Unauthorized"
          : status === 404
            ? msg === "Account not found"
              ? "Account not found"
              : "Not found"
            : status === 400
              ? msg
              : "Failed to update transaction",
      );
    }
  });

  app.delete<{ Params: { id: string } }>("/v1/transactions/:id", async (request, reply) => {
    try {
      const user = requireUser(request);
      const org = await resolveOrgContext(db, user, request, { requireWritable: true });
      await db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(transactions)
          .where(and(eq(transactions.id, request.params.id), eq(transactions.orgId, org.orgId)))
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
