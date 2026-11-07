import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Db } from "@finance/db";
import { fail, ok } from "../../lib/envelope.js";
import { requireUser } from "../../plugins/auth.js";
import { resolveOrgContext } from "../../lib/org-context.js";
import { env } from "../../env.js";

const bodySchema = z.object({
  transcript: z.string().min(1).max(2000),
});

const categories = [
  "Food & Dining",
  "Shopping",
  "Housing",
  "Transport",
  "Entertainment",
  "Health",
  "Utilities",
  "Other",
];

async function geminiParse(transcript: string) {
  if (!env.GEMINI_API_KEY) return null;
  const prompt = `Parse this voice expense (INR India). Return JSON only with keys: amountMinor (string integer paise), category (one of ${categories.join(", ")}), accountHint (cash|upi|card name or null), description (short), occurredOn (YYYY-MM-DD or null), confidence (high|low). Transcript: ${transcript}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const voiceRoutes: FastifyPluginAsync<{ db: Db }> = async (app, opts) => {
  const { db } = opts;

  app.post("/v1/voice/parse-expense", async (request, reply) => {
    try {
      const user = requireUser(request);
      await resolveOrgContext(db, user, request);
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return fail(parsed.error.issues[0]?.message ?? "Invalid body");
      }
      const gemini = await geminiParse(parsed.data.transcript);
      if (!gemini) {
        reply.code(503);
        return fail("AI parser unavailable");
      }
      return ok({
        amountMinor: typeof gemini.amountMinor === "string" ? gemini.amountMinor : null,
        category: typeof gemini.category === "string" ? gemini.category : null,
        accountHint: typeof gemini.accountHint === "string" ? gemini.accountHint : null,
        description: typeof gemini.description === "string" ? gemini.description : null,
        occurredOn: typeof gemini.occurredOn === "string" ? gemini.occurredOn : null,
        confidence: gemini.confidence === "high" ? "high" : "low",
      });
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 500;
      reply.code(status);
      return fail(status === 401 ? "Unauthorized" : "Parse failed");
    }
  });
};
