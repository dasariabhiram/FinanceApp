import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema.js";

export * from "./schema.js";

export type Db = ReturnType<typeof createDb>;

export type CreateDbOptions = {
  /** Keep at 1 on serverless (Netlify Functions) to avoid pool exhaustion */
  max?: number;
};

export function createDb(connectionString: string, options: CreateDbOptions = {}) {
  const client = postgres(connectionString, {
    prepare: false,
    max: options.max ?? 8,
    idle_timeout: 20,
    connect_timeout: 10,
    // Prefer shorter waits over hanging the UI
    connection: {
      application_name: "finance-api",
    },
  });
  return drizzle(client, { schema });
}

/**
 * Optional RLS-aware transaction (for scripts / strict mode).
 * Hot API path should filter by verified userId instead — set_config + txn
 * adds ~1 RTT to Singapore on every request.
 */
export async function withUser<T>(
  db: Db,
  claims: { sub: string; role?: string; email?: string },
  fn: (tx: Parameters<Parameters<Db["transaction"]>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      select
        set_config('request.jwt.claims', ${JSON.stringify(claims)}, true),
        set_config('role', 'authenticated', true)
    `);
    return fn(tx);
  });
}
