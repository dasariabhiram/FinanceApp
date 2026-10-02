import type { FastifyPluginAsync } from "fastify";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { accounts, transactions, type Db } from "@finance/db";
import { fail, ok } from "../../lib/envelope.js";
import { requireUser } from "../../plugins/auth.js";

function monthWindow(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m + 1, 1)).toISOString().slice(0, 10);
  return { start, end };
}

export const summaryRoutes: FastifyPluginAsync<{ db: Db }> = async (app, opts) => {
  const { db } = opts;

  app.get("/v1/summary", async (request, reply) => {
    try {
      const user = requireUser(request);
      const { start, end } = monthWindow();

      const [balanceRow, monthRow, byDay, byCategory] = await Promise.all([
        db
          .select({
            total: sql<string>`coalesce(sum(${accounts.balanceMinor}), 0)`,
            count: sql<number>`count(*)::int`,
          })
          .from(accounts)
          .where(eq(accounts.userId, user.sub)),
        db
          .select({
            income: sql<string>`coalesce(sum(case when ${transactions.type} = 'INCOME' then ${transactions.amountMinor} else 0 end), 0)`,
            expense: sql<string>`coalesce(sum(case when ${transactions.type} = 'EXPENSE' then -${transactions.amountMinor} else 0 end), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, user.sub),
              gte(transactions.occurredOn, start),
              lt(transactions.occurredOn, end),
            ),
          ),
        db
          .select({
            day: transactions.occurredOn,
            income: sql<string>`coalesce(sum(case when ${transactions.type} = 'INCOME' then ${transactions.amountMinor} else 0 end), 0)`,
            expense: sql<string>`coalesce(sum(case when ${transactions.type} = 'EXPENSE' then -${transactions.amountMinor} else 0 end), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, user.sub),
              gte(transactions.occurredOn, start),
              lt(transactions.occurredOn, end),
            ),
          )
          .groupBy(transactions.occurredOn)
          .orderBy(transactions.occurredOn),
        db
          .select({
            category: transactions.category,
            total: sql<string>`coalesce(sum(-${transactions.amountMinor}), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, user.sub),
              eq(transactions.type, "EXPENSE"),
              gte(transactions.occurredOn, start),
              lt(transactions.occurredOn, end),
            ),
          )
          .groupBy(transactions.category)
          .orderBy(sql`sum(-${transactions.amountMinor}) desc`)
          .limit(8),
      ]);

      return ok({
        totalBalanceMinor: (balanceRow[0]?.total ?? "0").toString(),
        monthIncomeMinor: (monthRow[0]?.income ?? "0").toString(),
        monthExpenseMinor: (monthRow[0]?.expense ?? "0").toString(),
        accountCount: Number(balanceRow[0]?.count ?? 0),
        daily: byDay.map((d) => ({
          day: d.day,
          incomeMinor: d.income.toString(),
          expenseMinor: d.expense.toString(),
        })),
        categories: byCategory.map((c) => ({
          category: c.category,
          totalMinor: c.total.toString(),
        })),
        periodStart: start,
        periodEnd: end,
      });
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 500;
      reply.code(status);
      return fail(status === 401 ? "Unauthorized" : "Failed to load summary");
    }
  });
};
