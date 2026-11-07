import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../lib/visual-capability";

type Props = {
  value: number;
  format: (n: number) => string;
  className?: string;
};

export function AnimatedNumber({ value, format, className }: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion() || fromRef.current === value) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const to = value;
    const start = performance.now();
    const dur = 700;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <span className={className}>{format(display)}</span>;
}
