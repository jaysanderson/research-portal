import type { RemiScore } from '../../lib/agentic';

function pct(v?: number) { if (v == null) return null; return v <= 1 ? Math.round(v * 100) : Math.round(v); }

function Bar({ label, value }: { label: string; value: number | null }) {
  const color = value == null ? 'bg-ink-200' : value >= 80 ? 'bg-brand-500' : value >= 60 ? 'bg-accent-400' : 'bg-data-clay';
  return (
    <div>
      <div className="flex items-center justify-between text-xs"><span className="text-ink-600">{label}</span>
        <span className="font-semibold tabular-nums text-ink-800">{value == null ? '—' : `${value}%`}</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
}

export function RemiGauge({ remi }: { remi: RemiScore | null; connected?: boolean }) {
  // REMi is scored live for every turn; a null here means the predict pass didn't run
  // (e.g. no answer/context) — neutral, not an upsell.
  if (!remi) {
    return (
      <div className="card p-4">
        <div className="mb-2 t-overline">REMi quality</div>
        <p className="text-xs text-ink-500">Not scored for this turn.</p>
      </div>
    );
  }
  return (
    <div className="card p-4">
      <div className="mb-3 t-overline">REMi quality</div>
      <div className="space-y-3">
        <Bar label="Answer relevance" value={pct(remi.relevance)} />
        <Bar label="Context relevance" value={pct(remi.contextRelevance)} />
        <Bar label="Groundedness" value={pct(remi.groundedness)} />
      </div>
    </div>
  );
}
