import { config } from "dotenv";
import { z } from "zod";
import { resolve } from "node:path";

// Local monorepo .env; on Netlify, vars come from the site UI
config({ path: resolve(process.cwd(), "../../.env") });
config({ path: resolve(process.cwd(), ".env") });
config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:8081"),
});

export const env = envSchema.parse(process.env);
