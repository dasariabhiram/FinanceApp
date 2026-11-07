import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY missing" }), { status: 503 });
  }
  const { transcript } = (await req.json()) as { transcript?: string };
  if (!transcript) {
    return new Response(JSON.stringify({ error: "transcript required" }), { status: 400 });
  }
  const prompt = `Parse expense (INR). JSON only: amountMinor, category (${categories.join(", ")}), accountHint, description, occurredOn, confidence. Transcript: ${transcript}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) {
    return new Response(JSON.stringify({ error: "gemini failed" }), { status: 502 });
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return new Response(text, {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
