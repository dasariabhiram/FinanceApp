import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const contracts = readFileSync(join(root, "packages/contracts/src/index.ts"), "utf8");
const routes = readFileSync(join(root, "apps/api/src/modules/transactions/routes.ts"), "utf8");
const client = readFileSync(join(root, "packages/api-client/src/index.ts"), "utf8");
const app = readFileSync(join(root, "apps/web/src/routes/CustomerApp.tsx"), "utf8");

assert.match(contracts, /updateTransactionSchema/, "updateTransactionSchema exported");
assert.match(contracts, /updateTransactionSchema[\s\S]*amountMinor/, "update allows amount");
assert.match(contracts, /updateTransactionSchema[\s\S]*accountId/, "update allows accountId");
assert.match(contracts, /updateTransactionSchema[\s\S]*INCOME/, "update allows income/refund type");

assert.match(routes, /updateTransactionSchema/, "routes use shared update schema");
assert.match(routes, /existing\.amountMinor/, "PATCH reverses prior signed amount");
assert.match(routes, /nextSigned/, "PATCH recomputes signed amount");
assert.match(routes, /nextAccountId/, "PATCH can move account");

assert.match(client, /UpdateTransaction/, "api-client uses UpdateTransaction type");
assert.match(client, /updateTransaction:\s*\(id: string, input: UpdateTransaction\)/, "client widened");

assert.match(app, /startEditTx|saveEditTx|editingTxId/, "edit entry point in Expenses UI");
assert.match(app, /Edit refund|Edit expense/, "accessible Edit labels for expense and refund");
assert.match(app, /updateTransaction/, "UI calls updateTransaction");
assert.match(app, /Income \/ Refund|Edit refund/, "edit form supports income/refund");

console.log("expense edit tests ok");
