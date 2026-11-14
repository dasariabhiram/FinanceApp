import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src/styles.css"), "utf8");
const app = readFileSync(join(root, "src/routes/CustomerApp.tsx"), "utf8");

const mobileBlocks = [...css.matchAll(/@media\s*\(max-width:\s*900px\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[0]);
const mobileCss = mobileBlocks.join("\n");
assert.ok(mobileCss.includes(".auth-"), "mobile auth rules required");

assert.doesNotMatch(
  mobileCss,
  /\.auth-panel\s*\{[^}]*margin-top:\s*-\d/,
  "auth-panel must not use negative margin-top on mobile (causes overlap)",
);
assert.match(
  mobileCss,
  /\.auth-wrap\s*\{[^}]*overflow:\s*(auto|visible)/,
  "auth-wrap must allow scroll/visible overflow on mobile so the form is reachable",
);
assert.match(
  mobileCss,
  /\.auth-panel\s*\{[^}]*order:\s*-?1/,
  "On mobile, login panel should come before the decorative hero (CSS order)",
);

assert.match(app, /tab-speak|Speak to add expense/, "Speak control present in bottom chrome");
assert.match(css, /\.bottom-tab-bar\s*\{/, "bottom tab bar required");
assert.match(css, /@keyframes\s+fab-attention/, "Speak needs idle attention animation");

console.log("mobile auth + voice layout tests ok");
