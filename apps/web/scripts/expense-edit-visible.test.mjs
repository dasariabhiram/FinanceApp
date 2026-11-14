import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const app = readFileSync(join(root, "apps/web/src/routes/CustomerApp.tsx"), "utf8");
const css = readFileSync(join(root, "apps/web/src/styles.css"), "utf8");

// Dashboard Recent must expose Edit (users land on Home by default).
const recentIdx = app.indexOf("Recent");
assert.ok(recentIdx > 0, "Recent section exists");
const afterRecent = app.slice(recentIdx, recentIdx + 1800);
assert.match(
  afterRecent,
  /recentExpenses\.map[\s\S]*startEditTx[\s\S]*aria-label=\{[^}]*Edit expense/,
  "dashboard Recent rows must call startEditTx with Edit expense label",
);

// Editing from anywhere must surface the Quick add form (transactions tab).
assert.match(
  app,
  /function startEditTx[\s\S]{0,400}setTabAndUrl\(["']transactions["']\)/,
  "startEditTx must switch to transactions tab so edit form is visible",
);

// Compact history rows: cat + meta + badge + Edit + Delete = 5 columns.
assert.match(
  css,
  /\.tx-item-compact\s*\{\s*grid-template-columns:\s*[^}]*auto\s+auto\s+auto/,
  "tx-item-compact must reserve three trailing auto columns for badge/Edit/Delete",
);

console.log("expense edit visibility tests ok");
