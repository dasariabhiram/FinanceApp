export function formatMinor(minor: string | number | bigint, currency = "INR") {
  const n = typeof minor === "bigint" ? Number(minor) : Number(minor);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n / 100);
}

export function toMinorFromRupees(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Enter a valid amount");
  return String(Math.round(n * 100));
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export const CATEGORIES = [
  "Food & Dining",
  "Shopping",
  "Housing",
  "Transport",
  "Entertainment",
  "Health",
  "Utilities",
  "Salary",
  "Freelance",
  "Investment",
  "Other",
] as const;
