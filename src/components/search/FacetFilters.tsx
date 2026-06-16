import { useEffect, useState } from 'react';
import { getFacets, getLabelsets } from '../../lib/nuclia';

const ORDER = ['vendor', 'resource-type', 'topic'];

export function FacetFilters({ selected, onToggle, onClear }: {
  selected: string[];
  onToggle: (filter: string) => void;
  onClear: () => void;
}) {
  const [groups, setGroups] = useState<{ id: string; title: string; values: [string, number][] }[]>([]);

  useEffect(() => {
    (async () => {
      const ls = await getLabelsets().catch(() => ({}));
      const ids = ORDER.filter((id) => id in ls).concat(Object.keys(ls).filter((id) => !ORDER.includes(id)));
      const out = await Promise.all(ids.map(async (id) => {
        const counts = await getFacets(id).catch(() => ({}));
        return { id, title: ls[id]?.title || id, values: Object.entries(counts).sort((a, b) => b[1] - a[1]) };
      }));
      setGroups(out.filter((g) => g.values.length));
    })();
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-800">Filters</h3>
        {selected.length > 0 && <button onClick={onClear} className="text-xs text-brand-600 hover:underline">Clear ({selected.length})</button>}
      </div>
      {groups.map((g) => (
        <FacetGroup key={g.id} group={g} selected={selected} onToggle={onToggle} />
      ))}
      {groups.length === 0 && <p className="text-xs text-ink-400">No labels yet.</p>}
    </div>
  );
}

function FacetGroup({ group, selected, onToggle }: {
  group: { id: string; title: string; values: [string, number][] };
  selected: string[];
  onToggle: (f: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? group.values : group.values.slice(0, 6);
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-400">{group.title}</div>
      <ul className="space-y-0.5">
        {shown.map(([label, count]) => {
          const filter = `/classification.labels/${group.id}/${label}`;
          const on = selected.includes(filter);
          return (
            <li key={label}>
              <button onClick={() => onToggle(filter)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors ${
                  on ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100'}`}>
                <span className={`h-3.5 w-3.5 shrink-0 rounded border ${on ? 'border-brand-600 bg-brand-600' : 'border-ink-300'}`}>
                  {on && <svg viewBox="0 0 12 12" className="h-3 w-3 text-white"><path fill="currentColor" d="M4.5 8L2 5.5l.9-.9L4.5 6.2 9.1 1.6l.9.9z" /></svg>}
                </span>
                <span className="truncate">{label}</span>
                <span className="ml-auto text-xs text-ink-400">{count}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {group.values.length > 6 && (
        <button onClick={() => setExpanded((x) => !x)} className="mt-1 text-xs text-brand-600 hover:underline">
          {expanded ? 'Show less' : `Show all ${group.values.length}`}
        </button>
      )}
    </div>
  );
}
