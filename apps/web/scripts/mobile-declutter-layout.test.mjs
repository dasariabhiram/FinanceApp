import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src/styles.css"), "utf8");
const mobile = [...css.matchAll(/@media\s*\(max-width:\s*(640|700|720|768|900|980)px\)\s*\{([\s\S]*?)\n\}/g)]
  .map((m) => m[0])
  .join("\n");

assert.match(
  mobile,
  /\.row\s*\{[^}]*flex-direction:\s*column/,
  "form .row fields must stack full-width on mobile",
);
assert.match(
  mobile,
  /\.grid-2\s*\{[^}]*grid-template-columns:\s*1fr\s*;/,
  "grid-2 must be single column on mobile",
);
assert.match(
  mobile,
  /\.user-chip\s+span\s*\{[^}]*display:\s*none/,
  "hide long email in mobile header to reduce cluster",
);
assert.match(
  mobile,
  /\.topbar\s+\.brand\s+p\s*\{[^}]*display:\s*none/,
  "hide brand subtitle on mobile header",
);
assert.match(
  mobile,
  /\.voice-dock\s*\{[^}]*bottom:\s*max\(2/,
  "voice-dock needs extra bottom clearance on mobile",
);
assert.match(
  mobile,
  /\.pwa-banner\s*\{[^}]*bottom:\s*calc\(8/,
  "pwa-banner must sit above the Speak control on mobile",
);

console.log("mobile declutter layout tests ok");
