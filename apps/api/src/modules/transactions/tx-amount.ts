/** Signed ledger amount: expenses negative, income/refunds positive. */
export function toSignedMinor(type: "INCOME" | "EXPENSE", positiveMinor: bigint | string | number): bigint {
  const n = typeof positiveMinor === "bigint" ? positiveMinor : BigInt(positiveMinor);
  if (n <= 0n) throw new Error("amount must be positive");
  return type === "EXPENSE" ? -n : n;
}

/** Account balance deltas when replacing an existing posted tx. */
export function balanceDeltasForUpdate(
  prev: { accountId: string; signedMinor: bigint },
  next: { accountId: string; signedMinor: bigint },
): Map<string, bigint> {
  const deltas = new Map<string, bigint>();
  const add = (id: string, d: bigint) => deltas.set(id, (deltas.get(id) ?? 0n) + d);
  add(prev.accountId, -prev.signedMinor);
  add(next.accountId, next.signedMinor);
  return deltas;
}
