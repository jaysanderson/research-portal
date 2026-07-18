import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Layers, Hash, Database, MessageSquare, Coins, Clock, Tags, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getCounters, getFacets, getSourceHealth, getLabelsets, type Counters, type SourceHealth } from '../lib/nuclia';
import { loadTraces } from '../lib/agentic';
import { loadQueries, topQueries } from '../lib/querylog';
import { BarList } from '../components/BarList';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/States';
import { useCurrentKb } from '../lib/hooks';

const COLORS = ['#2F31D8', '#F0A81E', '#10B981', '#8B5CF6', '#0EA5E9', '#EF6A4D'];

export default function AnalyticsPage() {
  const kb = useCurrentKb();
  const [counters, setCounters] = useState<Counters | null>(null);
  const [health, setHealth] = useState<SourceHealth | null>(null);
  const [dists, setDists] = useState<{ id: string; title: string; data: [string, number][] }[]>([]);
  const [loadingDist, setLoadingDist] = useState(true);

  useEffect(() => {
    setCounters(null); setHealth(null); setLoadingDist(true);
    getCounters().then(setCounters).catch(() => {});
    getSourceHealth().then(setHealth).catch(() => {});
    getLabelsets().then(async (ls) => {
      const ids = Object.keys(ls);
      const out = await Promise.all(ids.map(async (id) => ({
        id, title: ls[id].title || id,
        data: Object.entries(await getFacets(id).catch(() => ({}))).sort((a, b) => b[1] - a[1]).slice(0, 10) as [string, number][],
      })));
      setDists(out.filter((d) => d.data.length));
    }).catch(() => setDists([])).finally(() => setLoadingDist(false));
  }, [kb?.id]);

  const traces = loadTraces(kb?.id);
  const totalTokens = traces.reduce((s, t) => s + (t.consumption?.inputTokens || 0) + (t.consumption?.outputTokens || 0), 0);
  const avgDur = traces.length ? traces.reduce((s, t) => s + (t.durationMs || 0), 0) / traces.length / 1000 : 0;
  const counts = health?.counts || {};
  const total = health?.total || 0;
  const processed = counts['PROCESSED'] || 0;
  const pct = total ? Math.round((processed / total) * 100) : 0;
  const problems = health?.problems || [];

  const topQ = topQueries(loadQueries()).slice(0, 8);
  const zeroQ = topQ.filter((q) => q.results === 0);
  const remiTraces = traces.filter((t) => t.remi && (t.remi.relevance != null || t.remi.groundedness != null));
  const remiAvg = (sel: (r: NonNullable<typeof traces[number]['remi']>) => number | undefined) =>
    remiTraces.length ? Math.round((remiTraces.reduce((s, t) => s + (sel(t.remi!) ?? 0), 0) / remiTraces.length) * 100) : null;
  const avgRel = remiAvg((r) => r.relevance);
  const avgGnd = remiAvg((r) => r.groundedness);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <PageHeader title="Analytics" description={`Live health, content distribution, and usage${kb ? ` for ${kb.name}` : ''}.`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<FileText size={18} />} label="Resources" value={counters?.resources} />
        <Stat icon={<Layers size={18} />} label="Paragraphs" value={counters?.paragraphs} />
        <Stat icon={<Hash size={18} />} label="Sentences" value={counters?.sentences} />
        <Stat icon={<Database size={18} />} label="Index MB" value={counters ? Math.round(counters.index_size / 1e6) : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Source health">
          <div className="mb-3 flex items-center gap-2 text-sm"><span className="font-bold text-brand-600">{pct}%</span><span className="text-ink-500">indexed · {total.toLocaleString()} resources</span></div>
          <BarList color="#2F31D8" data={Object.entries(counts).sort((a, b) => b[1] - a[1])} />
          {problems.length > 0 ? (
            <div className="mt-3 border-t border-ink-100 pt-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-700"><AlertTriangle size={13} /> {problems.length} need attention</div>
              <ul className="max-h-44 space-y-1 overflow-y-auto">
                {problems.slice(0, 25).map((p) => (
                  <li key={p.id}><Link to={`/knowledge/${p.id}`} className="flex items-center gap-2 text-xs text-ink-600 hover:text-brand-700">
                    <span className="chip shrink-0 bg-accent-50 text-accent-700">{p.status}</span><span className="truncate">{p.title}</span>
                  </Link></li>
                ))}
              </ul>
            </div>
          ) : total > 0 && (
            <div className="mt-3 flex items-center gap-1.5 border-t border-ink-100 pt-3 text-xs text-brand-700"><CheckCircle2 size={13} /> All resources processed cleanly.</div>
          )}
        </Card>
        <Card title="Agentic usage (this device)">
          <div className="grid grid-cols-3 gap-3">
            <Mini icon={<MessageSquare size={16} />} label="Queries" value={traces.length} />
            <Mini icon={<Coins size={16} />} label="Tokens" value={totalTokens.toLocaleString()} />
            <Mini icon={<Clock size={16} />} label="Avg s" value={avgDur ? avgDur.toFixed(1) : '—'} />
          </div>
          <div className="mt-3 text-xs text-ink-400">Local to this browser. Production aggregates server-side across users.</div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Search insights (this device)">
          {topQ.length === 0 ? (
            <p className="text-sm text-ink-400">Run a few searches to see your top queries and content gaps here.</p>
          ) : (
            <>
              <ul className="space-y-1">
                {topQ.map((q) => (
                  <li key={q.q} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-ink-700">{q.q}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${q.results === 0 ? 'bg-accent-50 text-accent-700' : 'bg-ink-100 text-ink-500'}`}>
                      {q.results === 0 ? 'no results' : `${q.results} hits`} · ×{q.count}
                    </span>
                  </li>
                ))}
              </ul>
              {zeroQ.length > 0 && (
                <div className="mt-3 flex items-center gap-1.5 border-t border-ink-100 pt-3 text-xs text-accent-700">
                  <AlertTriangle size={13} /> {zeroQ.length} query{zeroQ.length === 1 ? '' : 's'} returned nothing — content gaps to fill.
                </div>
              )}
            </>
          )}
        </Card>
        <Card title="Answer quality trend (REMi)">
          {remiTraces.length === 0 ? (
            <p className="text-sm text-ink-400">Run an Agentic query to capture REMi relevance & groundedness scores.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Mini icon={<CheckCircle2 size={16} />} label="Avg relevance" value={avgRel == null ? '—' : `${avgRel}%`} />
                <Mini icon={<CheckCircle2 size={16} />} label="Avg groundedness" value={avgGnd == null ? '—' : `${avgGnd}%`} />
              </div>
              <div className="mt-3 flex items-end gap-1" aria-hidden>
                {remiTraces.slice(0, 24).reverse().map((t, i) => {
                  const v = Math.round(((t.remi!.groundedness ?? t.remi!.relevance ?? 0)) * 100);
                  return <span key={i} title={`${v}%`} className="flex-1 rounded-sm bg-brand-400" style={{ height: `${Math.max(4, v * 0.42)}px` }} />;
                })}
              </div>
              <div className="mt-1 text-[10px] uppercase text-ink-400">Groundedness · last {Math.min(remiTraces.length, 24)} answers</div>
            </>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <div className="mb-3 t-overline">Content distribution</div>
        {loadingDist ? (
          <div className="grid gap-6 lg:grid-cols-2">{[0, 1].map((i) => <div key={i} className="skeleton h-48 rounded-xl" />)}</div>
        ) : dists.length === 0 ? (
          <div className="card">
            <EmptyState compact icon={<Tags size={22} strokeWidth={1.75} />} title="No taxonomy yet"
              description="This Knowledge Box has no classification labels, so there’s nothing to chart here. Add labelsets in Taxonomy to unlock distributions." />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {dists.map((d, i) => <Card key={d.id} title={`Resources by ${d.title.toLowerCase()}`}><BarList color={COLORS[i % COLORS.length]} data={d.data} /></Card>)}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value?: number }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-ink-400">{icon}<span className="t-overline">{label}</span></div>
      <div className="mt-2 stat-value">{value == null ? <span className="skeleton inline-block h-7 w-16 align-middle" /> : value.toLocaleString()}</div>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card p-5"><div className="mb-3 t-overline">{title}</div>{children}</div>;
}
function Mini({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return <div className="rounded-md bg-ink-50 p-3"><div className="flex items-center gap-1.5 text-ink-400">{icon}</div><div className="mt-1 text-lg font-bold text-ink-900">{value}</div><div className="text-[10px] uppercase text-ink-400">{label}</div></div>;
}
