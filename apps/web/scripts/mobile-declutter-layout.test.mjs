import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src/styles.css"), "utf8");
const app = readFileSync(join(root, "src/routes/CustomerApp.tsx"), "utf8");
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
assert.match(css, /\.bottom-tab-bar\s*\{/, "bottom tab bar clears thumb zone");
assert.match(app, /className="bottom-tab-bar"/, "bottom tab bar markup");
assert.doesNotMatch(app, /className="pwa-banner"/, "no floating install banner");
assert.match(app, /overflow-menu|Open menu/, "secondary actions in overflow menu");

console.log("mobile declutter layout tests ok");
