import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Share2, Loader2, X, Search as SearchIcon, GitFork } from 'lucide-react';
import { fetchGraph, type GraphData, type GraphNode } from '../lib/graph';
import { listCatalog, getLabelsets, relationGraph, type ResourceCard } from '../lib/nuclia';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/States';
import { useCurrentKb, useKbProfile } from '../lib/hooks';
import { cleanTitle } from '../lib/util';

type Mode = 'relations' | 'taxonomy';

export default function GraphPage() {
  const kb = useCurrentKb();
  const { profile } = useKbProfile();
  const [mode, setMode] = useState<Mode>('relations');
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [GV, setGV] = useState<null | typeof import('../components/graph/GraphView')['GraphView']>(null);
  useEffect(() => { import('../components/graph/GraphView').then((m) => setGV(() => m.GraphView)); }, []);
  useEffect(() => { setSelected(null); }, [mode, kb?.id]);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
      <PageHeader title="Knowledge graph"
        description={mode === 'relations'
          ? 'Entities and the relations ARAG extracted from your content (e.g. Adobe —developer→ AEM). Search a concept to explore its neighbourhood; click a node to recentre.'
          : 'Co-occurrence of this Knowledge Box’s classifications — node size = resource count, edges = co-occurrence.'}
        actions={
          <div className="inline-flex rounded-md border border-ink-200 bg-white p-0.5" role="group" aria-label="Graph mode">
            <button onClick={() => setMode('relations')} aria-pressed={mode === 'relations'}
              className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${mode === 'relations' ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100'}`}>Entity relations</button>
            <button onClick={() => setMode('taxonomy')} aria-pressed={mode === 'taxonomy'}
              className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${mode === 'taxonomy' ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100'}`}>Taxonomy</button>
          </div>
        } />

      {mode === 'relations'
        ? <RelationsGraph kb={kb} profile={profile} GV={GV} selected={selected} setSelected={setSelected} />
        : <TaxonomyGraph kb={kb} GV={GV} selected={selected} setSelected={setSelected} />}
    </div>
  );
}

// ---------------- Entity-relations mode (real GraphRAG) ----------------

function RelationsGraph({ kb, profile, GV, selected, setSelected }: {
  kb: ReturnType<typeof useCurrentKb>;
  profile: ReturnType<typeof useKbProfile>['profile'];
  GV: null | typeof import('../components/graph/GraphView')['GraphView'];
  selected: GraphNode | null;
  setSelected: (n: GraphNode | null) => void;
}) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the explorer with the KB's subject/topic so it isn't blank on arrival.
  // Re-seed if the profile revalidates (a stale cache can paint first) — but never
  // clobber a query the user typed themselves.
  const seededRef = useRef('');
  useEffect(() => {
    const seed = profile?.topics?.[0] || profile?.subject || '';
    if (!seed) return;
    if (!query || query === seededRef.current) { seededRef.current = seed; setInput(seed); setQuery(seed); }
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!query.trim()) { setData(null); return; }
    let active = true; const ctrl = new AbortController();
    setLoading(true); setError(null); setSelected(null);
    relationGraph(query, { signal: ctrl.signal })
      .then((g) => { if (active) setData({ primary: '', secondary: '', nodes: g.nodes, edges: g.edges }); })
      .catch((e) => { if (active) { setError(String(e).slice(0, 140)); setData(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; ctrl.abort(); };
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const relationsOf = (label: string) =>
    (data?.edges || []).filter((e) => e.source === label || e.target === label)
      .map((e) => (e.source === label ? { dir: '→', other: e.target, label: e.label } : { dir: '←', other: e.source, label: e.label }));

  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); setQuery(input); }} className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <SearchIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={input} onChange={(e) => setInput(e.target.value)} aria-label="Explore entity relations"
            placeholder="Explore relationships around a concept…" className="input pl-9" />
        </div>
        <button type="submit" className="btn-primary px-5">Explore</button>
      </form>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="card relative h-[600px] overflow-hidden">
          {loading || !GV ? (
            <div className="flex h-full items-center justify-center text-ink-400"><Loader2 className="animate-spin" /></div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-400">{error}</div>
          ) : data && data.nodes.length ? (
            <GV data={data} edgeLabels selected={selected?.id} onSelect={setSelected} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center text-ink-400">
              <GitFork size={26} className="text-ink-300" />
              <p className="mt-2 max-w-xs text-sm">No extracted relations for “{query}”. Try a named entity (a vendor, product, or person) that appears in your content.</p>
            </div>
          )}
        </div>

        <aside className="card flex h-[600px] flex-col overflow-hidden">
          {selected ? (
            <>
              <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
                <div className="min-w-0"><div className="t-overline">{selected.group}</div><div className="truncate font-semibold text-ink-900">{selected.label}</div></div>
                <button onClick={() => setSelected(null)} aria-label="Close" className="text-ink-400 hover:text-ink-700"><X size={16} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <button onClick={() => { setInput(selected.label); setQuery(selected.label); }}
                  className="mb-3 w-full rounded-md bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">Recentre on this entity</button>
                <div className="mb-1.5 t-overline">Relations</div>
                <ul className="space-y-1">
                  {relationsOf(selected.label).map((r, i) => (
                    <li key={i} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-700 hover:bg-ink-100">
                      <span className="text-ink-400">{r.dir}</span>
                      {r.label && <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-500">{r.label}</span>}
                      <span className="truncate">{r.other}</span>
                    </li>
                  ))}
                  {relationsOf(selected.label).length === 0 && <li className="px-2 text-xs text-ink-400">No direct relations in this view.</li>}
                </ul>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center text-ink-400">
              <Share2 size={26} className="text-ink-300" /><p className="mt-2 text-sm">Click a node to see its extracted relations.</p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

// ---------------- Taxonomy mode (classification co-occurrence) ----------------

function TaxonomyGraph({ kb, GV, selected, setSelected }: {
  kb: ReturnType<typeof useCurrentKb>;
  GV: null | typeof import('../components/graph/GraphView')['GraphView'];
  selected: GraphNode | null;
  setSelected: (n: GraphNode | null) => void;
}) {
  const [dims, setDims] = useState<{ id: string; title: string }[]>([]);
  const [primary, setPrimary] = useState('');
  const [secondary, setSecondary] = useState('');
  const [data, setData] = useState<GraphData | null>(null);
  const [loadingDims, setLoadingDims] = useState(true);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [resources, setResources] = useState<ResourceCard[]>([]);

  useEffect(() => {
    setLoadingDims(true); setData(null);
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
  }, [primary, secondary]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) { setResources([]); return; }
    listCatalog({ filters: [`/classification.labels/${selected.group}/${selected.label}`], size: 12 })
      .then((r) => setResources(r.resources)).catch(() => setResources([]));
  }, [selected]);

  const primaryTitle = dims.find((d) => d.id === primary)?.title || primary;
  const enoughDims = dims.length >= 2;

  if (loadingDims) return <div className="card mt-5 flex h-[600px] items-center justify-center"><Loader2 className="animate-spin text-ink-300" /></div>;
  if (!enoughDims) return (
    <div className="card mt-5">
      <EmptyState icon={<Share2 size={24} strokeWidth={1.75} />} title="Not enough taxonomy to graph"
        description={dims.length === 1
          ? 'This Knowledge Box has one labelset — add a second taxonomy in Taxonomy to draw a co-occurrence graph, or switch to Entity relations.'
          : 'This Knowledge Box has no classification labels yet. Add taxonomies, or switch to Entity relations for the extracted knowledge graph.'}
        action={<Link to="/taxonomy" className="btn-primary">Go to Taxonomy</Link>} />
    </div>
  );

  return (
    <>
      <div className="mt-4 flex items-center gap-2">
        <select aria-label="Primary axis" value={primary}
          onChange={(e) => { const np = e.target.value; setPrimary(np); if (np === secondary) { const alt = dims.find((d) => d.id !== np); if (alt) setSecondary(alt.id); } }}
          className="rounded-md border border-ink-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-700 outline-none focus:border-brand-500">
          {dims.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
        <span className="text-ink-400">↔</span>
        <select aria-label="Secondary axis" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="rounded-md border border-ink-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-700 outline-none focus:border-brand-500">
          {dims.filter((d) => d.id !== primary).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_320px]">
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
                <button onClick={() => setSelected(null)} aria-label="Close" className="text-ink-400 hover:text-ink-700"><X size={16} /></button>
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
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</span>;
}
