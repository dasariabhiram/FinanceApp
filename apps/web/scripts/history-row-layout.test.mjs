import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const app = readFileSync(join(root, "apps/web/src/routes/CustomerApp.tsx"), "utf8");
const css = readFileSync(join(root, "apps/web/src/styles.css"), "utf8");

// Category + payment label must share one primary cell (not separate fr columns that crush each other).
assert.match(
  app,
  /tx-item-compact[\s\S]{0,400}tx-item-main[\s\S]{0,200}className="cat"[\s\S]{0,300}payment-pill/,
  "compact rows stack category + payment in tx-item-main",
);

// Compact grid is 3 tracks: main | amount | actions — never cat|meta as competing fr columns.
assert.match(
  css,
  /\.tx-item-compact\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+auto/s,
  "tx-item-compact uses main|badge|actions columns",
);
assert.doesNotMatch(
  css,
  /\.tx-item-compact\s*\{[^}]*1\.2fr\)\s+minmax\(0,\s*1fr\)/s,
  "tx-item-compact must not put category and meta in adjacent fr columns",
);

console.log("history row layout tests ok");
