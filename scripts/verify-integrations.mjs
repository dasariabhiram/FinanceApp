#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const postgres = require(resolve(root, "packages/db/node_modules/postgres"));

const envText = readFileSync(resolve(root, ".env"), "utf8");
const pick = (key) => envText.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim().replace(/^["']|["']$/g, "");

const apiUrl = process.env.API_URL ?? "http://localhost:3001";
let dbUrl = pick("DATABASE_URL") ?? "";
if (dbUrl && !dbUrl.includes("sslmode=")) dbUrl += dbUrl.includes("?") ? "&sslmode=require" : "?sslmode=require";

const report = { ok: true, checks: {} };

if (dbUrl) {
  const sql = postgres(dbUrl, { max: 1, prepare: false, connect_timeout: 20, ssl: "require" });
  try {
    await sql`select 1`;
    const org = await sql`
      select exists (
        select 1 from information_schema.tables
        where table_schema = 'app' and table_name = 'organizations'
      ) as present
    `;
    report.checks.database = { ok: true, multitenant: Boolean(org[0]?.present) };
    await sql.end({ timeout: 5 });
  } catch (e) {
    report.ok = false;
    report.checks.database = { ok: false, error: e instanceof Error ? e.message : String(e) };
    try { await sql.end({ timeout: 2 }); } catch {}
  }
}

const supabaseUrl = pick("SUPABASE_URL");
if (supabaseUrl) {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`, { signal: AbortSignal.timeout(8000) });
    report.checks.supabaseAuth = { ok: res.ok };
    if (!res.ok) report.ok = false;
  } catch (e) {
    report.ok = false;
    report.checks.supabaseAuth = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

try {
  const health = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(5000) });
  const integrations = await fetch(`${apiUrl}/health/integrations`, { signal: AbortSignal.timeout(10000) });
  report.checks.apiHealth = { ok: health.ok };
  report.checks.apiIntegrations = { ok: integrations.ok };
  if (!health.ok) report.ok = false;
} catch {
  report.checks.apiHealth = { ok: false, hint: "Run: pnpm dev:api" };
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
