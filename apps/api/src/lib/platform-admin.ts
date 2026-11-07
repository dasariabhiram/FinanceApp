import { eq } from "drizzle-orm";
import { platformAdmins, type Db } from "@finance/db";
import type { FastifyRequest } from "fastify";
import type { AuthUser } from "../plugins/auth.js";

export async function isPlatformAdmin(db: Db, userId: string): Promise<boolean> {
  const [row] = await db.select().from(platformAdmins).where(eq(platformAdmins.userId, userId)).limit(1);
  return Boolean(row);
}

export async function requirePlatformAdmin(db: Db, request: FastifyRequest): Promise<AuthUser> {
  const user = request.user;
  if (!user) {
    const err = new Error("Unauthorized");
    (err as Error & { statusCode?: number }).statusCode = 401;
    throw err;
  }
  const admin = await isPlatformAdmin(db, user.sub);
  if (!admin) {
    const err = new Error("Forbidden");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  return user;
}
