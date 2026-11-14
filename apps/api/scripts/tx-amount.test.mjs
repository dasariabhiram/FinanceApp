import assert from "node:assert/strict";
import { toSignedMinor, balanceDeltasForUpdate } from "../src/modules/transactions/tx-amount.ts";

assert.equal(toSignedMinor("EXPENSE", 50000n), -50000n);
assert.equal(toSignedMinor("INCOME", 50000n), 50000n);
assert.throws(() => toSignedMinor("EXPENSE", 0n));

const d1 = balanceDeltasForUpdate(
  { accountId: "a", signedMinor: -100n },
  { accountId: "a", signedMinor: -250n },
);
assert.equal(d1.get("a"), -150n);

const d2 = balanceDeltasForUpdate(
  { accountId: "a", signedMinor: -100n },
  { accountId: "b", signedMinor: 100n },
);
assert.equal(d2.get("a"), 100n);
assert.equal(d2.get("b"), 100n);

console.log("tx-amount tests ok");
