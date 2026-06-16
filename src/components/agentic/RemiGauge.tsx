import type { RemiScore } from '../../lib/agentic';

function pct(v?: number) {
  if (v == null) return null;
  return v <= 1 ? Math.round(v * 100) : Math.round(v);
}

function Bar({ label, value }: { label: string; value: number | null }) {
  const color = value == null ? 'bg-ink-200' : value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div>
      <div className="flex items-center justify-between text-xs"><span className="text-ink-500">{label}</span>
        <span className="font-bold text-ink-800">{value == null ? '—' : `${value}%`}</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
}

export function RemiGauge({ remi }: { remi: RemiScore | null }) {
  return (
    <div className="card p-4">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-ink-400">REMi quality</div>
      <div className="space-y-3">
        <Bar label="Answer relevance" value={pct(remi?.relevance)} />
        <Bar label="Groundedness" value={pct(remi?.groundedness)} />
      </div>
      {!remi && <p className="mt-2 text-[11px] text-ink-400">Available with a connected ARAG agent.</p>}
    </div>
  );
}
