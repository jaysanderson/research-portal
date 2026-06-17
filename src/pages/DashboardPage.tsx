import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Upload, Search, MessageSquare, Workflow, FileText, Layers, Hash, Tags, ArrowRight } from 'lucide-react';
import { useCurrentKb, useCounters, useKbProfile } from '../lib/hooks';
import { getLabelsets } from '../lib/nuclia';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/States';

export default function DashboardPage() {
  const kb = useCurrentKb();
  const { profile } = useKbProfile();
  const { counters } = useCounters();
  const [taxonomies, setTaxonomies] = useState<number | undefined>(undefined);

  useEffect(() => { getLabelsets().then((ls) => setTaxonomies(Object.keys(ls).length)).catch(() => setTaxonomies(undefined)); }, []);

  const empty = counters !== null && counters.resources === 0;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8">
      <PageHeader title="Research Portal"
        description={profile?.tagline || 'Search, chat with, and reason over your knowledge base.'} />
      {profile?.subject && (
        <div className="-mt-4 mb-6"><span className="chip">{profile.subject}</span></div>
      )}

      {kb && !kb.connected && (
        <div className="card mb-6 border-accent-200 bg-accent-50 p-4 text-sm text-accent-700">
          <strong>{kb.name}</strong> isn’t reachable right now. Check its server credentials, or switch Knowledge Box from the sidebar.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<FileText size={16} strokeWidth={1.75} />} label="Resources" value={counters?.resources} />
        <Stat icon={<Layers size={16} strokeWidth={1.75} />} label="Paragraphs" value={counters?.paragraphs} />
        <Stat icon={<Hash size={16} strokeWidth={1.75} />} label="Sentences" value={counters?.sentences} />
        <Stat icon={<Tags size={16} strokeWidth={1.75} />} label="Taxonomies" value={taxonomies} />
      </div>

      {empty ? (
        <div className="card mt-6">
          <EmptyState
            icon={<Upload size={24} strokeWidth={1.75} />}
            title="Your Knowledge Box is empty"
            description="Add a resource to bring the portal to life — upload a file, paste text, or point it at a URL. It becomes searchable once indexed."
            action={<Link to="/ingest" className="btn-primary"><Upload size={16} /> Add your first resource</Link>}
          />
        </div>
      ) : (
        <div className="mt-8">
          <div className="mb-3 t-overline">Get started</div>
          <div className="grid gap-3 md:grid-cols-2">
            <ActionCard to="/ingest" icon={<Upload size={18} strokeWidth={1.75} />} title="Add content"
              desc="Upload files, paste text, or crawl URLs into the Knowledge Box." />
            <ActionCard to="/search" icon={<Search size={18} strokeWidth={1.75} />} title="Search"
              desc="Hybrid semantic and keyword search with cited AI answers." />
            <ActionCard to="/assistant" icon={<MessageSquare size={18} strokeWidth={1.75} />} title="Ask the assistant"
              desc="Streaming, grounded answers with source attribution." />
            <ActionCard to="/agentic" icon={<Workflow size={18} strokeWidth={1.75} />} title="Run an agentic query"
              desc="Multi-step retrieval with a transparent pipeline and traces." />
          </div>

          {profile?.topics && profile.topics.length > 0 && (
            <div className="mt-8">
              <div className="mb-3 t-overline">Explore {profile.subject || 'this knowledge base'}</div>
              <div className="flex flex-wrap gap-2">
                {profile.topics.map((t) => (
                  <Link key={t} to={`/search?q=${encodeURIComponent(t)}`} className="chip-link">{t}</Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value?: number }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-ink-400">{icon}<span className="t-overline">{label}</span></div>
      <div className="mt-2 stat-value">
        {value === undefined ? <span className="skeleton inline-block h-7 w-16 align-middle" /> : value.toLocaleString()}
      </div>
    </div>
  );
}

function ActionCard({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link to={to} className="card card-hover group flex items-start gap-3.5 p-5 focus-visible:outline-none">
      <span className="mt-0.5 text-ink-500 transition-colors group-hover:text-brand-700">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="t-h3">{title}</h3>
          <ArrowRight size={14} className="text-ink-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand-600" />
        </div>
        <p className="mt-1 t-muted">{desc}</p>
      </div>
    </Link>
  );
}
