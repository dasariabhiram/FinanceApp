import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "./lib/api";
import { CATEGORIES, formatMinor, todayISO, toMinorFromRupees } from "./lib/money";
import { supabase, supabaseConfigured } from "./lib/supabase";
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  resolveInitialTheme,
  toggleTheme,
  type Theme,
} from "./lib/theme";
import { friendlyApiError, type BudgetCurrent, type Summary } from "@finance/api-client";

type Tab = "dashboard" | "accounts" | "transactions" | "budget";

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

const PIE_COLORS = ["#2dd4bf", "#38bdf8", "#a78bfa", "#fbbf24", "#fb7185", "#34d399", "#60a5fa", "#f472b6"];

export function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    return resolveInitialTheme(
      readStoredTheme(),
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
  });

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  function onToggleTheme() {
    setTheme((t) => toggleTheme(t));
  }
  const loadGen = useRef(0);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [budget, setBudget] = useState<BudgetCurrent | null>(null);

  const [accountName, setAccountName] = useState("Cash");
  const [accountType, setAccountType] = useState("CASH");
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  const [txType, setTxType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [txAmount, setTxAmount] = useState("");
  const [txCategory, setTxCategory] = useState<string>(CATEGORIES[0]);
  const [txNote, setTxNote] = useState("");
  const [txAccountId, setTxAccountId] = useState("");
  const [txDate, setTxDate] = useState(todayISO());
  const [txFilter, setTxFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const [txSearch, setTxSearch] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");

  const flash = (msg: string) => {
    setInfo(msg);
    window.setTimeout(() => setInfo(""), 2200);
  };

  const loadCore = useCallback(async () => {
    const gen = ++loadGen.current;
    setLoading(true);
    try {
      const [aRes, tRes] = await Promise.allSettled([api.listAccounts(), api.listTransactions()]);
      if (gen !== loadGen.current) return;
      if (aRes.status === "fulfilled") {
        const nextAccounts = (aRes.value.data as Account[]) ?? [];
        setAccounts(nextAccounts);
        setTxAccountId((prev) => prev || nextAccounts[0]?.id || "");
      }
      if (tRes.status === "fulfilled") {
        setTxs((tRes.value.data as Tx[]) ?? []);
      }
      const firstFail = [aRes, tRes].find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      if (firstFail) {
        setError(friendlyApiError(firstFail.reason));
      } else {
        setError("");
      }
    } catch (e) {
      if (gen === loadGen.current) setError(friendlyApiError(e));
    } finally {
      if (gen === loadGen.current) setLoading(false);
    }
  }, []);

  const loadDashboardExtras = useCallback(async () => {
    try {
      const [sRes, bRes] = await Promise.allSettled([api.summary(), api.getBudget()]);
      if (sRes.status === "fulfilled") setSummary(sRes.value.data);
      if (bRes.status === "fulfilled") {
        setBudget(bRes.value.data);
        if (bRes.value.data?.amountMinor) {
          setBudgetAmount(String(Number(bRes.value.data.amountMinor) / 100));
        }
      }
      const firstFail = [sRes, bRes].find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      if (firstFail && sRes.status === "rejected" && bRes.status === "rejected") {
        setError(friendlyApiError(firstFail.reason));
      } else if (firstFail) {
        console.warn("dashboard refresh failed", firstFail.reason);
      }
    } catch (e) {
      console.warn("dashboard refresh failed", e);
    }
  }, []);

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
      setBudget(null);
      setTxAccountId("");
      return;
    }
    void loadCore();
  }, [sessionEmail, loadCore]);

  useEffect(() => {
    if (!sessionEmail) return;
    if (tab === "dashboard" || tab === "budget") void loadDashboardExtras();
  }, [sessionEmail, tab, loadDashboardExtras]);

  const filteredTxs = useMemo(() => {
    return txs.filter((t) => {
      if (txFilter !== "ALL" && t.type !== txFilter) return false;
      if (!txSearch.trim()) return true;
      const q = txSearch.toLowerCase();
      return t.category.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q);
    });
  }, [txs, txFilter, txSearch]);

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
        type: accountType as "CASH" | "BANK" | "CREDIT_CARD" | "SAVINGS",
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

  async function saveBudget(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const amountMinor = toMinorFromRupees(budgetAmount);
      await api.setBudget(amountMinor);
      await loadDashboardExtras();
      flash("Budget updated");
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setBusy(false);
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

  function startEditAccount(a: Account) {
    setEditingAccountId(a.id);
    setAccountName(a.name);
    setAccountType(a.type);
  }

  if (!sessionEmail) {
    return (
      <div className="auth-wrap">
        <form className="auth-card" onSubmit={onSignIn}>
          <div className="brand-mark" />
          <span className="hero-kicker">Personal finance</span>
          <h1>FinanceApp</h1>
          <p className="sub">
            Clarity for money in motion — accounts, spending, and budgets in one calm workspace.
            {supabaseConfigured ? "" : " Missing Supabase env."}
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
            <button type="button" className="icon-toggle" onClick={onToggleTheme} aria-label="Toggle theme">
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" required />
          </div>
          <div className="field" style={{ marginTop: "0.75rem" }}>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="auth-actions">
            <button className="primary" type="submit" disabled={busy}>Sign in</button>
            <button className="secondary" type="button" disabled={busy} onClick={onSignUp}>Sign up</button>
          </div>
          {error ? (
        <div className="error banner-row" role="alert">
          <span>{error}</span>
          <div className="banner-actions">
            <button type="button" className="ghost" onClick={() => { setError(""); void loadCore(); void loadDashboardExtras(); }}>
              Retry
            </button>
            <button type="button" className="ghost" onClick={() => setError("")} aria-label="Dismiss">
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
          {info ? <p className="ok">{info}</p> : null}
          <p className="muted" style={{ marginTop: "1rem", fontSize: "0.8rem" }}>
            Demo: demo@financeapp.local / DemoPass123!
          </p>
        </form>
      </div>
    );
  }

  const budgetPct = Math.min(100, budget?.percentUsed ?? 0);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <h1>FinanceApp</h1>
            <p>{loading ? "Syncing your ledger…" : "Calm money, clear decisions"}</p>
          </div>
        </div>
        <nav className="nav" aria-label="Primary">
          {(
            [
              ["dashboard", "Dashboard"],
              ["accounts", "Accounts"],
              ["transactions", "Transactions"],
              ["budget", "Budget"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <button type="button" className="icon-toggle" onClick={onToggleTheme} aria-label="Toggle light and dark theme" title="Toggle theme">
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <div className="user-chip">
            <span>{sessionEmail}</span>
            <button className="ghost" type="button" onClick={() => supabase?.auth.signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {info ? <p className="ok">{info}</p> : null}

      {tab === "dashboard" ? (
        <div className="grid" style={{ gap: "1rem" }}>
          <div className="grid grid-4">
            <div className="card">
              <h3>Total balance</h3>
              <p className="stat-value display">{formatMinor(summary?.totalBalanceMinor ?? "0")}</p>
            </div>
            <div className="card">
              <h3>Income (month)</h3>
              <p className="stat-value display income">{formatMinor(summary?.monthIncomeMinor ?? "0")}</p>
            </div>
            <div className="card">
              <h3>Expenses (month)</h3>
              <p className="stat-value display expense">{formatMinor(summary?.monthExpenseMinor ?? "0")}</p>
            </div>
            <div className="card">
              <h3>Budget used</h3>
              <p className="stat-value display">{budgetPct.toFixed(0)}%</p>
              <div className="budget-bar"><span style={{ width: `${budgetPct}%` }} /></div>
            </div>
          </div>

          <div className="grid grid-2">
            <div className="card">
              <div className="section-head"><h2>Daily income vs expense</h2></div>
              <div className="chart-wrap">
                {dailyChart.length ? (
                  <ResponsiveContainer>
                    <BarChart data={dailyChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                      <XAxis dataKey="day" stroke="var(--muted)" />
                      <YAxis stroke="var(--muted)" />
                      <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--text)" }} />
                      <Bar dataKey="income" fill="#34d399" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="expense" fill="#fb7185" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty">Add transactions to see charts</div>
                )}
              </div>
            </div>
            <div className="card">
              <div className="section-head"><h2>Spend by category</h2></div>
              <div className="chart-wrap">
                {categoryChart.length ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={categoryChart} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                        {categoryChart.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--text)" }}
                        formatter={(v) => formatMinor(Math.round(Number(v) * 100))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty">No expenses this month</div>
                )}
              </div>
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
            <h2>{editingAccountId ? "Edit account" : "Add account"}</h2>
            <form className="row" onSubmit={editingAccountId ? saveAccountEdit : createAccount}>
              <div className="field">
                <label>Name</label>
                <input value={accountName} onChange={(e) => setAccountName(e.target.value)} required />
              </div>
              <div className="field">
                <label>Type</label>
                <select value={accountType} onChange={(e) => setAccountType(e.target.value)}>
                  <option value="CASH">Cash</option>
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
              <div key={a.id} className="card account-card">
                <span className="type">{a.type.replaceAll("_", " ")}</span>
                <h2 style={{ marginTop: "0.7rem" }}>{a.name}</h2>
                <div className="bal display">{formatMinor(a.balanceMinor, a.currency)}</div>
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
                <div key={t.id} className="tx-item">
                  <div>
                    <div className="cat">{t.category}</div>
                    <div className="meta">
                      {t.occurredOn} · {t.type}
                      {t.description ? ` · ${t.description}` : ""}
                    </div>
                  </div>
                  <div className={`badge ${t.type === "INCOME" ? "income" : "expense"}`}>
                    {t.type === "INCOME" ? "+" : "-"}
                    {formatMinor(String(Math.abs(Number(t.amountMinor))))}
                  </div>
                  <button className="icon-btn" type="button" onClick={() => removeTx(t.id)}>Delete</button>
                </div>
              ))}
              {!filteredTxs.length ? <div className="empty">No transactions yet</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "budget" ? (
        <div className="grid grid-2">
          <div className="card">
            <h2>Monthly budget</h2>
            <p className="muted">One overall budget for the current calendar month.</p>
            <form className="row" onSubmit={saveBudget} style={{ marginTop: "1rem" }}>
              <div className="field">
                <label>Budget amount (₹)</label>
                <input value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} placeholder="25000" required />
              </div>
              <div className="actions">
                <button className="primary" type="submit" disabled={busy}>Save budget</button>
              </div>
            </form>
          </div>
          <div className="card">
            <h3>This month</h3>
            <p className="stat-value display">{formatMinor(budget?.spentMinor ?? "0")} spent</p>
            <p className="muted">
              of {budget?.amountMinor ? formatMinor(budget.amountMinor) : "—"} ({budgetPct.toFixed(0)}%)
            </p>
            <div className="budget-bar"><span style={{ width: `${budgetPct}%` }} /></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
