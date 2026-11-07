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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Local calendar date YYYY-MM-DD (not UTC). */
export function localDateISO(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayISO() {
  return localDateISO();
}

export type LocalSummaryPeriod = "day" | "week" | "month";

export function periodWindowLocal(period: LocalSummaryPeriod, d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  if (period === "day") {
    const start = localDateISO(d);
    const tomorrow = new Date(y, m, day + 1);
    return { start, end: localDateISO(tomorrow) };
  }
  if (period === "week") {
    const dow = d.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const startDate = new Date(y, m, day + mondayOffset);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 7);
    return { start: localDateISO(startDate), end: localDateISO(endDate) };
  }
  const start = `${y}-${pad2(m + 1)}-01`;
  const end = m === 11 ? `${y + 1}-01-01` : `${y}-${pad2(m + 2)}-01`;
  return { start, end };
}

export function currentMonthYM(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function monthRangeFromYM(ym: string) {
  const [ys, ms] = ym.split("-");
  const y = Number(ys);
  const mo = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) {
    return periodWindowLocal("month");
  }
  const m = mo - 1;
  const start = `${y}-${pad2(mo)}-01`;
  const end = m === 11 ? `${y + 1}-01-01` : `${y}-${pad2(mo + 1)}-01`;
  return { start, end };
}

export function occurredInRange(occurredOn: string, start: string, end: string) {
  return occurredOn >= start && occurredOn < end;
}

export function sumExpenseMinorInRange(
  txs: readonly { type: string; amountMinor: string; occurredOn: string }[],
  start: string,
  end: string,
) {
  let total = 0;
  for (const tx of txs) {
    if (tx.type !== "EXPENSE") continue;
    if (!occurredInRange(tx.occurredOn, start, end)) continue;
    total += Math.abs(Number(tx.amountMinor));
  }
  return total;
}

export function formatMonthLabel(ym: string) {
  const parts = ym.split("-");
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(mo)) return ym;
  return new Date(y, mo - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
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

/** Categories shown for expense entry (voice + forms). */
export const EXPENSE_CATEGORIES = CATEGORIES.filter(
  (c) => c !== "Salary" && c !== "Freelance" && c !== "Investment",
);

export function minorToRupeesInput(minor: string | null | undefined): string {
  if (!minor) return "";
  const n = Number(minor);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(n / 100);
}

export function formatAccountPaymentLabel(type: string, name: string): string {
  const typeLabel =
    type === "CASH"
      ? "Cash"
      : type === "UPI"
        ? "UPI"
        : type === "CREDIT_CARD"
          ? "Card"
          : type.replaceAll("_", " ");
  return `${typeLabel} · ${name}`;
}

/** Expense-only: show amount spent (always non-negative). */
export function formatSpentMinor(minor: string | number | bigint, currency = "INR") {
  const n = Math.abs(Number(minor));
  return formatMinor(n, currency);
}
