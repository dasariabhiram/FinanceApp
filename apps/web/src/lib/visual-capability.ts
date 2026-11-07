export type VisualEffectsPref = "auto" | "on" | "off";

const STORAGE_KEY = "financeapp-visual-effects";

export function readVisualEffectsPref(): VisualEffectsPref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "auto" || v === "on" || v === "off") return v;
  } catch {
    /* ignore */
  }
  return "auto";
}

export function persistVisualEffectsPref(pref: VisualEffectsPref) {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** True when we should run the interactive hero canvas. */
export function canRunHeroEffects(pref: VisualEffectsPref = readVisualEffectsPref()): boolean {
  if (typeof window === "undefined") return false;
  if (pref === "off") return false;
  if (prefersReducedMotion()) return false;
  if (pref === "on") return true;

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  if (nav.connection?.saveData) return false;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 4) return false;
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency < 4) return false;

  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}
