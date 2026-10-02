import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../env.js";

export type AuthUser = {
  sub: string;
  email?: string;
  role?: string;
};

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

const jwks = createRemoteJWKSet(
  new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
);

const authPluginImpl: FastifyPluginAsync = async (app) => {
  app.decorateRequest("user", null);

  app.addHook("preHandler", async (request: FastifyRequest) => {
    request.user = null;
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return;

    const token = header.slice("Bearer ".length);
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: `${env.SUPABASE_URL}/auth/v1`,
        audience: "authenticated",
      });
      if (typeof payload.sub !== "string") return;
      request.user = {
        sub: payload.sub,
        email: typeof payload.email === "string" ? payload.email : undefined,
        role: typeof payload.role === "string" ? payload.role : "authenticated",
      };
    } catch (err) {
      request.log.warn({ err }, "jwt verify failed");
      request.user = null;
    }
  });
};

// Break encapsulation so the hook applies to all routes
export const authPlugin = fp(authPluginImpl, { name: "auth-plugin" });

export function requireUser(request: FastifyRequest): AuthUser {
  if (!request.user) {
    const err = new Error("Unauthorized");
    (err as Error & { statusCode?: number }).statusCode = 401;
    throw err;
  }
  return request.user;
}
