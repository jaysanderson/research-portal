import { useState } from 'react';
import { Database, KeyRound, Users, Code2, Copy, Check } from 'lucide-react';
import { useConfig } from '../lib/hooks';
import { PageHeader } from '../components/PageHeader';

export default function SettingsPage() {
  const config = useConfig();
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const snippet = `<iframe
  src="${origin}/embed"
  title="Research Portal — Ask AI"
  style="width:380px;height:520px;border:1px solid #e5e7eb;border-radius:16px"
></iframe>`;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
      <PageHeader title="Governance & settings" description="Security posture, access control, and embedding." />

      <Panel icon={<Database size={16} />} title={`Knowledge Boxes (${config?.kbs?.length ?? 0})`}>
        {!config ? (
          <div className="skeleton h-12 w-full" />
        ) : config.kbs.length === 0 ? (
          <p className="text-sm text-ink-500">None configured on the server.</p>
        ) : (
          <div className="divide-y divide-ink-100">
            {config.kbs.map((kb) => (
              <div key={kb.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className={`h-2 w-2 rounded-full ${kb.connected ? 'bg-brand-500' : 'bg-accent-400'}`} />
                <span className="font-medium text-ink-900">{kb.name}</span>
                <span className="chip">{kb.zone || kb.id}</span>
                <span className="ml-auto flex items-center gap-2 text-xs">
                  <span className={kb.connected ? 'font-medium text-brand-700' : 'text-accent-600'}>{kb.connected ? 'Connected' : 'Not connected'}</span>
                  <span className={kb.aragConfigured ? 'rounded bg-accent-50 px-1.5 py-0.5 font-semibold text-accent-700' : 'text-ink-400'}>
                    {kb.aragConfigured ? 'Agent ready' : 'No agent'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-ink-400">Switch the active box from the sidebar. A box is disabled until the server can reach it. Add more by setting <code className="font-mono">NUCLIA_KB2_*</code> secrets.</p>
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
        <p className="text-sm text-ink-600">
          Production maps application roles to Nuclia security groups so retrieval is filtered per user:
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <RoleCard role="Manager" desc="Configure KB, manage taxonomy, ingest, full read." />
          <RoleCard role="Writer" desc="Ingest and classify resources; full read." />
          <RoleCard role="Reader" desc="Search, chat and agentic retrieval only." />
        </div>
        <p className="mt-3 text-xs text-ink-400">This demo runs as a single workspace. Wire Supabase auth + resource-level security groups to enforce per-user gating.</p>
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
