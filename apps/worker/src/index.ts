import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });
config();

console.log("[worker] stub running — jobs (recurring, alerts, OCR) deferred until Gemini/Resend");
console.log("[worker] DIRECT_URL set:", Boolean(process.env.DIRECT_URL));

setInterval(() => {
  // placeholder heartbeat
}, 60_000);
