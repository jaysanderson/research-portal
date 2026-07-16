import { useEffect, useState } from 'react';

const color = (s: number) => (s >= 0.7 ? '#10B981' : s >= 0.4 ? '#F0A81E' : '#EF6A4D');
const labelFor = (s: number) => (s >= 0.7 ? 'Strong match' : s >= 0.4 ? 'Moderate match' : 'Weak match');

/** Animated SVG confidence ring that draws to `score` (0–1) and counts the % up. */
export function ConfidenceRing({ score, size = 132 }: { score: number; size?: number }) {
  const pct = Math.round(Math.min(Math.max(score, 0), 1) * 100);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min((t - start) / 900, 1);
      setShown(Math.round(pct * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pct]);

  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const stroke = color(score);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={9} className="text-white/15" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke} strokeWidth={9} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (shown / 100) * c} style={{ transition: 'stroke-dashoffset 0.1s linear' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="text-3xl font-bold tabular-nums">{shown}%</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: stroke }}>{labelFor(score)}</span>
      </div>
    </div>
  );
}
