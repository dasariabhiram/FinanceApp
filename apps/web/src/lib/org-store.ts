const KEY = "financeapp:active-org";

let activeOrgId: string | null = null;

export function getActiveOrgId(): string | null {
  if (activeOrgId) return activeOrgId;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setActiveOrgId(id: string | null) {
  activeOrgId = id;
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
