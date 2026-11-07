import { CATEGORIES, EXPENSE_CATEGORIES, todayISO, toMinorFromRupees } from "./money";

export type ParsedExpense = {
  amountMinor: string | null;
  category: string;
  accountHint: string | null;
  description: string;
  occurredOn: string;
  confidence: "high" | "low";
};

const categoryKeywords: Record<string, string[]> = {
  "Food & Dining": ["food", "lunch", "dinner", "breakfast", "swiggy", "zomato", "restaurant", "cafe", "tea", "coffee"],
  Shopping: ["shopping", "amazon", "flipkart", "mall", "clothes", "grocery", "groceries"],
  Transport: ["uber", "ola", "petrol", "fuel", "metro", "cab", "transport", "auto", "bus"],
  Entertainment: ["movie", "netflix", "spotify", "game", "cinema"],
  Health: ["pharmacy", "hospital", "doctor", "medicine", "medical"],
  Utilities: ["electricity", "water", "internet", "recharge", "bill", "wifi", "mobile"],
  Housing: ["rent", "maintenance", "society"],
};

function parseAmount(text: string): string | null {
  const k = text.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (k) return toMinorFromRupees(String(Number(k[1]) * 1000));
  const rs = text.match(/(?:rs\.?|₹|rupees?)\s*(\d+(?:\.\d+)?)/i);
  if (rs) return toMinorFromRupees(rs[1]!);
  const plain = text.match(/\b(\d+(?:\.\d+)?)\b/);
  if (plain) return toMinorFromRupees(plain[1]!);
  return null;
}

function parseCategory(text: string): string {
  const forMatch = text.match(/\bfor\s+([a-z][a-z\s&]{1,40})/i);
  const probe = (forMatch?.[1] ?? text).toLowerCase();
  for (const [cat, keys] of Object.entries(categoryKeywords)) {
    if (keys.some((k) => probe.includes(k))) return cat;
  }
  return "Other";
}

function parsePayment(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\b(upi|gpay|google pay|phonepe|paytm|bhim)\b/.test(lower) || /\b(via|through|by|with|using)\s+upi\b/.test(lower)) {
    return "UPI";
  }
  if (/\b(cash|paid cash|by cash|with cash|in cash)\b/.test(lower) || /\b(via|through|by|with)\s+cash\b/.test(lower)) {
    return "CASH";
  }
  if (
    /\b(card|credit card|debit card|visa|mastercard|rupay)\b/.test(lower) ||
    /\b(via|through|by|with)\s+(card|credit)\b/.test(lower)
  ) {
    return "CREDIT_CARD";
  }
  if (/\b(hdfc|sbi|icici|axis|kotak|amex)\b/.test(lower)) return "CREDIT_CARD";
  return null;
}

export function parseExpenseTranscript(transcript: string): ParsedExpense {
  const amountMinor = parseAmount(transcript);
  const accountHint = parsePayment(transcript);
  const category = parseCategory(transcript);
  const confidence: "high" | "low" = amountMinor && accountHint ? "high" : "low";
  return {
    amountMinor,
    category,
    accountHint,
    description: transcript.trim().slice(0, 120),
    occurredOn: todayISO(),
    confidence,
  };
}
