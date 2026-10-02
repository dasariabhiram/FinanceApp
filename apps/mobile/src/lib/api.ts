import { createApiClient } from "@finance/api-client";
import { supabase } from "./supabase";

/** Absolute URL required on device. Prod: https://YOUR_SITE.netlify.app/api */
const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export const api = createApiClient({
  baseUrl,
  getAccessToken: async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
});
