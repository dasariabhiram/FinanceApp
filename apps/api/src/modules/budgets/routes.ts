import type { FastifyPluginAsync } from "fastify";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { budgets, transactions, type Db } from "@finance/db";
import { fail, ok } from "../../lib/envelope.js";
import { requireUser } from "../../plugins/auth.js";

const upsertSchema = z.object({
  amountMinor: z.string().regex(/^\d+$/),
});

function monthWindow(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m + 1, 1)).toISOString().slice(0, 10);
  return { start, end };
}

export const budgetsRoutes: FastifyPluginAsync<{ db: Db }> = async (app, opts) => {
  const { db } = opts;

  app.get("/v1/budgets/current", async (request, reply) => {
    try {
      const user = requireUser(request);
      const { start, end } = monthWindow();

      const [[budget], [spent]] = await Promise.all([
        db.select().from(budgets).where(eq(budgets.userId, user.sub)).limit(1),
        db
          .select({
            total: sql<string>`coalesce(sum(case when ${transactions.amountMinor} < 0 then -${transactions.amountMinor} else 0 end), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, user.sub),
              eq(transactions.type, "EXPENSE"),
              gte(transactions.occurredOn, start),
              lt(transactions.occurredOn, end),
            ),
          ),
      ]);

      const spentMinor = (spent?.total ?? "0").toString();
      const amount = budget?.amountMinor ?? null;
      const percentUsed =
        amount && amount > 0n ? Number((BigInt(spentMinor) * 10000n) / amount) / 100 : 0;

      return ok({
        amountMinor: amount?.toString() ?? null,
        spentMinor,
        periodStart: start,
        periodEnd: end,
        percentUsed,
      });
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 500;
      reply.code(status);
      return fail(status === 401 ? "Unauthorized" : "Failed to load budget");
    }
  });

  app.put("/v1/budgets/current", async (request, reply) => {
    try {
      const user = requireUser(request);
      const parsed = upsertSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return fail(parsed.error.issues[0]?.message ?? "Invalid body");
      }
      const amount = BigInt(parsed.data.amountMinor);
      const [row] = await db
        .insert(budgets)
        .values({ userId: user.sub, amountMinor: amount })
        .onConflictDoUpdate({
          target: budgets.userId,
          set: { amountMinor: amount, updatedAt: new Date() },
        })
        .returning();
      return ok({ amountMinor: row!.amountMinor.toString() });
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 500;
      reply.code(status);
      return fail(status === 401 ? "Unauthorized" : "Failed to save budget");
    }
  });
};
