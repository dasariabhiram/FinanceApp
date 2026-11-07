import { useEffect, useMemo, useState } from "react";
import { currentMonthYM, formatMonthLabel, monthRangeFromYM } from "./money";

export function useLiveMonth(onMonthChange?: (ym: string) => void) {
  const [liveMonthYm, setLiveMonthYm] = useState(() => currentMonthYM());
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => {
      const ym = currentMonthYM();
      const next = new Date();
      setNow(next);
      setLiveMonthYm((prev) => {
        if (prev !== ym) {
          onMonthChange?.(ym);
          return ym;
        }
        return prev;
      });
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [onMonthChange]);

  const progress = useMemo(() => {
    const y = now.getFullYear();
    const m = now.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const day = now.getDate();
    const pct = Math.min(100, Math.round((day / daysInMonth) * 100));
    return {
      day,
      daysInMonth,
      pct,
      label: formatMonthLabel(liveMonthYm),
    };
  }, [now, liveMonthYm]);

  const monthWindow = useMemo(() => monthRangeFromYM(liveMonthYm), [liveMonthYm]);

  return { liveMonthYm, progress, monthWindow };
}
