import type { Account, CreateAccount, CreateOrganization, CreateTransaction, Organization, Transaction } from "@finance/contracts";

export type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
};

export type ApiClientOptions = {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null> | string | null;
  getOrgId?: () => string | null;
  retries?: number;
};

export type SummaryPeriod = "day" | "week" | "month";

export type Summary = {
  totalBalanceMinor: string;
  monthIncomeMinor: string;
  monthExpenseMinor: string;
  periodIncomeMinor: string;
  periodExpenseMinor: string;
  accountCount: number;
  period: SummaryPeriod;
  daily: { day: string; incomeMinor: string; expenseMinor: string }[];
  categories: { category: string; totalMinor: string }[];
  byPayment: { accountType: string; accountName: string; totalMinor: string }[];
  periodStart: string;
  periodEnd: string;
};


export type MembershipInfo = {
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: string;
  orgStatus: string;
};

export type VoiceParseResult = {
  amountMinor: string | null;
  category: string | null;
  accountHint: string | null;
  description: string | null;
  occurredOn: string | null;
  confidence: "high" | "low";
};

export function isNetworkFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    err.name === "TypeError" ||
    msg === "failed to fetch" ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    msg.includes("network request failed")
  );
}

export function friendlyApiError(err: unknown): string {
  if (isNetworkFailure(err)) {
    return "Can't reach the API right now. Check that the server is running, then retry.";
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return "Something went wrong. Please try again.";
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function requestOnce<T>(
  options: ApiClientOptions,
  path: string,
  init?: RequestInit,
): Promise<ApiEnvelope<T>> {
  const token = options.getAccessToken ? await options.getAccessToken() : null;
  const orgId = options.getOrgId?.() ?? null;
  const headers = new Headers(init?.headers);
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (orgId) headers.set("X-Org-Id", orgId);

  let res: Response;
  try {
    res = await fetch(`${options.baseUrl}${path}`, { ...init, headers });
  } catch (err) {
    throw err instanceof Error ? err : new Error("Failed to fetch");
  }

  let body: ApiEnvelope<T>;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error(`Request failed (${res.status})`);
  }
  if (!res.ok || !body.success) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body;
}

async function request<T>(
  options: ApiClientOptions,
  path: string,
  init?: RequestInit,
): Promise<ApiEnvelope<T>> {
  const retries = options.retries ?? 2;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await requestOnce<T>(options, path, init);
    } catch (err) {
      lastError = err;
      const canRetry = isNetworkFailure(err) && attempt < retries;
      if (!canRetry) break;
      await sleep(250 * (attempt + 1));
    }
  }
  throw new Error(friendlyApiError(lastError));
}

export function createApiClient(options: ApiClientOptions) {
  return {
    health: () => request<{ status: string; service: string; timestamp: string }>(options, "/health"),
    memberships: () =>
      request<{ memberships: MembershipInfo[]; platformAdmin: boolean }>(options, "/v1/me/memberships"),
    adminMe: () => request<{ platformAdmin: boolean }>(options, "/v1/admin/me"),
    listAdminOrgs: () => request<Organization[]>(options, "/v1/admin/organizations"),
    createAdminOrg: (input: CreateOrganization) =>
      request<{ organization: Organization; inviteSent: boolean; inviteError: string | null }>(
        options,
        "/v1/admin/organizations",
        { method: "POST", body: JSON.stringify(input) },
      ),
    updateOrgStatus: (id: string, status: "active" | "suspended") =>
      request<{ id: string; status: string }>(options, `/v1/admin/organizations/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    summary: (period: SummaryPeriod = "month", window?: { start: string; end: string }) => {
      const sp = new URLSearchParams({ period });
      if (window?.start && window?.end) {
        sp.set("start", window.start);
        sp.set("end", window.end);
      }
      return request<Summary>(options, `/v1/summary?${sp.toString()}`);
    },
    listAccounts: () => request<Account[]>(options, "/v1/accounts"),
    createAccount: (input: CreateAccount) =>
      request<Account>(options, "/v1/accounts", { method: "POST", body: JSON.stringify(input) }),
    updateAccount: (id: string, input: { name?: string; type?: string; isDefault?: boolean }) =>
      request<Account>(options, `/v1/accounts/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    deleteAccount: (id: string) =>
      request<{ id: string }>(options, `/v1/accounts/${id}`, { method: "DELETE" }),
    listTransactions: (params?: {
      accountId?: string;
      type?: string;
      search?: string;
      from?: string;
      to?: string;
      limit?: number;
    }) => {
      const sp = new URLSearchParams();
      if (params?.accountId) sp.set("accountId", params.accountId);
      if (params?.type) sp.set("type", params.type);
      if (params?.search) sp.set("search", params.search);
      if (params?.from) sp.set("from", params.from);
      if (params?.to) sp.set("to", params.to);
      if (params?.limit) sp.set("limit", String(params.limit));
      const q = sp.toString();
      return request<Transaction[]>(options, `/v1/transactions${q ? `?${q}` : ""}`);
    },
    createTransaction: (input: CreateTransaction) =>
      request<Transaction>(options, "/v1/transactions", { method: "POST", body: JSON.stringify(input) }),
    updateTransaction: (
      id: string,
      input: { category?: string; description?: string | null; occurredOn?: string },
    ) =>
      request<Transaction>(options, `/v1/transactions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    deleteTransaction: (id: string) =>
      request<{ id: string }>(options, `/v1/transactions/${id}`, { method: "DELETE" }),
    parseVoiceExpense: (transcript: string) =>
      request<VoiceParseResult>(options, "/v1/voice/parse-expense", {
        method: "POST",
        body: JSON.stringify({ transcript }),
      }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
