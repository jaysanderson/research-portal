import { useEffect, useState } from 'react';
import { FileText, Layers, Hash, Database, MessageSquare, Coins, Clock } from 'lucide-react';
import { getCounters, getFacets, getStatusCounts, type Counters } from '../lib/nuclia';
import { loadTraces } from '../lib/agentic';
import { BarList } from '../components/BarList';
import { PageHeader } from '../components/PageHeader';

export default function AnalyticsPage() {
  const [counters, setCounters] = useState<Counters | null>(null);
  const [vendor, setVendor] = useState<[string, number][]>([]);
  const [rtype, setRtype] = useState<[string, number][]>([]);
  const [topic, setTopic] = useState<[string, number][]>([]);
  const [status, setStatus] = useState<Record<string, number>>({});

  useEffect(() => {
    getCounters().then(setCounters).catch(() => {});
    getFacets('vendor').then((f) => setVendor(Object.entries(f).sort((a, b) => b[1] - a[1]))).catch(() => {});
    getFacets('resource-type').then((f) => setRtype(Object.entries(f).sort((a, b) => b[1] - a[1]))).catch(() => {});
    getFacets('topic').then((f) => setTopic(Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, 10))).catch(() => {});
    getStatusCounts().then(setStatus).catch(() => {});
  }, []);

  const traces = loadTraces();
  const totalTokens = traces.reduce((s, t) => s + (t.consumption?.inputTokens || 0) + (t.consumption?.outputTokens || 0), 0);
  const avgDur = traces.length ? traces.reduce((s, t) => s + (t.durationMs || 0), 0) / traces.length / 1000 : 0;
  const processed = status['PROCESSED'] || 0;
  const totalStatus = Object.values(status).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <PageHeader title="Analytics" description="Live Knowledge Box health, content distribution, and agentic usage." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<FileText size={18} />} label="Resources" value={counters?.resources} />
        <Stat icon={<Layers size={18} />} label="Paragraphs" value={counters?.paragraphs} />
        <Stat icon={<Hash size={18} />} label="Sentences" value={counters?.sentences} />
        <Stat icon={<Database size={18} />} label="Index MB" value={counters ? Math.round(counters.index_size / 1e6) : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Indexing health">
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span className="font-bold text-emerald-600">{Math.round((processed / totalStatus) * 100)}%</span>
            <span className="text-ink-500">indexed</span>
          </div>
          <BarList color="#237D5E" data={Object.entries(status).sort((a, b) => b[1] - a[1])} />
        </Card>
        <Card title="Agentic usage (this device)">
          <div className="grid grid-cols-3 gap-3">
            <Mini icon={<MessageSquare size={16} />} label="Queries" value={traces.length} />
            <Mini icon={<Coins size={16} />} label="Tokens" value={totalTokens.toLocaleString()} />
            <Mini icon={<Clock size={16} />} label="Avg s" value={avgDur ? avgDur.toFixed(1) : '—'} />
          </div>
          <div className="mt-3 text-xs text-ink-400">Trace-derived. In production these aggregate server-side across users.</div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Resources by vendor"><BarList data={vendor} /></Card>
        <Card title="Resources by type"><BarList color="#C8861A" data={rtype} /></Card>
      </div>
      <div className="mt-6"><Card title="Top topics"><BarList color="#B5543F" data={topic} /></Card></div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value?: number }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-ink-400">{icon}<span className="text-xs font-semibold uppercase tracking-wide">{label}</span></div>
      <div className="mt-2 text-2xl font-bold text-ink-900">{value == null ? <span className="skeleton inline-block h-7 w-16" /> : value.toLocaleString()}</div>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card p-5"><div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-ink-400">{title}</div>{children}</div>;
}
function Mini({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return <div className="rounded-lg bg-ink-50 p-3"><div className="flex items-center gap-1.5 text-ink-400">{icon}</div><div className="mt-1 text-lg font-bold text-ink-900">{value}</div><div className="text-[10px] uppercase text-ink-400">{label}</div></div>;
}
