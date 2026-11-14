import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/styles.css"), "utf8");
assert.match(css, /--netlify-badge-clearance/, "badge clearance token required");
assert.match(
  css,
  /\.bottom-tab-bar\s*\{[^}]*bottom:\s*var\(--netlify-badge-clearance/,
  "tab bar must sit above Netlify badge",
);
console.log("netlify badge clearance tests ok");
