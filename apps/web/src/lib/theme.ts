const STORAGE_KEY = "financeapp-theme";

export type Theme = "light" | "dark";

export function resolveInitialTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return prefersDark ? "dark" : "light";
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement) {
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? "#0c1220" : "#f4f7fb");
  }
}

export function persistTheme(theme: Theme, storage: Storage = localStorage) {
  storage.setItem(STORAGE_KEY, theme);
}

export function readStoredTheme(storage: Storage = localStorage): string | null {
  try {
    return storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function toggleTheme(current: Theme): Theme {
  return current === "light" ? "dark" : "light";
}

export { STORAGE_KEY };
