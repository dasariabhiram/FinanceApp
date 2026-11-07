export type PaymentMode = "CASH" | "UPI" | "CREDIT_CARD";

export const PAYMENT_MODES: { id: PaymentMode; label: string }[] = [
  { id: "CASH", label: "Cash" },
  { id: "UPI", label: "UPI" },
  { id: "CREDIT_CARD", label: "Card" },
];

export function hintToPaymentMode(hint: string | null | undefined): PaymentMode | "" {
  if (!hint) return "";
  const h = hint.toUpperCase();
  if (h === "CASH" || h.includes("CASH")) return "CASH";
  if (h === "UPI" || h.includes("UPI")) return "UPI";
  if (h === "CREDIT_CARD" || h.includes("CARD") || h.includes("CREDIT")) return "CREDIT_CARD";
  return "";
}

export function defaultAccountIdForMode<T extends { id: string; type: string }>(
  accounts: T[],
  mode: PaymentMode,
  preferredId?: string,
): string {
  const list = accounts.filter((a) => a.type === mode);
  if (!list.length) return "";
  if (preferredId && list.some((a) => a.id === preferredId)) return preferredId;
  return list[0]!.id;
}

export function formatTxPaymentLabel(
  accounts: { id: string; type: string; name: string }[],
  accountId: string,
): string {
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return "—";
  if (account.type === "CASH") return "Cash";
  if (account.type === "UPI") return "UPI";
  if (account.type === "CREDIT_CARD") return account.name;
  return account.name;
}
