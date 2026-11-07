import { config } from "dotenv";
import { z } from "zod";
import { resolve } from "node:path";

// Local monorepo .env; on Netlify, vars come from the site UI
try {
  config({ path: resolve(process.cwd(), "../../.env") });
  config({ path: resolve(process.cwd(), ".env") });
  config();
} catch {
  /* ignore dotenv failures in serverless */
}

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  CORS_ORIGINS: z.string().default(
    "http://localhost:5173,http://localhost:8081,https://makeyourfinance.netlify.app",
  ),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `${i.path.join(".") || "env"}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid API environment: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}

/** @deprecated Prefer getEnv() — kept for call sites */
export const env = new Proxy({} as Env, {
  get(_t, prop: string) {
    return (getEnv() as Record<string, unknown>)[prop];
  },
});
