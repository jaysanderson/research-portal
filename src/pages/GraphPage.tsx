import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Share2, Loader2, X } from 'lucide-react';
import { fetchGraph, type GraphData, type GraphNode } from '../lib/graph';
import { listCatalog, type ResourceCard } from '../lib/nuclia';
import { PageHeader } from '../components/PageHeader';

const SECONDARIES = [
  { id: 'topic', label: 'Topics' },
  { id: 'resource-type', label: 'Resource types' },
];

export default function GraphPage() {
  const [secondary, setSecondary] = useState('topic');
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [resources, setResources] = useState<ResourceCard[]>([]);
  const [resLoading, setResLoading] = useState(false);
  const [GV, setGV] = useState<null | typeof import('../components/graph/GraphView')['GraphView']>(null);

  // lazy-load d3 view (keeps initial bundle lean)
  useEffect(() => { import('../components/graph/GraphView').then((m) => setGV(() => m.GraphView)); }, []);

  useEffect(() => {
    setLoading(true); setSelected(null);
    fetchGraph('vendor', secondary).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [secondary]);

  useEffect(() => {
    if (!selected) { setResources([]); return; }
    const group = selected.group;
    const filter = `/classification.labels/${group}/${selected.label}`;
    setResLoading(true);
    listCatalog({ filters: [filter], size: 12 }).then((r) => setResources(r.resources)).catch(() => setResources([])).finally(() => setResLoading(false));
  }, [selected]);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
      <PageHeader title="Knowledge graph"
        description="Relationship graph derived from real corpus classifications — node size = resource count, edge weight = co-occurrence."
        actions={
          <div className="flex items-center gap-2">
            <span className="t-overline mr-1">Vendors ↔</span>
            <div className="inline-flex rounded-md border border-ink-200 bg-white p-0.5">
              {SECONDARIES.map((s) => (
                <button key={s.id} onClick={() => setSecondary(s.id)} aria-pressed={secondary === s.id}
                  className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${secondary === s.id ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100'}`}>{s.label}</button>
              ))}
            </div>
          </div>
        } />

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="card relative h-[600px] overflow-hidden">
          {loading || !GV ? (
            <div className="flex h-full items-center justify-center text-ink-400"><Loader2 className="animate-spin" /></div>
          ) : data && data.nodes.length ? (
            <GV data={data} selected={selected?.id} onSelect={setSelected} />
          ) : (
            <div className="flex h-full items-center justify-center text-ink-400">No graph data.</div>
          )}
          <div className="absolute bottom-3 left-3 flex gap-3 rounded-lg bg-white/90 px-3 py-1.5 text-xs shadow-sm">
            <Legend color="#1A6A4F" label="Vendor" />
            <Legend color={secondary === 'topic' ? '#C8861A' : '#B5543F'} label={secondary === 'topic' ? 'Topic' : 'Type'} />
          </div>
        </div>

        <aside className="card flex h-[600px] flex-col overflow-hidden">
          {selected ? (
            <>
              <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">{selected.group}</div>
                  <div className="truncate font-semibold text-ink-900">{selected.label}</div>
                </div>
                <button onClick={() => setSelected(null)} className="text-ink-400 hover:text-ink-700"><X size={16} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <div className="mb-2 text-xs text-ink-400">{selected.weight} resources</div>
                {resLoading ? (
                  <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
                ) : (
                  <ul className="space-y-1">
                    {resources.map((r) => (
                      <li key={r.id}><Link to={`/knowledge/${r.id}`} className="block truncate rounded-md px-2 py-1.5 text-sm text-ink-700 hover:bg-ink-100">{r.title}</Link></li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center text-ink-400">
              <Share2 size={26} className="text-ink-300" />
              <p className="mt-2 text-sm">Click a node to explore the resources behind it.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</span>;
}
