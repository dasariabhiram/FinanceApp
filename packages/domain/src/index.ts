/** Money helpers — store and compute in integer minor units (cents). */

export type CurrencyCode = string;

export function toMinorUnits(amount: number): bigint {
  if (!Number.isFinite(amount)) {
    throw new Error("Invalid amount");
  }
  return BigInt(Math.round(amount * 100));
}

export function fromMinorUnits(minor: bigint, fractionDigits = 2): number {
  const factor = 10 ** fractionDigits;
  return Number(minor) / factor;
}

export function formatMoney(minor: bigint, currency: CurrencyCode, locale = "en-IN"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(fromMinorUnits(minor));
}

export function addMinor(a: bigint, b: bigint): bigint {
  return a + b;
}

export function negateMinor(a: bigint): bigint {
  return -a;
}
