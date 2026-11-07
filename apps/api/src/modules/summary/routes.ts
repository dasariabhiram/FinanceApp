import type { FastifyPluginAsync } from "fastify";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { accounts, transactions, type Db } from "@finance/db";
import { fail, ok } from "../../lib/envelope.js";
import { requireUser } from "../../plugins/auth.js";
import { resolveOrgContext } from "../../lib/org-context.js";

type Period = "day" | "week" | "month";

function periodWindow(period: Period, d = new Date()) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  if (period === "day") {
    const start = new Date(Date.UTC(y, m, day)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(y, m, day + 1)).toISOString().slice(0, 10);
    return { start, end, period };
  }
  if (period === "week") {
    const dow = d.getUTCDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const startDate = new Date(Date.UTC(y, m, day + mondayOffset));
    const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { start: startDate.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10), period };
  }
  const start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m + 1, 1)).toISOString().slice(0, 10);
  return { start, end, period: "month" as const };
}

export const summaryRoutes: FastifyPluginAsync<{ db: Db }> = async (app, opts) => {
  const { db } = opts;

  app.get("/v1/summary", async (request, reply) => {
    try {
      const user = requireUser(request);
      const org = await resolveOrgContext(db, user, request);
      const q = request.query as { period?: string; start?: string; end?: string };
      const period: Period = q.period === "day" || q.period === "week" ? q.period : "month";
      const isoDay = /^\d{4}-\d{2}-\d{2}$/;
      const clientWindow =
        typeof q.start === "string" &&
        typeof q.end === "string" &&
        isoDay.test(q.start) &&
        isoDay.test(q.end) &&
        q.start < q.end;
      const { start, end } = clientWindow ? { start: q.start!, end: q.end! } : periodWindow(period);

      const [balanceRow, windowRow, byDay, byCategory, byPayment] = await Promise.all([
        db
          .select({
            total: sql<string>`coalesce(sum(${accounts.balanceMinor}), 0)`,
            count: sql<number>`count(*)::int`,
          })
          .from(accounts)
          .where(eq(accounts.orgId, org.orgId)),
        db
          .select({
            income: sql<string>`coalesce(sum(case when ${transactions.type} = 'INCOME' then ${transactions.amountMinor} else 0 end), 0)`,
            expense: sql<string>`coalesce(sum(case when ${transactions.type} = 'EXPENSE' then -${transactions.amountMinor} else 0 end), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.orgId, org.orgId),
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
              eq(transactions.orgId, org.orgId),
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
              eq(transactions.orgId, org.orgId),
              eq(transactions.type, "EXPENSE"),
              gte(transactions.occurredOn, start),
              lt(transactions.occurredOn, end),
            ),
          )
          .groupBy(transactions.category)
          .orderBy(sql`sum(-${transactions.amountMinor}) desc`)
          .limit(8),
        db
          .select({
            accountType: accounts.type,
            accountName: accounts.name,
            total: sql<string>`coalesce(sum(-${transactions.amountMinor}), 0)`,
          })
          .from(transactions)
          .innerJoin(accounts, eq(accounts.id, transactions.accountId))
          .where(
            and(
              eq(transactions.orgId, org.orgId),
              eq(transactions.type, "EXPENSE"),
              gte(transactions.occurredOn, start),
              lt(transactions.occurredOn, end),
            ),
          )
          .groupBy(accounts.type, accounts.name)
          .orderBy(sql`sum(-${transactions.amountMinor}) desc`),
      ]);

      return ok({
        totalBalanceMinor: (balanceRow[0]?.total ?? "0").toString(),
        periodIncomeMinor: (windowRow[0]?.income ?? "0").toString(),
        periodExpenseMinor: (windowRow[0]?.expense ?? "0").toString(),
        monthIncomeMinor: (windowRow[0]?.income ?? "0").toString(),
        monthExpenseMinor: (windowRow[0]?.expense ?? "0").toString(),
        accountCount: Number(balanceRow[0]?.count ?? 0),
        period,
        daily: byDay.map((d) => ({
          day: d.day,
          incomeMinor: d.income.toString(),
          expenseMinor: d.expense.toString(),
        })),
        categories: byCategory.map((c) => ({
          category: c.category,
          totalMinor: c.total.toString(),
        })),
        byPayment: byPayment.map((p) => ({
          accountType: p.accountType,
          accountName: p.accountName,
          totalMinor: p.total.toString(),
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
