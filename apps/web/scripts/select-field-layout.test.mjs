import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/styles.css"),
  "utf8",
);

const selectRule = css.match(/\.field\s+select\s*\{[^}]+\}/)?.[0] ?? "";
assert.ok(selectRule, "Dedicated .field select { ... } rule required for dropdown alignment");

assert.match(
  selectRule,
  /appearance:\s*none|-webkit-appearance:\s*none/,
  "Native select chrome must be reset (appearance:none) so text/chevron can align",
);
assert.match(
  selectRule,
  /background-image:/,
  "Custom chevron required after appearance:none",
);
assert.match(
  selectRule,
  /padding-right:/,
  "Extra right padding required so text does not collide with chevron",
);

const shared = css.match(/\.field input, \.field select, \.field textarea\s*\{[^}]+\}/)?.[0] ?? "";
assert.match(shared, /min-height:/, "Shared field controls need min-height for vertical centering");
assert.match(shared, /line-height:/, "Shared field controls need line-height for vertical centering");

console.log("select field layout tests ok");
