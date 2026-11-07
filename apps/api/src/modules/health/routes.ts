import type { FastifyPluginAsync } from "fastify";
import { sql } from "drizzle-orm";
import type { Db } from "@finance/db";
import { env } from "../../env.js";
import { ok, fail } from "../../lib/envelope.js";

export const healthRoutes: FastifyPluginAsync<{ db: Db }> = async (app, opts) => {
  const { db } = opts;

  app.get("/health", async () =>
    ok({
      status: "ok",
      service: "finance-api",
      timestamp: new Date().toISOString(),
    }),
  );

  app.get("/health/integrations", async (_request, reply) => {
    const checks: Record<string, { ok: boolean; detail?: string }> = {};

    try {
      const [row] = await db.execute(sql`select current_database() as db, current_user as usr`);
      const dbName = (row as { db?: string }).db ?? "postgres";
      checks.database = { ok: true, detail: dbName };
    } catch (e) {
      checks.database = { ok: false, detail: e instanceof Error ? e.message : "db error" };
    }

    try {
      const res = await fetch(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`, {
        signal: AbortSignal.timeout(8000),
      });
      checks.supabaseAuth = { ok: res.ok, detail: res.ok ? "jwks" : `HTTP ${res.status}` };
    } catch (e) {
      checks.supabaseAuth = { ok: false, detail: e instanceof Error ? e.message : "auth unreachable" };
    }

    try {
      const tables = await db.execute(sql`
        select count(*)::int as n from information_schema.tables
        where table_schema = 'app' and table_name = 'organizations'
      `);
      const n = Number((tables[0] as { n?: number })?.n ?? 0);
      checks.multitenantSchema = { ok: n === 1, detail: n === 1 ? "organizations present" : "run db:apply" };
    } catch (e) {
      checks.multitenantSchema = { ok: false, detail: e instanceof Error ? e.message : "schema check failed" };
    }

    const allOk = Object.values(checks).every((c) => c.ok);
    if (!allOk) reply.code(503);
    return allOk
      ? ok({ status: "ok", checks, timestamp: new Date().toISOString() })
      : { success: false as const, data: { checks }, error: "One or more integrations failed" };
  });
};
