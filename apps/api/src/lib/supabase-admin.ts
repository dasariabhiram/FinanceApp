import { env } from "../env.js";

type InviteResult = { ok: true } | { ok: false; error: string };

export async function inviteUserByEmail(email: string): Promise<InviteResult> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "Service role not configured" };
  }
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/invite`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
  if (res.ok || res.status === 422) {
    return { ok: true };
  }
  let detail = `Invite failed (${res.status})`;
  try {
    const body = (await res.json()) as { msg?: string; message?: string };
    detail = body.msg ?? body.message ?? detail;
  } catch {
    /* ignore */
  }
  return { ok: false, error: detail };
}
