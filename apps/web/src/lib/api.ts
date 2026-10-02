import { createApiClient } from "@finance/api-client";
import { supabase } from "./supabase";

/** Same-origin `/api` on Netlify; Vite proxies `/api` → local Fastify in dev */
const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

/** In-memory access token — avoids slow getSession() on every request */
let cachedToken: string | null = null;

export function setAccessToken(token: string | null) {
  cachedToken = token;
}

if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    cachedToken = data.session?.access_token ?? null;
  });
  supabase.auth.onAuthStateChange((_e, session) => {
    cachedToken = session?.access_token ?? null;
  });
}

export const api = createApiClient({
  baseUrl,
  getAccessToken: async () => {
    if (cachedToken) return cachedToken;
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    cachedToken = data.session?.access_token ?? null;
    return cachedToken;
  },
});
