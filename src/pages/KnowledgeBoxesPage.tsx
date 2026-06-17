import { useEffect, useState } from 'react';
import { Database, Plus, Pencil, Trash2, Check, CircleCheck, Loader2, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { useConfig, useCurrentKb } from '../lib/hooks';
import {
  mergedKbs, getLocalKbs, removeLocalKb, setSelectedKbId, headersForKb, probeKb, probeAgent,
  type KbInfo, type LocalKb,
} from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { AddKbModal } from '../components/AddKbModal';

export default function KnowledgeBoxesPage() {
  const config = useConfig();
  const current = useCurrentKb();
  const [, bump] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<LocalKb | null>(null);

  useEffect(() => { const h = () => bump((x) => x + 1); window.addEventListener('rp-kb-change', h); return () => window.removeEventListener('rp-kb-change', h); }, []);

  const kbs = mergedKbs(config);
  const openAdd = () => { setEditing(null); setAddOpen(true); };
  const openEdit = (id: string) => { const local = getLocalKbs().find((k) => k.id === id) || null; setEditing(local); setAddOpen(true); };

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
      <PageHeader title="Knowledge Boxes"
        description="Connect, test, and switch between Knowledge Boxes and their Retrieval Agents."
        actions={<button onClick={openAdd} className="btn-primary btn-sm"><Plus size={15} /> Add Knowledge Box</button>} />

      {!config ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
      ) : kbs.length === 0 ? (
        <div className="card p-10 text-center">
          <Database size={26} className="mx-auto text-ink-300" />
          <p className="mt-2 t-muted">No Knowledge Boxes yet. Add one with an endpoint + API key.</p>
          <button onClick={openAdd} className="btn-primary mt-4"><Plus size={15} /> Add Knowledge Box</button>
        </div>
      ) : (
        <div className="space-y-3">
          {kbs.map((kb) => (
            <KbRow key={kb.id} kb={kb} isCurrent={kb.id === current?.id}
              onSetActive={() => { setSelectedKbId(kb.id); window.location.assign('/'); }}
              onEdit={() => openEdit(kb.id)}
              onRemove={() => { if (confirm(`Remove “${kb.name}”?`)) removeLocalKb(kb.id); }} />
          ))}
        </div>
      )}

      <p className="mt-5 flex items-start gap-1.5 text-xs text-ink-400">
        <ShieldCheck size={13} className="mt-0.5 shrink-0" />
        Built-in boxes are server-configured (keys never leave the server). Boxes you add are stored in this browser and proxied securely.
      </p>

      <AddKbModal open={addOpen} editing={editing} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function KbRow({ kb, isCurrent, onSetActive, onEdit, onRemove }: {
  kb: KbInfo; isCurrent: boolean; onSetActive: () => void; onEdit: () => void; onRemove: () => void;
}) {
  const [testing, setTesting] = useState(false);
  const [res, setRes] = useState<{ kb?: { ok: boolean; resources?: number; error?: string }; agent?: { ok: boolean; error?: string } } | null>(null);

  const runTest = async () => {
    setTesting(true); setRes(null);
    const h = headersForKb({ id: kb.id });
    const kbr = await probeKb(h);
    const agent = kb.aragConfigured ? await probeAgent(h) : undefined;
    setTesting(false); setRes({ kb: kbr, agent });
  };

  return (
    <div className={`card p-4 ${isCurrent ? 'border-brand-300 ring-1 ring-brand-200' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${kb.connected ? 'bg-brand-50 text-brand-600' : 'bg-accent-50 text-accent-500'}`}>
          <Database size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink-900">{kb.name}</span>
            {isCurrent && <span className="chip bg-brand-50 text-brand-700">Active</span>}
            <span className="chip">{kb.source === 'local' ? 'Added by you' : 'Built-in'}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
            <span className={`inline-flex items-center gap-1 ${kb.connected ? 'text-brand-700' : 'text-accent-600'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${kb.connected ? 'bg-brand-500' : 'bg-accent-400'}`} />{kb.connected ? 'Connected' : 'Not connected'}
            </span>
            <span>·</span>
            <span className="truncate">{kb.zone || kb.kbId}</span>
            <span>·</span>
            <span className={kb.aragConfigured ? 'font-medium text-accent-700' : 'text-ink-400'}>{kb.aragConfigured ? 'Agent configured' : 'No agent'}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={runTest} disabled={testing} className="btn-outline btn-sm">{testing ? <Loader2 size={13} className="animate-spin" /> : <CircleCheck size={13} />} Test</button>
          {!isCurrent && <button onClick={onSetActive} className="btn-outline btn-sm"><Check size={13} /> Set active</button>}
          {kb.source === 'local' && <button onClick={onEdit} className="btn-ghost btn-sm"><Pencil size={13} /> Edit</button>}
          {kb.source === 'local' && <button onClick={onRemove} className="btn-ghost btn-sm text-data-clay"><Trash2 size={13} /></button>}
        </div>
      </div>

      {res && (
        <div className="mt-3 space-y-1 border-t border-ink-100 pt-3 text-sm">
          <TestLine label="Knowledge Box" ok={res.kb?.ok} detail={res.kb?.ok ? `${res.kb.resources?.toLocaleString()} resources` : res.kb?.error} />
          {kb.aragConfigured && <TestLine label="Retrieval Agent" ok={res.agent?.ok} detail={res.agent?.ok ? 'streaming OK' : res.agent?.error} />}
        </div>
      )}
    </div>
  );
}

function TestLine({ label, ok, detail }: { label: string; ok?: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle2 size={15} className="text-brand-600" /> : <XCircle size={15} className="text-data-clay" />}
      <span className="font-medium text-ink-700">{label}</span>
      {detail && <span className="truncate text-ink-500">— {detail}</span>}
    </div>
  );
}
