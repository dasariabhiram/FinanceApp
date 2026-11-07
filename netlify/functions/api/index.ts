/**
 * Netlify Functions adapter: same Fastify app as local `apps/api`, mounted at /api/*.
 */
import { buildApp } from "../../../apps/api/src/app.js";
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

function jsonError(status: number, message: string, detail?: string) {
  return new Response(
    JSON.stringify({
      success: false,
      data: null,
      error: message,
      detail: detail ?? null,
    }),
    {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    },
  );
}

export default async (req: Request) => {
  let app: FastifyInstance;
  try {
    app = await getApp();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("finance-api boot failed", err);
    return jsonError(500, "API failed to start", detail);
  }

  try {
    const url = new URL(req.url);
    // Accept /api/*, /.netlify/functions/api/*, or already-stripped Fastify paths.
    let path = url.pathname;
    if (path.startsWith("/.netlify/functions/api")) {
      path = path.slice("/.netlify/functions/api".length) || "/";
    } else if (path.startsWith("/api")) {
      path = path.slice("/api".length) || "/";
    }
    if (!path.startsWith("/")) path = `/${path}`;

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
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("finance-api request failed", err);
    return jsonError(500, "API request failed", detail);
  }
};

export const config: NetlifyConfig = {
  path: ["/api", "/api/*"],
};
