import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Upload, Search, MessageSquare, Workflow, Database, FileText, Layers, Hash } from 'lucide-react';
import { useConfig, useCounters } from '../lib/hooks';
import { getLabelsets } from '../lib/nuclia';

export default function DashboardPage() {
  const config = useConfig();
  const { counters } = useCounters();
  const [vendorCount, setVendorCount] = useState<number | null>(null);

  useEffect(() => {
    getLabelsets().then((ls) => setVendorCount(Object.keys(ls).length)).catch(() => setVendorCount(null));
  }, []);

  const empty = counters !== null && counters.resources === 0;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Research Portal</h1>
        <p className="mt-1 text-ink-500">
          An agentic-RAG workspace over your Knowledge Box. Add content, then search, chat, and reason across it.
        </p>
      </div>

      {!config?.kbConfigured && (
        <div className="card mb-6 border-amber-300 bg-amber-50 p-5 text-amber-800">
          The server has no Knowledge Box configured. Set <code className="font-mono">NUCLIA_KB_URL</code> and{' '}
          <code className="font-mono">NUCLIA_API_KEY</code> and restart.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={<FileText size={18} />} label="Resources" value={counters?.resources} />
        <Stat icon={<Layers size={18} />} label="Paragraphs" value={counters?.paragraphs} />
        <Stat icon={<Hash size={18} />} label="Sentences" value={counters?.sentences} />
        <Stat icon={<Database size={18} />} label="Taxonomies" value={vendorCount ?? undefined} />
      </div>

      {empty ? (
        <EmptyState />
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <ActionCard to="/ingest" icon={<Upload size={20} />} title="Add content"
            desc="Upload files, paste text, or crawl URLs straight into the Knowledge Box." />
          <ActionCard to="/search" icon={<Search size={20} />} title="Search the corpus"
            desc="Hybrid semantic + keyword search with AI answers and citations." />
          <ActionCard to="/assistant" icon={<MessageSquare size={20} />} title="Ask the assistant"
            desc="Streaming, cited answers grounded in your content." />
          <ActionCard to="/agentic" icon={<Workflow size={20} />} title="Run an agentic query"
            desc="Multi-step retrieval with a transparent pipeline, REMi scoring, and traces." />
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value?: number }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-ink-400">{icon}<span className="text-xs font-semibold uppercase tracking-wide">{label}</span></div>
      <div className="mt-2 text-2xl font-bold text-ink-900">
        {value === undefined ? <span className="skeleton inline-block h-7 w-16" /> : value.toLocaleString()}
      </div>
    </div>
  );
}

function ActionCard({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link to={to} className="card group p-5 transition-shadow hover:shadow-md">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100">{icon}</div>
      <h3 className="mt-3 font-semibold text-ink-900">{title}</h3>
      <p className="mt-1 text-sm text-ink-500">{desc}</p>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="card mt-8 flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Upload size={26} />
      </div>
      <h2 className="mt-4 text-xl font-bold text-ink-900">Your Knowledge Box is empty</h2>
      <p className="mt-2 max-w-md text-ink-500">
        Add your first resource to bring the portal to life. Upload files, paste text, or point it at a URL —
        everything becomes searchable and chat-ready once indexed.
      </p>
      <Link to="/ingest" className="btn-primary mt-6">
        <Upload size={16} /> Add your first resource
      </Link>
    </div>
  );
}
