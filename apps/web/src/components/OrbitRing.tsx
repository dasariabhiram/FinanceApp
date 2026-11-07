type Props = {
  pct: number;
  label: string;
  day: number;
  daysInMonth: number;
};

export function OrbitRing({ pct, label, day, daysInMonth }: Props) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <div className="orbit-ring" aria-label={`${label}: day ${day} of ${daysInMonth}`}>
      <svg viewBox="0 0 140 140" className="orbit-svg" aria-hidden="true">
        <circle className="orbit-track" cx="70" cy="70" r={r} />
        <circle
          className="orbit-fill"
          cx="70"
          cy="70"
          r={r}
          style={{ strokeDasharray: `${dash} ${c}` }}
        />
        <circle className="orbit-dot" cx="70" cy={70 - r} r="4" style={{ transformOrigin: "70px 70px", transform: `rotate(${(pct / 100) * 360}deg)` }} />
      </svg>
      <div className="orbit-core">
        <span className="orbit-pct num">{pct}%</span>
        <span className="orbit-sub">of month</span>
      </div>
    </div>
  );
}
