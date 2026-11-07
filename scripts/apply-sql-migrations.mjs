#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const postgres = require(resolve(root, "packages/db/node_modules/postgres"));

const envText = readFileSync(resolve(root, ".env"), "utf8");
const pick = (key) => {
  const m = envText.match(new RegExp(`^${key}=(.+)$`, "m"));
  return m?.[1]?.trim().replace(/^["']|["']$/g, "");
};

const directUrl = pick("DIRECT_URL") || pick("DATABASE_URL");
if (!directUrl) {
  console.error("Missing DIRECT_URL or DATABASE_URL in .env");
  process.exit(1);
}

let url = directUrl;
if (!url.includes("sslmode=")) {
  url += url.includes("?") ? "&sslmode=require" : "?sslmode=require";
}

const migDir = resolve(root, "supabase/migrations");
const files = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 30, ssl: "require" });

const existing = await sql`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'app' and table_name = 'organizations'
    ) as multitenant
  `;
const skipInit = Boolean(existing[0]?.multitenant);

try {
  for (const file of files) {
    if (skipInit && file.startsWith("20260502000000")) {
      console.log(`Skipping ${file} (app schema already provisioned)`);
      continue;
    }
    const body = readFileSync(resolve(migDir, file), "utf8");
    process.stdout.write(`Applying ${file}... `);
    await sql.unsafe(body);
    console.log("ok");
  }
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'app' order by table_name
  `;
  console.log("app tables:", tables.map((t) => t.table_name).join(", "));
} catch (e) {
  console.error("\nMigration failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
