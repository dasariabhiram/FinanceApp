/**
 * Netlify Functions adapter: same Fastify app as local `apps/api`, mounted at /api/*.
 * Types are minimal so we don't require @netlify/functions at install time;
 * Netlify bundles this file on deploy.
 */
import { buildApp } from "../../apps/api/src/app.js";
import type { FastifyInstance } from "fastify";

type NetlifyConfig = { path: string | string[] };

let appPromise: Promise<FastifyInstance> | null = null;

function getApp() {
  if (!appPromise) {
    appPromise = buildApp()
      .then(async (app) => {
        await app.ready();
        return app;
      })
      .catch((err) => {
        appPromise = null;
        throw err;
      });
  }
  return appPromise;
}

export default async (req: Request) => {
  const app = await getApp();
  const url = new URL(req.url);
  // Function is mounted at /api/* — strip prefix so Fastify routes stay /health, /v1/...
  const path = url.pathname.replace(/^\/api/, "") || "/";

  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const method = req.method.toUpperCase();
  const payload = method === "GET" || method === "HEAD" ? undefined : await req.text();

  const res = await app.inject({
    method,
    url: `${path}${url.search}`,
    headers,
    payload,
  });

  const resHeaders = new Headers();
  for (const [key, value] of Object.entries(res.headers)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) resHeaders.append(key, String(item));
    } else {
      resHeaders.set(key, String(value));
    }
  }

  return new Response(res.body, {
    status: res.statusCode,
    headers: resHeaders,
  });
};

export const config: NetlifyConfig = {
  path: ["/api", "/api/*"],
};
