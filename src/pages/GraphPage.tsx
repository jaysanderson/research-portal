import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Share2, Loader2, X } from 'lucide-react';
import { fetchGraph, type GraphData, type GraphNode } from '../lib/graph';
import { listCatalog, getLabelsets, type ResourceCard } from '../lib/nuclia';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/States';
import { useCurrentKb } from '../lib/hooks';
import { cleanTitle } from '../lib/util';

export default function GraphPage() {
  const kb = useCurrentKb();
  const [dims, setDims] = useState<{ id: string; title: string }[]>([]);
  const [primary, setPrimary] = useState('');
  const [secondary, setSecondary] = useState('');
  const [data, setData] = useState<GraphData | null>(null);
  const [loadingDims, setLoadingDims] = useState(true);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [resources, setResources] = useState<ResourceCard[]>([]);
  const [GV, setGV] = useState<null | typeof import('../components/graph/GraphView')['GraphView']>(null);

  useEffect(() => { import('../components/graph/GraphView').then((m) => setGV(() => m.GraphView)); }, []);

  // Discover the KB's taxonomies (whatever they are) when it changes.
  useEffect(() => {
    setLoadingDims(true); setData(null); setSelected(null);
    getLabelsets().then((ls) => {
      const arr = Object.entries(ls).map(([id, v]) => ({ id, title: v.title || id }));
      setDims(arr);
      if (arr.length >= 2) { setPrimary(arr[0].id); setSecondary(arr[1].id); }
      else { setPrimary(arr[0]?.id || ''); setSecondary(''); }
    }).catch(() => setDims([])).finally(() => setLoadingDims(false));
  }, [kb?.id]);

  useEffect(() => {
    if (!primary || !secondary) return;
    setLoadingGraph(true); setSelected(null);
    fetchGraph(primary, secondary).then(setData).catch(() => setData(null)).finally(() => setLoadingGraph(false));
  }, [primary, secondary]);

  useEffect(() => {
    if (!selected) { setResources([]); return; }
    listCatalog({ filters: [`/classification.labels/${selected.group}/${selected.label}`], size: 12 })
      .then((r) => setResources(r.resources)).catch(() => setResources([]));
  }, [selected]);

  const primaryTitle = dims.find((d) => d.id === primary)?.title || primary;
  const enoughDims = dims.length >= 2;

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
      <PageHeader title="Knowledge graph"
        description="Relationship graph from this Knowledge Box’s classifications — node size = resource count, edges = co-occurrence."
        actions={enoughDims ? (
          <div className="flex items-center gap-2">
            <span className="t-overline mr-1">{primaryTitle} ↔</span>
            <select value={secondary} onChange={(e) => setSecondary(e.target.value)} className="rounded-md border border-ink-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-700 outline-none focus:border-brand-500">
              {dims.filter((d) => d.id !== primary).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </div>
        ) : undefined} />

      {loadingDims ? (
        <div className="card flex h-[600px] items-center justify-center"><Loader2 className="animate-spin text-ink-300" /></div>
      ) : !enoughDims ? (
        <div className="card">
          <EmptyState icon={<Share2 size={24} strokeWidth={1.75} />} title="Not enough taxonomy to graph"
            description={dims.length === 1
              ? 'This Knowledge Box has one labelset — add a second taxonomy (e.g. topic or category) in Taxonomy to draw a relationship graph.'
              : 'This Knowledge Box has no classification labels yet. Add taxonomies in the Taxonomy section to build a knowledge graph.'}
            action={<Link to="/taxonomy" className="btn-primary">Go to Taxonomy</Link>} />
        </div>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="card relative h-[600px] overflow-hidden">
            {loadingGraph || !GV ? (
              <div className="flex h-full items-center justify-center text-ink-400"><Loader2 className="animate-spin" /></div>
            ) : data && data.nodes.length ? (
              <GV data={data} selected={selected?.id} onSelect={setSelected} />
            ) : (
              <div className="flex h-full items-center justify-center text-ink-400">No connections found between these taxonomies.</div>
            )}
            <div className="absolute bottom-3 left-3 flex gap-3 rounded-lg bg-white/90 px-3 py-1.5 text-xs shadow-sm">
              <Legend color="#1A6A4F" label={primaryTitle} />
              <Legend color="#C8861A" label={dims.find((d) => d.id === secondary)?.title || secondary} />
            </div>
          </div>

          <aside className="card flex h-[600px] flex-col overflow-hidden">
            {selected ? (
              <>
                <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
                  <div className="min-w-0"><div className="t-overline">{selected.group}</div><div className="truncate font-semibold text-ink-900">{selected.label}</div></div>
                  <button onClick={() => setSelected(null)} className="text-ink-400 hover:text-ink-700"><X size={16} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <div className="mb-2 text-xs text-ink-400">{selected.weight} resources</div>
                  <ul className="space-y-1">
                    {resources.map((r) => <li key={r.id}><Link to={`/knowledge/${r.id}`} className="block truncate rounded-md px-2 py-1.5 text-sm text-ink-700 hover:bg-ink-100">{cleanTitle(r.title)}</Link></li>)}
                  </ul>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center text-ink-400">
                <Share2 size={26} className="text-ink-300" /><p className="mt-2 text-sm">Click a node to explore the resources behind it.</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</span>;
}
