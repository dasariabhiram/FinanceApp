import type { Theme } from "./theme";
import { applyTheme, persistTheme } from "./theme";

export function toggleThemeWithTransition(
  current: Theme,
  next: Theme,
  origin?: { x: number; y: number },
) {
  const root = document.documentElement;
  const apply = () => {
    applyTheme(next);
    persistTheme(next);
  };

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  };

  if (reduced || !doc.startViewTransition) {
    apply();
    return;
  }

  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 2;
  const maxR = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  root.style.setProperty("--vt-x", `${x}px`);
  root.style.setProperty("--vt-y", `${y}px`);
  root.style.setProperty("--vt-r", `${maxR}px`);

  doc.startViewTransition(apply);
}
