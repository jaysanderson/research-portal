import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight } from 'lucide-react';
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

export function RemiGauge({ remi }: { remi: RemiScore | null }) {
  // No dead gauge: when REMi isn't available, invite the user to enable it.
  if (!remi) {
    return (
      <div className="card border-brand-100 bg-brand-50/40 p-4">
        <div className="mb-1.5 flex items-center gap-2 text-brand-700"><ShieldCheck size={15} /><span className="t-h3 text-brand-800">Answer quality scoring</span></div>
        <p className="text-xs leading-relaxed text-ink-600">
          Connect an ARAG Retrieval Agent to score every answer for <strong>relevance</strong> and <strong>groundedness</strong> (REMi), and to fan out across web, SQL, graph and MCP drivers.
        </p>
        <Link to="/settings" className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
          How to enable <ArrowRight size={13} />
        </Link>
      </div>
    );
  }
  return (
    <div className="card p-4">
      <div className="mb-3 t-overline">REMi quality</div>
      <div className="space-y-3">
        <Bar label="Answer relevance" value={pct(remi.relevance)} />
        <Bar label="Groundedness" value={pct(remi.groundedness)} />
      </div>
    </div>
  );
}
