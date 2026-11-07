import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Organization } from "@finance/contracts";
import { friendlyApiError } from "@finance/api-client";
import { api } from "../lib/api";

export function AdminApp() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const me = await api.adminMe();
      if (!me.data?.platformAdmin) {
        setAllowed(false);
        return;
      }
      setAllowed(true);
      const res = await api.listAdminOrgs();
      setOrgs(res.data ?? []);
    } catch (e) {
      setAllowed(false);
      setError(friendlyApiError(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.createAdminOrg({ name: name.trim(), slug: slug.trim().toLowerCase(), ownerEmail: ownerEmail.trim() });
      setName("");
      setSlug("");
      setOwnerEmail("");
      await load();
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(org: Organization) {
    const next = org.status === "active" ? "suspended" : "active";
    try {
      await api.updateOrgStatus(org.id, next);
      await load();
    } catch (err) {
      setError(friendlyApiError(err));
    }
  }

  if (allowed === null) return <div className="app-shell padded">Loading admin…</div>;
  if (!allowed) {
    return (
      <div className="app-shell padded">
        <p className="error">{error || "Platform admin access required"}</p>
        <Link className="secondary" to="/">Back to app</Link>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>Platform admin</h1>
        <Link className="ghost" to="/">Customer app</Link>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <div className="grid grid-2" style={{ gap: "1rem" }}>
        <div className="card">
          <h2>Onboard tenant</h2>
          <form className="row" onSubmit={onCreate}>
            <div className="field">
              <label>Organization name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Slug</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="e.g. abhidasari" required />
            </div>
            <div className="field">
              <label>Owner email</label>
              <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required />
            </div>
            <button className="primary" type="submit" disabled={busy}>Create & invite</button>
          </form>
        </div>
        <div className="card">
          <h2>Tenants</h2>
          <div className="tx-list">
            {orgs.map((o) => (
              <div key={o.id} className="tx-item">
                <div>
                  <div className="cat">{o.name}</div>
                  <div className="meta">{o.slug} · {o.status}</div>
                </div>
                <button className="secondary" type="button" onClick={() => toggleStatus(o)}>
                  {o.status === "active" ? "Suspend" : "Activate"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
