import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, CheckCircle2, AlertCircle, Plus, Save, ShieldCheck } from 'lucide-react';
import { addLocalKb, updateLocalKb, setSelectedKbId, probeKb, probeAgent, type LocalKb } from '../lib/api';

export function AddKbModal({ open, onClose, editing, onAdded }: { open: boolean; onClose: () => void; editing?: LocalKb | null; onAdded?: (kbId: string) => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [showAgent, setShowAgent] = useState(false);
  const [aragBase, setAragBase] = useState('');
  const [aragAgent, setAragAgent] = useState('');
  const [aragKey, setAragKey] = useState('');
  const [busy, setBusy] = useState<'kb' | 'agent' | 'save' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    if (editing) {
      setName(editing.name); setUrl(editing.url); setKey(editing.key);
      setShowAgent(!!(editing.aragBase || editing.aragAgent));
      setAragBase(editing.aragBase || ''); setAragAgent(editing.aragAgent || ''); setAragKey(editing.aragKey || '');
    } else {
      setName(''); setUrl(''); setKey(''); setShowAgent(false); setAragBase(''); setAragAgent(''); setAragKey('');
    }
  }, [open, editing]);

  if (!open) return null;
  const isEdit = !!editing;

  const agentHeaders = () => ({ 'x-kb-url': url.trim(), 'x-kb-key': key.trim(), 'x-kb-arag-url': aragBase.trim(), 'x-kb-arag-agent': aragAgent.trim(), 'x-kb-arag-key': aragKey.trim() });

  const testKb = async () => {
    if (!url.trim() || !key.trim()) { setResult({ ok: false, msg: 'Enter the KB endpoint and API key.' }); return; }
    setBusy('kb'); setResult(null);
    const r = await probeKb(url.trim(), key.trim());
    setBusy(null);
    setResult(r.ok ? { ok: true, msg: `Knowledge Box reachable — ${r.resources?.toLocaleString() ?? '?'} resources.` } : { ok: false, msg: r.error || 'Could not reach this Knowledge Box.' });
  };

  const testAgent = async () => {
    if (!aragBase.trim() || !aragAgent.trim() || !aragKey.trim()) { setResult({ ok: false, msg: 'Fill all three agent fields to test.' }); return; }
    setBusy('agent'); setResult(null);
    const r = await probeAgent(agentHeaders());
    setBusy(null);
    setResult(r.ok ? { ok: true, msg: 'Retrieval Agent responded — streaming works.' } : { ok: false, msg: r.error || 'Agent did not respond.' });
  };

  const save = async () => {
    if (!url.trim() || !key.trim()) { setResult({ ok: false, msg: 'Enter the KB endpoint and API key.' }); return; }
    setBusy('save');
    const r = await probeKb(url.trim(), key.trim());
    if (!r.ok) { setBusy(null); setResult({ ok: false, msg: r.error || 'Could not reach this Knowledge Box.' }); return; }
    const patch: Omit<LocalKb, 'id'> = {
      name: name.trim() || hostName(url) || 'Custom KB', url: url.trim(), key: key.trim(),
      aragBase: showAgent ? aragBase.trim() || undefined : undefined,
      aragAgent: showAgent ? aragAgent.trim() || undefined : undefined,
      aragKey: showAgent ? aragKey.trim() || undefined : undefined,
    };
    if (isEdit) { updateLocalKb(editing!.id, patch); setBusy(null); onClose(); }
    else {
      const kb = addLocalKb(patch);
      setBusy(null);
      // Hand off to the setup wizard when the parent wants it; otherwise go home.
      if (onAdded) { onClose(); onAdded(kb.id); }
      else { setSelectedKbId(kb.id); window.location.assign('/'); }
    }
  };

  return createPortal((
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink-900/40 px-4 pt-[8vh]" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
          <h3 className="t-h2">{isEdit ? 'Edit Knowledge Box' : 'Add a Knowledge Box'}</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700"><X size={18} /></button>
        </div>
        <div className="max-h-[72vh] overflow-y-auto px-5 py-4">
          <label className="field-label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Knowledge Box" />

          <label className="field-label mt-3">API endpoint</label>
          <input className="input font-mono text-xs" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://aws-…rag.progress.cloud/api/v1/kb/<kb-id>" />

          <label className="field-label mt-3">API key</label>
          <input className="input font-mono text-xs" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Nuclia service-account key" />

          <button onClick={() => setShowAgent((s) => !s)} className="mt-4 text-xs font-semibold text-brand-700 hover:underline">
            {showAgent ? '− Hide' : '+ Configure'} Retrieval Agent (enables the Agentic function)
          </button>
          {showAgent && (
            <div className="mt-2 space-y-2 rounded-lg border border-ink-200 bg-ink-50 p-3">
              <div><label className="field-label">Agent base URL</label>
                <input className="input font-mono text-xs" value={aragBase} onChange={(e) => setAragBase(e.target.value)} placeholder="https://aws-…dp.progress.cloud/api/v1" /></div>
              <div><label className="field-label">Agent id</label>
                <input className="input font-mono text-xs" value={aragAgent} onChange={(e) => setAragAgent(e.target.value)} placeholder="agent uuid" /></div>
              <div><label className="field-label">Agent API key</label>
                <input className="input font-mono text-xs" type="password" value={aragKey} onChange={(e) => setAragKey(e.target.value)} placeholder="agent service-account key" /></div>
              <button onClick={testAgent} disabled={!!busy} className="btn-outline btn-sm">{busy === 'agent' ? <Loader2 size={13} className="animate-spin" /> : null} Test agent</button>
            </div>
          )}

          {result && (
            <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${result.ok ? 'bg-brand-50 text-brand-700' : 'bg-accent-50 text-accent-700'}`}>
              {result.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}{result.msg}
            </div>
          )}
          <div className="mt-3 flex items-start gap-1.5 text-[11px] text-ink-400">
            <ShieldCheck size={13} className="mt-0.5 shrink-0" />
            <span>Keys are stored only in your browser and sent over HTTPS to the proxy, which forwards only to Progress/Nuclia hosts.</span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-3">
          <button onClick={testKb} disabled={!!busy} className="btn-outline btn-sm">{busy === 'kb' ? <Loader2 size={14} className="animate-spin" /> : null} Test connection</button>
          <button onClick={save} disabled={!!busy} className="btn-primary btn-sm">{busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : isEdit ? <Save size={14} /> : <Plus size={14} />} {isEdit ? 'Save changes' : 'Add'}</button>
        </div>
      </div>
    </div>
  ), document.body);
}

function hostName(u: string) { try { return new URL(u).host; } catch { return ''; } }
