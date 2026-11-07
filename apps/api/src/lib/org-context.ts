import type { FastifyRequest } from "fastify";
import { and, eq } from "drizzle-orm";
import { orgMemberships, organizations, type Db } from "@finance/db";
import type { AuthUser } from "../plugins/auth.js";

export type OrgContext = {
  orgId: string;
  role: string;
  orgStatus: string;
};

export async function listMemberships(db: Db, userId: string) {
  const rows = await db
    .select({
      orgId: orgMemberships.orgId,
      role: orgMemberships.role,
      orgName: organizations.name,
      orgSlug: organizations.slug,
      orgStatus: organizations.status,
    })
    .from(orgMemberships)
    .innerJoin(organizations, eq(organizations.id, orgMemberships.orgId))
    .where(eq(orgMemberships.userId, userId));
  return rows;
}

export async function resolveOrgContext(
  db: Db,
  user: AuthUser,
  request: FastifyRequest,
  opts?: { requireWritable?: boolean },
): Promise<OrgContext> {
  const header = request.headers["x-org-id"];
  const requestedOrgId = typeof header === "string" && header ? header : undefined;
  const memberships = await listMemberships(db, user.sub);
  if (memberships.length === 0) {
    const err = new Error("No organization membership");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }

  const match = requestedOrgId
    ? memberships.find((m) => m.orgId === requestedOrgId)
    : memberships[0];
  if (!match) {
    const err = new Error("Invalid organization");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  if (opts?.requireWritable && match.orgStatus === "suspended") {
    const err = new Error("Organization suspended");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  return { orgId: match.orgId, role: match.role, orgStatus: match.orgStatus };
}
