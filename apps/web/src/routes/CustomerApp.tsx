import { Link, useSearchParams } from "react-router-dom";
import type { SummaryPeriod, VoiceParseResult } from "@finance/api-client";
import { parseExpenseTranscript } from "../lib/voice-parser";
import {
  PAYMENT_MODES,
  defaultAccountIdForMode,
  hintToPaymentMode,
  type PaymentMode,
  formatTxPaymentLabel,
} from "../lib/payment-mode";
import { setActiveOrgId } from "../lib/org-store";
import { HeroCanvas } from "../components/HeroCanvas";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { OrbitRing } from "../components/OrbitRing";
import { toggleThemeWithTransition } from "../lib/theme-transition";

import { FormEvent, type MouseEvent, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveMonth } from "../lib/use-live-month";
import { api } from "../lib/api";
import {
  CATEGORIES,
  EXPENSE_CATEGORIES,
  currentMonthYM,
  formatMinor,
  formatMonthLabel,
  formatSpentMinor,
  minorToRupeesInput,
  monthRangeFromYM,
  occurredInRange,
  periodWindowLocal,
  sumExpenseMinorInRange,
  todayISO,
  toMinorFromRupees,
} from "../lib/money";
import { supabase, supabaseConfigured } from "../lib/supabase";
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  resolveInitialTheme,
  toggleTheme,
  type Theme,
} from "../lib/theme";
import { friendlyApiError, type Summary } from "@finance/api-client";

type Tab = "dashboard" | "accounts" | "transactions";

type Account = {
  id: string;
  name: string;
  type: string;
  currency: string;
  balanceMinor: string;
  isDefault: boolean;
};

type Tx = {
  id: string;
  accountId: string;
  type: string;
  amountMinor: string;
  category: string;
  description: string | null;
  occurredOn: string;
};

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
    </svg>
  );
}

const DailyBars = lazy(() => import("../components/DashboardCharts").then((m) => ({ default: m.DailyBars })));
const CategoryDonut = lazy(() => import("../components/DashboardCharts").then((m) => ({ default: m.CategoryDonut })));

export function CustomerApp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    return resolveInitialTheme(
      readStoredTheme(),
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [deferredInstall, setDeferredInstall] = useState<{ prompt: () => Promise<void> } | null>(null);
  const [pwaDismissed, setPwaDismissed] = useState(false);

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  function onToggleTheme(e?: MouseEvent) {
    const next = toggleTheme(theme);
    toggleThemeWithTransition(theme, next, e ? { x: e.clientX, y: e.clientY } : undefined);
    setTheme(next);
  }

  const loadGen = useRef(0);
  const historyTracksLiveRef = useRef(true);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  const [accountName, setAccountName] = useState("Cash");
  const [accountType, setAccountType] = useState("CASH");
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  const [txType, setTxType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [txAmount, setTxAmount] = useState("");
  const [txCategory, setTxCategory] = useState<string>(CATEGORIES[0]);
  const [txNote, setTxNote] = useState("");
  const [txAccountId, setTxAccountId] = useState("");
  const [txDate, setTxDate] = useState(todayISO());
  const [txFilter, setTxFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("EXPENSE");
  const [txSearch, setTxSearch] = useState("");
  const [txHistoryMonth, setTxHistoryMonth] = useState<"all" | string>(() => currentMonthYM());
  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>("month");
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const displayOrgLabel = (name: string) => {
    const n = name.trim();
    if (!n || /^demo$/i.test(n)) return "Personal";
    return n;
  };

  const [orgLabel, setOrgLabel] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceDraft, setVoiceDraft] = useState<VoiceParseResult | null>(null);
  const [voiceAccountId, setVoiceAccountId] = useState("");
  const [voicePaymentMode, setVoicePaymentMode] = useState<PaymentMode | "">("");

  const flash = (msg: string) => {
    setInfo(msg);
    window.setTimeout(() => setInfo(""), 2200);
  };

  async function seedPaymentBasics(list: Account[]): Promise<Account[]> {
    const types = new Set(list.map((a) => a.type));
    let merged = list;
    if (!types.has("CASH")) {
      const res = await api.createAccount({
        name: "Cash",
        type: "CASH",
        currency: "INR",
        isDefault: list.length === 0,
      });
      if (res.data) merged = [res.data as Account, ...merged];
    }
    if (!types.has("UPI")) {
      const res = await api.createAccount({ name: "UPI", type: "UPI", currency: "INR" });
      if (res.data) merged = [...merged, res.data as Account];
    }
    return merged;
  }

  const loadCore = useCallback(async () => {
    const gen = ++loadGen.current;
    setLoading(true);
    try {
      const [aRes, tRes] = await Promise.allSettled([
        api.listAccounts(),
        api.listTransactions({ limit: 2000 }),
      ]);
      if (gen !== loadGen.current) return;
      if (aRes.status === "fulfilled") {
        let nextAccounts = (aRes.value.data as Account[]) ?? [];
        try {
          nextAccounts = await seedPaymentBasics(nextAccounts);
        } catch (e) {
          console.warn("seed payment basics", e);
        }
        setAccounts(nextAccounts);
        setTxAccountId((prev) => prev || nextAccounts[0]?.id || "");
      }
      if (tRes.status === "fulfilled") {
        setTxs((tRes.value.data as Tx[]) ?? []);
      }
      const firstFail = [aRes, tRes].find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      if (firstFail) setError(friendlyApiError(firstFail.reason));
      else setError("");
    } catch (e) {
      if (gen === loadGen.current) setError(friendlyApiError(e));
    } finally {
      if (gen === loadGen.current) setLoading(false);
    }
  }, []);

  const loadMemberships = useCallback(async () => {
    try {
      const res = await api.memberships();
      const m = res.data?.memberships?.[0];
      if (m) {
        setActiveOrgId(m.orgId);
        setOrgLabel(displayOrgLabel(m.orgName));
      }
      setPlatformAdmin(Boolean(res.data?.platformAdmin));
    } catch (e) {
      console.warn("memberships", e);
    }
  }, []);

  const loadDashboardExtras = useCallback(async () => {
    try {
      const window = periodWindowLocal(summaryPeriod);
      const sRes = await api
        .summary(summaryPeriod, window)
        .then((v) => ({ status: "fulfilled" as const, value: v }))
        .catch((reason) => ({ status: "rejected" as const, reason }));
      if (sRes.status === "fulfilled") setSummary(sRes.value.data);
      else console.warn("dashboard refresh failed", sRes.reason);
    } catch (e) {
      console.warn("dashboard refresh failed", e);
    }
  }, [summaryPeriod]);

  const onLiveMonthChange = useCallback(
    (ym: string) => {
      setTxHistoryMonth((prev) => {
        if (prev === "all") return prev;
        if (historyTracksLiveRef.current) return ym;
        return prev;
      });
      void loadDashboardExtras();
      flash(`Now tracking ${formatMonthLabel(ym)}`);
    },
    [loadDashboardExtras],
  );

  const { liveMonthYm, progress, monthWindow } = useLiveMonth(onLiveMonthChange);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSessionEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionEmail) {
      setAccounts([]);
      setTxs([]);
      setSummary(null);
      setTxAccountId("");
      return;
    }
    void loadMemberships();
    void loadCore();
  }, [sessionEmail, loadCore, loadMemberships]);

  useEffect(() => {
    if (!sessionEmail) return;
    if (tab === "dashboard") void loadDashboardExtras();
  }, [sessionEmail, tab, loadDashboardExtras]);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "dashboard" || t === "accounts" || t === "transactions") setTab(t);
  }, [searchParams]);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferredInstall(e as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  function setTabAndUrl(next: Tab) {
    setTab(next);
    const sp = new URLSearchParams(searchParams);
    sp.set("tab", next);
    setSearchParams(sp, { replace: true });
  }

  function syncVoicePayment(mode: PaymentMode, preferredAccountId?: string) {
    setVoicePaymentMode(mode);
    setVoiceAccountId(defaultAccountIdForMode(accounts, mode, preferredAccountId));
  }

  const liveMonthExpenseMinor = useMemo(
    () => sumExpenseMinorInRange(txs, monthWindow.start, monthWindow.end),
    [txs, monthWindow],
  );

  const spentByAccountId = useMemo(() => {
    const map = new Map<string, number>();
    const { start, end } = monthWindow;
    for (const tx of txs) {
      if (tx.type !== "EXPENSE") continue;
      if (!occurredInRange(tx.occurredOn, start, end)) continue;
      map.set(tx.accountId, (map.get(tx.accountId) ?? 0) + Math.abs(Number(tx.amountMinor)));
    }
    return map;
  }, [txs, monthWindow]);

  const historyMonthOptions = useMemo(() => {
    const set = new Set<string>([liveMonthYm]);
    for (const t of txs) set.add(t.occurredOn.slice(0, 7));
    return [...set].sort().reverse();
  }, [txs, liveMonthYm]);

  const periodExpenseDisplay = useMemo(() => {
    if (summaryPeriod === "month") return liveMonthExpenseMinor;
    return Number(summary?.periodExpenseMinor ?? summary?.monthExpenseMinor ?? 0);
  }, [summaryPeriod, liveMonthExpenseMinor, summary]);

  const cardAccounts = useMemo(
    () => accounts.filter((a) => a.type === "CREDIT_CARD"),
    [accounts],
  );

  const filteredTxs = useMemo(() => {
    const monthRange = txHistoryMonth === "all" ? null : monthRangeFromYM(txHistoryMonth);
    return txs.filter((t) => {
      if (txFilter !== "ALL" && t.type !== txFilter) return false;
      if (monthRange && !occurredInRange(t.occurredOn, monthRange.start, monthRange.end)) return false;
      if (!txSearch.trim()) return true;
      const q = txSearch.toLowerCase();
      return t.category.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q);
    });
  }, [txs, txFilter, txSearch, txHistoryMonth]);

  const dailyChart = useMemo(
    () =>
      (summary?.daily ?? []).map((d) => ({
        day: d.day.slice(8),
        income: Number(d.incomeMinor) / 100,
        expense: Number(d.expenseMinor) / 100,
      })),
    [summary],
  );

  const categoryChart = useMemo(
    () =>
      (summary?.categories ?? []).map((c) => ({
        name: c.category,
        value: Number(c.totalMinor) / 100,
      })),
    [summary],
  );

  async function onSignIn(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!supabase) return setError("Supabase env missing");
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) setError(err.message);
  }

  async function onSignUp(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!supabase) return setError("Supabase env missing");
    if (!email.includes("@") || !email.split("@")[1]?.includes(".")) {
      return setError("Enter a full email like you@gmail.com");
    }
    setBusy(true);
    const { data, error: err } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (err) {
      if (err.message.toLowerCase().includes("rate limit")) {
        setError("Email rate limit hit. Use demo@financeapp.local / DemoPass123!");
      } else setError(err.message);
      return;
    }
    if (!data.session) flash("Account created — sign in after email confirm if required");
  }

  async function createAccount(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.createAccount({
        name: accountName.trim() || "Account",
        type: accountType as "CASH" | "UPI" | "BANK" | "CREDIT_CARD" | "SAVINGS",
        currency: "INR",
        isDefault: accounts.length === 0,
      });
      const created = res.data as Account;
      setAccounts((prev) => [created, ...prev]);
      setTxAccountId((prev) => prev || created.id);
      setAccountName("Cash");
      setAccountType("CASH");
      flash("Account created");
      if (tab === "dashboard") void loadDashboardExtras();
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveAccountEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingAccountId) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.updateAccount(editingAccountId, {
        name: accountName.trim(),
        type: accountType,
      });
      const updated = res.data as Account;
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setEditingAccountId(null);
      setAccountName("Cash");
      setAccountType("CASH");
      flash("Account updated");
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount(id: string) {
    if (!confirm("Delete this account and its transactions?")) return;
    setError("");
    const prev = accounts;
    setAccounts((a) => a.filter((x) => x.id !== id));
    try {
      await api.deleteAccount(id);
      setTxs((t) => t.filter((x) => x.accountId !== id));
      setTxAccountId((cur) => (cur === id ? "" : cur));
      flash("Account deleted");
      void loadDashboardExtras();
    } catch (err) {
      setAccounts(prev);
      setError(friendlyApiError(err));
    }
  }

  async function createTx(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const accountId = txAccountId || accounts[0]?.id;
      if (!accountId) throw new Error("Create an account first");
      const amountMinor = toMinorFromRupees(txAmount);
      const res = await api.createTransaction({
        accountId,
        type: txType,
        amountMinor,
        category: txCategory,
        description: txNote || undefined,
        occurredOn: txDate,
        idempotencyKey: crypto.randomUUID(),
      });
      const created = res.data as Tx;
      setTxs((prev) => [created, ...prev]);
      const signed = Number(created.amountMinor);
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === accountId
            ? { ...a, balanceMinor: String(Number(a.balanceMinor) + signed) }
            : a,
        ),
      );
      setTxAmount("");
      setTxNote("");
      flash("Transaction saved");
      void loadDashboardExtras();
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeTx(id: string) {
    setError("");
    const target = txs.find((t) => t.id === id);
    if (!target) return;
    setTxs((prev) => prev.filter((t) => t.id !== id));
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === target.accountId
          ? { ...a, balanceMinor: String(Number(a.balanceMinor) - Number(target.amountMinor)) }
          : a,
      ),
    );
    try {
      await api.deleteTransaction(id);
      flash("Transaction deleted");
      void loadDashboardExtras();
    } catch (err) {
      setTxs((prev) => [target, ...prev]);
      setError(friendlyApiError(err));
      void loadCore();
    }
  }

  function exportCsv() {
    const header = "date,type,category,amount,description,accountId\n";
    const lines = filteredTxs.map((t) => {
      const amt = (Math.abs(Number(t.amountMinor)) / 100).toFixed(2);
      const desc = (t.description ?? "").replaceAll('"', "'");
      return `${t.occurredOn},${t.type},${t.category},${amt},"${desc}",${t.accountId}`;
    });
    const blob = new Blob([header + lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeapp-transactions-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function applyVoiceDraft(draft: VoiceParseResult) {
    setVoiceDraft(draft);
    const mode = hintToPaymentMode(draft.accountHint);
    const preferred = pickAccountForHint(draft.accountHint);
    if (mode) syncVoicePayment(mode, preferred);
    else {
      setVoicePaymentMode("");
      setVoiceAccountId("");
    }
    setVoiceOpen(true);
  }

  function pickAccountForHint(hint: string | null) {
    if (!hint) return accounts[0]?.id ?? "";
    const h = hint.toLowerCase();
    const byType = accounts.find((a) => a.type.toLowerCase() === h || a.name.toLowerCase().includes(h));
    if (byType) return byType.id;
    if (h.includes("upi")) return accounts.find((a) => a.type === "UPI")?.id ?? accounts[0]?.id ?? "";
    if (h.includes("cash")) return accounts.find((a) => a.type === "CASH")?.id ?? accounts[0]?.id ?? "";
    if (h.includes("card") || h.includes("credit"))
      return accounts.find((a) => a.type === "CREDIT_CARD")?.id ?? accounts[0]?.id ?? "";
    return accounts[0]?.id ?? "";
  }

  async function finalizeVoiceExpense() {
    if (!voiceDraft?.amountMinor) return setError("Amount required");
    if (!voicePaymentMode) return setError("Choose payment mode: Cash, UPI, or Card");
    const accountId = voiceAccountId || defaultAccountIdForMode(accounts, voicePaymentMode);
    if (!accountId) {
      return setError(
        voicePaymentMode === "CREDIT_CARD"
          ? "Add your cards under Accounts (type Credit card)"
          : "Add this payment method under Accounts",
      );
    }
    setBusy(true);
    try {
      await api.createTransaction({
        accountId,
        type: "EXPENSE",
        amountMinor: voiceDraft.amountMinor,
        category: voiceDraft.category ?? CATEGORIES[0],
        description: voiceDraft.description ?? undefined,
        occurredOn: voiceDraft.occurredOn ?? todayISO(),
        idempotencyKey: crypto.randomUUID(),
      });
      setVoiceOpen(false);
      setVoiceDraft(null);
      flash("Expense saved");
      await loadCore();
      await loadDashboardExtras();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onVoiceStop(transcript: string) {
    setListening(false);
    setVoiceTranscript(transcript);
    const local = parseExpenseTranscript(transcript);
    if (local.confidence === "high" && local.amountMinor) {
      applyVoiceDraft({
        amountMinor: local.amountMinor,
        category: local.category,
        accountHint: local.accountHint,
        description: local.description,
        occurredOn: local.occurredOn,
        confidence: "high",
      });
      return;
    }
    try {
      const res = await api.parseVoiceExpense(transcript);
      if (res.data) applyVoiceDraft(res.data);
    } catch {
      applyVoiceDraft({
        amountMinor: local.amountMinor,
        category: local.category,
        accountHint: local.accountHint,
        description: local.description,
        occurredOn: local.occurredOn,
        confidence: "low",
      });
    }
  }

  function startVoice() {
    type SpeechCtor = new () => {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: ((ev: { results: Array<{ 0: { transcript: string } }> }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
    };
    const w = window as Window & { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return setError("Voice not supported in this browser");
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setListening(true);
    setError("");
    rec.onresult = (ev) => {
      const line = ev.results[0]?.[0]?.transcript ?? "";
      void onVoiceStop(line);
    };
    rec.onerror = () => {
      setListening(false);
      setError("Could not capture voice — use manual entry");
    };
    rec.onend = () => setListening(false);
    rec.start();
  }

  useEffect(() => {
    if (!sessionEmail) return;
    if (searchParams.get("action") !== "voice") return;
    startVoice();
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionEmail]);

  function startEditAccount(a: Account) {
    setEditingAccountId(a.id);
    setAccountName(a.name);
    setAccountType(a.type);
  }

  if (!sessionEmail) {
    return (
      <div className="auth-wrap">
        <section className="auth-hero" aria-label="MakeYourFinance introduction">
          <div className="hero-poster" />
          <HeroCanvas />
          <div className="auth-hero-copy">
            <span className="hero-kicker">Live month tracking</span>
            <h1>
              <span className="line"><span className="word">Money</span></span>
              <span className="line"><span className="word">in</span> <span className="word">motion.</span></span>
            </h1>
            <p className="sub">
              Voice-first expenses across Cash, UPI, and cards. This month resets on the 1st —
              your history never does.
              {supabaseConfigured ? "" : " Missing Supabase env."}
            </p>
          </div>
        </section>
        <div className="auth-panel">
          <form className="auth-card" onSubmit={onSignIn}>
            <div className="brand-row">
              <div className="brand">
                <div className="brand-mark" />
                <div>
                  <h2>MakeYourFinance</h2>
                  <p className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>Sign in to your ledger</p>
                </div>
              </div>
              <button type="button" className="icon-toggle" onClick={(e) => onToggleTheme(e)} aria-label="Toggle theme">
                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              </button>
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" required autoComplete="email" />
            </div>
            <div className="field" style={{ marginTop: "0.75rem" }}>
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <div className="auth-actions">
              <button className="primary" type="submit" disabled={busy}>Sign in</button>
              <button className="secondary" type="button" disabled={busy} onClick={onSignUp}>Sign up</button>
            </div>
            {error ? (
              <div className="error banner-row" role="alert">
                <span>{error}</span>
                <button type="button" className="ghost" onClick={() => setError("")}>Dismiss</button>
              </div>
            ) : null}
            {info ? <p className="ok">{info}</p> : null}
            <div className="demo-chip">
              <span>Demo · demo@financeapp.local</span>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setEmail("demo@financeapp.local");
                  setPassword("DemoPass123!");
                }}
              >
                Try demo
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <h1>MakeYourFinance</h1>
            <p>{loading ? "Syncing your ledger…" : orgLabel || "Expense tracking that stays out of your way"}</p>
          </div>
        </div>
        <nav className="nav" aria-label="Primary">
          {(
            [
              ["dashboard", "Dashboard"],
              ["accounts", "Accounts"],
              ["transactions", "Expenses"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTabAndUrl(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          {platformAdmin ? <Link className="ghost" to="/admin">Admin</Link> : null}
          <button type="button" className="icon-toggle" onClick={(e) => onToggleTheme(e)} aria-label="Toggle theme" title="Toggle theme">
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <div className="user-chip">
            <span>{sessionEmail}</span>
            <button className="ghost" type="button" onClick={() => supabase?.auth.signOut()}>Sign out</button>
          </div>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {info ? <p className="ok">{info}</p> : null}

      {tab === "dashboard" ? (
        <div className="grid" style={{ gap: "1rem" }}>
          <div className="period-toggle" role="tablist" aria-label="Spend period">
            {(["day", "week", "month"] as const).map((p) => (
              <button key={p} type="button" className={summaryPeriod === p ? "active" : ""} onClick={() => setSummaryPeriod(p)}>
                {p === "day" ? "Today" : p === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>
          <div className="stat-hero">
            <div>
              <p className="hero-label">
                Expenses · {summaryPeriod === "month" ? progress.label : summaryPeriod}
              </p>
              <p className="hero-amount num">
                <AnimatedNumber value={periodExpenseDisplay} format={(n) => formatMinor(Math.round(n))} />
              </p>
              <p className="hero-meta">
                {summaryPeriod === "month"
                  ? `Live month · day ${progress.day} of ${progress.daysInMonth}`
                  : "Updates as you log spend"}
              </p>
            </div>
            {summaryPeriod === "month" ? (
              <OrbitRing pct={progress.pct} label={progress.label} day={progress.day} daysInMonth={progress.daysInMonth} />
            ) : null}
          </div>

          <div className="grid grid-2">
            <div className="card">
              <div className="section-head"><h2>Daily spending</h2></div>
              <div className="chart-wrap">
                <Suspense fallback={<div className="empty">Loading chart…</div>}>
                  <DailyBars data={dailyChart} />
                </Suspense>
              </div>
            </div>
            <div className="card">
              <div className="section-head"><h2>Spend by category</h2></div>
              <div className="chart-wrap">
                <Suspense fallback={<div className="empty">Loading chart…</div>}>
                  <CategoryDonut data={categoryChart} />
                </Suspense>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-head"><h2>Spend by payment</h2></div>
            <div className="tx-list">
              {(summary?.byPayment ?? []).map((p) => (
                <div key={`${p.accountType}-${p.accountName}`} className="tx-item">
                  <div>
                    <div className="cat">{p.accountName}</div>
                    <div className="meta">{p.accountType.replaceAll("_", " ")}</div>
                  </div>
                  <div className="badge expense">{formatMinor(p.totalMinor)}</div>
                </div>
              ))}
              {!(summary?.byPayment?.length) ? <div className="empty">No expenses in this period</div> : null}
            </div>
          </div>

          <div className="card">
            <div className="section-head"><h2>Quick add</h2></div>
            <form className="row" onSubmit={createTx}>
              <div className="field">
                <label>Type</label>
                <select value={txType} onChange={(e) => setTxType(e.target.value as "INCOME" | "EXPENSE")}>
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                </select>
              </div>
              <div className="field">
                <label>Amount (₹)</label>
                <input value={txAmount} onChange={(e) => setTxAmount(e.target.value)} placeholder="500" required />
              </div>
              <div className="field">
                <label>Category</label>
                <select value={txCategory} onChange={(e) => setTxCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Account</label>
                <select value={txAccountId} onChange={(e) => setTxAccountId(e.target.value)} required>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="actions">
                <button className="primary" type="submit" disabled={busy || !accounts.length}>Add</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {tab === "accounts" ? (
        <div className="grid" style={{ gap: "1rem" }}>
          <div className="card">
            <h2>{editingAccountId ? "Edit payment method" : "Add payment method"}</h2>
            <p className="muted">Set up Cash, UPI, and each credit/debit card you use for expenses.</p>
            <form className="row" onSubmit={editingAccountId ? saveAccountEdit : createAccount}>
              <div className="field">
                <label>{accountType === "CREDIT_CARD" ? "Card name" : "Label"}</label>
                <input
                  value={accountName}
                  placeholder={accountType === "CREDIT_CARD" ? "e.g. HDFC Millennia" : accountType === "UPI" ? "PhonePe / GPay" : "Cash"}
                  onChange={(e) => setAccountName(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Type</label>
                <select value={accountType} onChange={(e) => setAccountType(e.target.value)}>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK">Bank</option>
                  <option value="CREDIT_CARD">Credit card</option>
                  <option value="SAVINGS">Savings</option>
                </select>
              </div>
              <div className="actions">
                {editingAccountId ? (
                  <>
                    <button className="secondary" type="button" onClick={() => { setEditingAccountId(null); setAccountName("Cash"); setAccountType("CASH"); }}>Cancel</button>
                    <button className="primary" type="submit" disabled={busy}>Save</button>
                  </>
                ) : (
                  <button className="primary" type="submit" disabled={busy}>Create</button>
                )}
              </div>
            </form>
          </div>
          <div className="grid grid-accounts">
            {accounts.map((a) => (
              <div key={a.id} className="card account-card" data-type={a.type}>
                <span className="type">{a.type.replaceAll("_", " ")}</span>
                <h2 style={{ marginTop: "0.7rem" }}>{a.name}</h2>
                <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.8rem" }}>
                  Spent · {formatMonthLabel(liveMonthYm)}
                </p>
                <div className="bal display expense">{formatSpentMinor(String(spentByAccountId.get(a.id) ?? 0), a.currency)}</div>
                <div className="row" style={{ marginTop: "0.85rem" }}>
                  <button className="secondary" type="button" onClick={() => startEditAccount(a)}>Edit</button>
                  <button className="icon-btn" type="button" onClick={() => removeAccount(a.id)}>Delete</button>
                </div>
              </div>
            ))}
            {!accounts.length ? <div className="empty">No accounts yet — create your first one</div> : null}
          </div>
        </div>
      ) : null}

      {tab === "transactions" ? (
        <div className="grid" style={{ gap: "1rem" }}>
          <div className="card">
            <h2>New transaction</h2>
            <form className="row" onSubmit={createTx}>
              <div className="field">
                <label>Type</label>
                <select value={txType} onChange={(e) => setTxType(e.target.value as "INCOME" | "EXPENSE")}>
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                </select>
              </div>
              <div className="field">
                <label>Amount (₹)</label>
                <input value={txAmount} onChange={(e) => setTxAmount(e.target.value)} required />
              </div>
              <div className="field">
                <label>Category</label>
                <select value={txCategory} onChange={(e) => setTxCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Account</label>
                <select value={txAccountId} onChange={(e) => setTxAccountId(e.target.value)} required>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Date</label>
                <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} required />
              </div>
              <div className="field">
                <label>Note</label>
                <input value={txNote} onChange={(e) => setTxNote(e.target.value)} placeholder="Optional" />
              </div>
              <div className="actions">
                <button className="primary" type="submit" disabled={busy || !accounts.length}>Save</button>
              </div>
            </form>
          </div>

          <div className="card">
            <div className="section-head">
              <h2>History</h2>
              <button className="secondary" type="button" onClick={exportCsv}>Export CSV</button>
            </div>
            <div className="row" style={{ marginBottom: "0.9rem" }}>
              <div className="field">
                <label>Month</label>
                <select
                  value={txHistoryMonth}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTxHistoryMonth(v);
                    historyTracksLiveRef.current = v !== "all" && v === liveMonthYm;
                  }}
                >
                  <option value={liveMonthYm}>Live · {formatMonthLabel(liveMonthYm)}</option>
                  <option value="all">All time</option>
                  {historyMonthOptions
                    .filter((ym) => ym !== liveMonthYm)
                    .map((ym) => (
                      <option key={ym} value={ym}>{formatMonthLabel(ym)}</option>
                    ))}
                </select>
              </div>
              <div className="field">
                <label>Filter</label>
                <select value={txFilter} onChange={(e) => setTxFilter(e.target.value as typeof txFilter)}>
                  <option value="ALL">All</option>
                  <option value="EXPENSE">Expenses</option>
                  <option value="INCOME">Income</option>
                </select>
              </div>
              <div className="field">
                <label>Search</label>
                <input value={txSearch} onChange={(e) => setTxSearch(e.target.value)} placeholder="Category or note" />
              </div>
            </div>
            <div className="tx-list">
              {filteredTxs.map((t) => (
                <div key={t.id} className="tx-item tx-item-compact">
                  <div className="cat">{t.category}</div>
                  <div className="meta payment-pill">
                    {formatTxPaymentLabel(accounts, t.accountId)}
                    {txHistoryMonth === "all" ? ` · ${t.occurredOn}` : ""}
                  </div>
                  <div className={`badge ${t.type === "INCOME" ? "income" : "expense"}`}>
                    {t.type === "INCOME" ? "+" : "-"}
                    {formatMinor(String(Math.abs(Number(t.amountMinor))))}
                  </div>
                  <button className="icon-btn" type="button" onClick={() => removeTx(t.id)} aria-label="Delete expense">
                    Delete
                  </button>
                </div>
              ))}
              {!filteredTxs.length ? <div className="empty">No transactions yet</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {deferredInstall && !pwaDismissed ? (
        <div className="pwa-banner" role="status">
          <span>Install MakeYourFinance for one-tap voice expenses</span>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button type="button" className="ghost" onClick={() => setPwaDismissed(true)}>Later</button>
            <button
              type="button"
              className="primary"
              onClick={async () => {
                await deferredInstall.prompt();
                setDeferredInstall(null);
              }}
            >
              Install
            </button>
          </div>
        </div>
      ) : null}

      <div className="voice-dock">
        {listening ? (
          <div className="voice-listening-hud" role="status" aria-live="assertive">
            <div className="wave" aria-hidden="true">
              <span /><span /><span /><span /><span />
            </div>
            <span>Listening… speak now</span>
          </div>
        ) : null}
        <div className="voice-fab-cluster">
          <button
            type="button"
            className={`voice-fab${listening ? " listening" : ""}`}
            onClick={startVoice}
            aria-label={listening ? "Listening for expense" : "Speak to add expense"}
            aria-pressed={listening}
            disabled={listening}
          >
            <MicIcon />
          </button>
          <span className="voice-fab-label" aria-hidden="true">
            {listening ? "Listening" : "Speak"}
          </span>
        </div>
      </div>

      {voiceOpen && voiceDraft ? (
        <div
          className="voice-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm expense"
          onClick={(e) => {
            if (e.target === e.currentTarget) setVoiceOpen(false);
          }}
        >
          <div className="card">
            <div className="sheet-handle" aria-hidden="true" />
            <h2>Confirm expense</h2>
            <p className="muted">{voiceTranscript || voiceDraft.description}</p>
            <div className="field">
              <label>Amount (₹)</label>
              <input
                inputMode="decimal"
                value={minorToRupeesInput(voiceDraft.amountMinor)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v.trim()) {
                    setVoiceDraft({ ...voiceDraft, amountMinor: null });
                    return;
                  }
                  try {
                    setVoiceDraft({ ...voiceDraft, amountMinor: toMinorFromRupees(v) });
                  } catch {
                    /* wait */
                  }
                }}
              />
            </div>
            <div className="field">
              <label>Category</label>
              <select
                value={EXPENSE_CATEGORIES.includes((voiceDraft.category ?? "Other") as (typeof EXPENSE_CATEGORIES)[number]) ? (voiceDraft.category ?? "Other") : "Other"}
                onChange={(e) => setVoiceDraft({ ...voiceDraft, category: e.target.value })}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Payment mode</label>
              <select
                value={voicePaymentMode}
                onChange={(e) => {
                  const mode = e.target.value as PaymentMode | "";
                  if (!mode) {
                    setVoicePaymentMode("");
                    setVoiceAccountId("");
                    return;
                  }
                  syncVoicePayment(mode);
                }}
              >
                <option value="">Cash, UPI, or card</option>
                {PAYMENT_MODES.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            {voicePaymentMode === "CREDIT_CARD" ? (
              <div className="field">
                <label>Which card?</label>
                <select value={voiceAccountId} onChange={(e) => setVoiceAccountId(e.target.value)} required>
                  <option value="">Select a card</option>
                  {cardAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {!cardAccounts.length ? (
                  <p className="muted" style={{ marginTop: "0.5rem" }}>
                    Add cards under{" "}
                    <button type="button" className="ghost" onClick={() => { setVoiceOpen(false); setTabAndUrl("accounts"); setAccountType("CREDIT_CARD"); }}>
                      Accounts → Credit card
                    </button>
                  </p>
                ) : null}
              </div>
            ) : null}
            {voicePaymentMode === "CASH" || voicePaymentMode === "UPI" ? (
              <div className="field">
                <label>{voicePaymentMode === "CASH" ? "Cash wallet" : "UPI account"}</label>
                <select value={voiceAccountId} onChange={(e) => setVoiceAccountId(e.target.value)} required>
                  {accounts
                    .filter((a) => a.type === voicePaymentMode)
                    .map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                </select>
              </div>
            ) : null}
            <div className="actions">
              <button type="button" className="secondary" onClick={() => setVoiceOpen(false)}>Cancel</button>
              <button type="button" className="primary" disabled={busy} onClick={() => void finalizeVoiceExpense()}>Save</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
