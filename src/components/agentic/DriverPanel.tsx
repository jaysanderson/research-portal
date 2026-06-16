import { Database, Globe, Wrench, Share2 } from 'lucide-react';
import { DRIVER_CATALOG, type DriverInfo } from '../../lib/aragAgent';

const ICON: Record<DriverInfo['category'], React.ReactNode> = {
  kb: <Database size={13} />, web: <Globe size={13} />, data: <Database size={13} />,
  tool: <Wrench size={13} />, reason: <Share2 size={13} />,
};

export function DriverPanel({ activeModules, aragConfigured }: { activeModules: Set<string>; aragConfigured: boolean }) {
  return (
    <div className="card p-4">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-400">Retrieval drivers</div>
      <p className="mb-3 text-[11px] text-ink-400">
        {aragConfigured ? 'Drivers the agent can fan out across. Lit = used this turn.' : 'Available when an ARAG agent is connected. The Knowledge Box driver is always active.'}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {DRIVER_CATALOG.map((d) => {
          const active = activeModules.has(d.id) || (d.id === 'nucliadb' && !aragConfigured);
          const available = aragConfigured || d.id === 'nucliadb';
          return (
            <span key={d.id} title={d.desc}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                active ? 'border-brand-400 bg-brand-50 text-brand-700'
                : available ? 'border-ink-200 bg-white text-ink-600' : 'border-dashed border-ink-200 bg-ink-50 text-ink-400'}`}>
              {ICON[d.category]}{d.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
