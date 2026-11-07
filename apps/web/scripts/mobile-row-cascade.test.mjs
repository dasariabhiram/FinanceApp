import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/styles.css"), "utf8");

const baseIdx = css.search(/\.row\s*\{[^}]*align-items:\s*end/);
assert.ok(baseIdx >= 0, "base .row with align-items:end expected");

const mobileIdx = css.search(/Mobile form stack[\s\S]*?@media\s*\(max-width:\s*980px\)\s*\{[\s\S]*?\.row\s*\{[\s\S]*?align-items:\s*stretch/);
assert.ok(mobileIdx >= 0, "mobile .row stretch override missing");
assert.ok(mobileIdx > baseIdx, "mobile .row stretch MUST come after base align-items:end (cascade bug)");

const mobileBlock = css.slice(mobileIdx, mobileIdx + 800);
assert.match(mobileBlock, /width:\s*100%/, "fields must force full width on mobile");
assert.match(mobileBlock, /min-width:\s*0/, "min-width 0 prevents flex overflow/shift");
assert.doesNotMatch(
  css.slice(mobileIdx),
  /@media\s*\(max-width:\s*980px\)\s*\{[^}]*align-items:\s*end/,
  "no later mobile rule may reintroduce align-items:end on .row",
);

console.log("mobile row cascade tests ok");
