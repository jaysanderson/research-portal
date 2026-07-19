import { useState } from 'react';
import { Database, KeyRound, Users, Code2, Copy, Check, Plus, Trash2, Globe, Shuffle } from 'lucide-react';
import { SynonymsPanel } from '../components/SynonymsPanel';
import { useConfig } from '../lib/hooks';
import { mergedKbs, removeLocalKb } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { AddKbModal } from '../components/AddKbModal';
import { PerplexityPanel } from '../components/PerplexityPanel';

export default function SettingsPage() {
  const config = useConfig();
  const [copied, setCopied] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const kbs = mergedKbs(config);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const snippet = `<iframe
  src="${origin}/embed"
  title="Research Portal — Ask AI"
  style="width:380px;height:520px;border:1px solid #e5e7eb;border-radius:16px"
></iframe>`;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
      <PageHeader title="Governance" description="Security posture, access control, and embedding." />

      <Panel icon={<Database size={16} />} title={`Knowledge Boxes (${kbs.length})`}>
        {!config ? (
          <div className="skeleton h-12 w-full" />
        ) : kbs.length === 0 ? (
          <p className="text-sm text-ink-500">None configured.</p>
        ) : (
          <div className="divide-y divide-ink-100">
            {kbs.map((kb) => (
              <div key={kb.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className={`h-2 w-2 rounded-full ${kb.connected ? 'bg-brand-500' : 'bg-accent-400'}`} />
                <span className="font-medium text-ink-900">{kb.name}</span>
                <span className="chip">{kb.zone || kb.id}</span>
                <span className={`chip ${kb.source === 'local' ? 'bg-brand-50 text-brand-700' : ''}`}>{kb.source === 'local' ? 'Added by you' : 'Built-in'}</span>
                <span className="ml-auto flex items-center gap-2 text-xs">
                  <span className={kb.aragConfigured ? 'rounded bg-accent-50 px-1.5 py-0.5 font-semibold text-accent-700' : 'text-ink-400'}>
                    {kb.aragConfigured ? 'Agent ready' : 'No agent'}
                  </span>
                  {kb.source === 'local' && (
                    <button onClick={() => { if (confirm(`Remove “${kb.name}”?`)) removeLocalKb(kb.id); }} aria-label="Remove" className="text-ink-400 hover:text-data-clay"><Trash2 size={14} /></button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-ink-400">Built-in boxes are server-configured. Add your own with just an endpoint + API key — stored in this browser.</p>
          <button onClick={() => setAddOpen(true)} className="btn-outline btn-sm"><Plus size={14} /> Add KB</button>
        </div>
      </Panel>
      <AddKbModal open={addOpen} onClose={() => setAddOpen(false)} />

      <Panel icon={<Globe size={16} />} title="Integrations — Perplexity (live web search)" className="mt-4">
        <PerplexityPanel />
      </Panel>

      <Panel icon={<Shuffle size={16} />} title="Search tuning — synonyms" className="mt-4">
        <SynonymsPanel />
      </Panel>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel icon={<KeyRound size={16} />} title="Credential security">
          <p className="text-sm text-ink-600">The Nuclia service-account key is held <strong>server-side only</strong> (Fly secret) and never reaches the browser. All Knowledge Box traffic is proxied through <code className="font-mono text-xs">/api/kb</code>.</p>
          <ul className="mt-2 space-y-1 text-sm text-ink-600">
            <li>• TLS in transit, encrypted at rest (Progress Agentic RAG Cloud)</li>
            <li>• SOC 2 / ISO 27001 platform posture</li>
            <li>• GDPR PII anonymization available at ingestion</li>
          </ul>
        </Panel>
      </div>

      <Panel icon={<Users size={16} />} title="Access control (RBAC)" className="mt-4">
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-sm text-accent-700">
          <Users size={15} className="mt-0.5 shrink-0" />
          <span><strong>Not enforced in this build.</strong> The app currently runs as a single open workspace with no authentication. Saved items and trace history are local to each browser, not shared between users.</span>
        </div>
        <p className="text-sm text-ink-600">Planned for production — application roles map to Nuclia security groups so retrieval is filtered per user:</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 opacity-90">
          <RoleCard role="Manager" desc="Configure KB, manage taxonomy, ingest, full read." />
          <RoleCard role="Writer" desc="Ingest and classify resources; full read." />
          <RoleCard role="Reader" desc="Search, chat and agentic retrieval only." />
        </div>
        <p className="mt-3 text-xs text-ink-400">To enable: add Supabase (or SSO) auth + resource-level security groups.</p>
      </Panel>

      <Panel icon={<Code2 size={16} />} title="Embeddable widget" className="mt-4">
        <p className="text-sm text-ink-600">Drop the AI assistant onto any site with one iframe. It talks to the same proxied Knowledge Box.</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-ink-900 p-3 text-xs text-ink-100"><code>{snippet}</code></pre>
        <div className="mt-2 flex gap-2">
          <button onClick={() => { navigator.clipboard?.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1800); }} className="btn-outline text-sm">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy snippet'}
          </button>
          <a href="/embed" target="_blank" rel="noreferrer" className="btn-ghost text-sm">Preview widget →</a>
        </div>
      </Panel>
    </div>
  );
}

function Panel({ icon, title, children, className = '' }: { icon: React.ReactNode; title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-800">{icon}{title}</div>
      {children}
    </div>
  );
}
function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-100 py-1.5 text-sm last:border-0">
      <span className="text-ink-500">{label}</span>
      <span className={`font-medium ${ok === undefined ? 'text-ink-800' : ok ? 'text-emerald-600' : 'text-amber-600'}`}>{value}</span>
    </div>
  );
}
function RoleCard({ role, desc }: { role: string; desc: string }) {
  return <div className="rounded-lg border border-ink-200 p-3"><div className="text-sm font-bold text-ink-900">{role}</div><div className="mt-0.5 text-xs text-ink-500">{desc}</div></div>;
}
