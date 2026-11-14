import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const app = readFileSync(join(root, "apps/web/src/routes/CustomerApp.tsx"), "utf8");
const css = readFileSync(join(root, "apps/web/src/styles.css"), "utf8");

// Edit/Quick-add form must use an explicit full-width stack (not desktop .row flex).
assert.match(
  app,
  /editingTxId \? saveEditTx : createTx[\s\S]{0,80}className="form-stack"|className="form-stack"[\s\S]{0,80}editingTxId \? saveEditTx : createTx/,
  "tx create/edit form must use form-stack class",
);
assert.match(
  css,
  /\.form-stack\s*\{[^}]*flex-direction:\s*column/,
  "form-stack is a column layout",
);
assert.match(
  css,
  /\.form-stack[\s\S]{0,200}min-width:\s*0/,
  "form-stack prevents flex/grid min-content blowout",
);

// History action buttons must share one grid cell so compact rows stay 4 tracks.
assert.match(
  app,
  /tx-item-compact[\s\S]{0,900}tx-item-actions/,
  "compact history rows wrap Edit/Delete in tx-item-actions",
);
assert.match(
  css,
  /\.tx-item-compact\s*\{[^}]*minmax\(0/s,
  "tx-item-compact uses minmax(0,…) so fr columns can shrink",
);

assert.match(
  css,
  /\.app-shell\s*\{[^}]*overflow-x:\s*(clip|hidden)/s,
  "app-shell clips horizontal overflow from wide rows",
);

console.log("edit form layout tests ok");
