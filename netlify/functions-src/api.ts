/**
 * Netlify Functions adapter (classic Lambda `handler` export).
 * Same Fastify app as local `apps/api`, mounted at /api/* via redirects.
 */
import { buildApp } from "../../apps/api/src/app.js";
import type { FastifyInstance } from "fastify";

type NetlifyEvent = {
  httpMethod?: string;
  method?: string;
  path?: string;
  rawUrl?: string;
  rawQuery?: string;
  headers?: Record<string, string | undefined>;
  multiValueHeaders?: Record<string, string[] | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
  body?: string | null;
  isBase64Encoded?: boolean;
};

type NetlifyResult = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
};

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

function jsonBody(status: number, message: string, detail?: string): NetlifyResult {
  return {
    statusCode: status,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      success: false,
      data: null,
      error: message,
      detail: detail ?? null,
    }),
  };
}

function stripApiPrefix(pathname: string): string {
  let path = pathname;
  if (path.startsWith("/.netlify/functions/api")) {
    path = path.slice("/.netlify/functions/api".length) || "/";
  } else if (path.startsWith("/api")) {
    path = path.slice("/api".length) || "/";
  }
  if (!path.startsWith("/")) path = `/${path}`;
  return path;
}

function eventPath(event: NetlifyEvent): { path: string; search: string } {
  if (event.rawUrl) {
    try {
      const url = new URL(event.rawUrl);
      return { path: stripApiPrefix(url.pathname), search: url.search };
    } catch {
      /* fall through */
    }
  }

  let path = stripApiPrefix(event.path || "/");
  const qs = event.rawQuery
    ? `?${event.rawQuery.replace(/^\?/, "")}`
    : event.queryStringParameters
      ? `?${new URLSearchParams(
          Object.entries(event.queryStringParameters).filter(
            (e): e is [string, string] => e[1] != null,
          ),
        ).toString()}`
      : "";
  return { path, search: qs === "?" ? "" : qs };
}

function eventHeaders(event: NetlifyEvent): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(event.headers || {})) {
    if (value != null) headers[key.toLowerCase()] = value;
  }
  return headers;
}

function eventBody(event: NetlifyEvent): string | undefined {
  if (event.body == null) return undefined;
  if (event.isBase64Encoded) {
    return Buffer.from(event.body, "base64").toString("utf8");
  }
  return event.body;
}

export async function handler(event: NetlifyEvent): Promise<NetlifyResult> {
  let app: FastifyInstance;
  try {
    app = await getApp();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("finance-api boot failed", err);
    return jsonBody(500, "API failed to start", detail);
  }

  try {
    const method = (event.httpMethod || event.method || "GET").toUpperCase();
    const { path, search } = eventPath(event);
    const headers = eventHeaders(event);
    const payload = method === "GET" || method === "HEAD" ? undefined : eventBody(event);

    const res = await app.inject({
      method,
      url: `${path}${search}`,
      headers,
      payload,
    });

    const outHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(res.headers)) {
      if (value == null) continue;
      outHeaders[key] = Array.isArray(value) ? value.join(", ") : String(value);
    }

    return {
      statusCode: res.statusCode,
      headers: outHeaders,
      body: typeof res.body === "string" ? res.body : JSON.stringify(res.body),
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("finance-api request failed", err);
    return jsonBody(500, "API request failed", detail);
  }
}

// Alias for any runtime that looks for default export
export default handler;
