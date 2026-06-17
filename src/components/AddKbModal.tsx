import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, CheckCircle2, AlertCircle, Plus, ShieldCheck } from 'lucide-react';
import { addLocalKb, setSelectedKbId, probeKb } from '../lib/api';

export function AddKbModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [showAgent, setShowAgent] = useState(false);
  const [aragBase, setAragBase] = useState('');
  const [aragAgent, setAragAgent] = useState('');
  const [aragKey, setAragKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  if (!open) return null;

  const reset = () => { setName(''); setUrl(''); setKey(''); setAragBase(''); setAragAgent(''); setAragKey(''); setShowAgent(false); setResult(null); };
  const close = () => { reset(); onClose(); };

  const test = async () => {
    if (!url.trim() || !key.trim()) { setResult({ ok: false, msg: 'Enter the KB endpoint and API key.' }); return; }
    setTesting(true); setResult(null);
    const r = await probeKb(url.trim(), key.trim());
    setTesting(false);
    setResult(r.ok ? { ok: true, msg: `Connected — ${r.resources?.toLocaleString() ?? '?'} resources.` } : { ok: false, msg: r.error || 'Could not reach this Knowledge Box.' });
  };

  const add = async () => {
    if (!url.trim() || !key.trim()) { setResult({ ok: false, msg: 'Enter the KB endpoint and API key.' }); return; }
    // Validate before saving so we never add a dead box.
    setTesting(true);
    const r = await probeKb(url.trim(), key.trim());
    setTesting(false);
    if (!r.ok) { setResult({ ok: false, msg: r.error || 'Could not reach this Knowledge Box.' }); return; }
    const kb = addLocalKb({
      name: name.trim() || hostName(url) || 'Custom KB',
      url: url.trim(), key: key.trim(),
      aragBase: showAgent ? aragBase.trim() || undefined : undefined,
      aragAgent: showAgent ? aragAgent.trim() || undefined : undefined,
      aragKey: showAgent ? aragKey.trim() || undefined : undefined,
    });
    setSelectedKbId(kb.id);
    window.location.assign('/');
  };

  return createPortal((
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink-900/40 px-4 pt-[10vh]" onClick={close}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
          <h3 className="t-h2">Add a Knowledge Box</h3>
          <button onClick={close} className="text-ink-400 hover:text-ink-700"><X size={18} /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <label className="field-label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Knowledge Box" />

          <label className="field-label mt-3">API endpoint</label>
          <input className="input font-mono text-xs" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://aws-…rag.progress.cloud/api/v1/kb/<kb-id>" />

          <label className="field-label mt-3">API key</label>
          <input className="input font-mono text-xs" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Nuclia service-account key" />

          <button onClick={() => setShowAgent((s) => !s)} className="mt-4 text-xs font-semibold text-brand-700 hover:underline">
            {showAgent ? '− Hide' : '+ Add'} Retrieval Agent (optional, enables the Agentic function)
          </button>
          {showAgent && (
            <div className="mt-2 space-y-2 rounded-lg border border-ink-200 bg-ink-50 p-3">
              <div><label className="field-label">Agent base URL</label>
                <input className="input font-mono text-xs" value={aragBase} onChange={(e) => setAragBase(e.target.value)} placeholder="https://aws-…dp.progress.cloud/api/v1" /></div>
              <div><label className="field-label">Agent id</label>
                <input className="input font-mono text-xs" value={aragAgent} onChange={(e) => setAragAgent(e.target.value)} placeholder="agent uuid" /></div>
              <div><label className="field-label">Agent API key</label>
                <input className="input font-mono text-xs" type="password" value={aragKey} onChange={(e) => setAragKey(e.target.value)} placeholder="agent service-account key" /></div>
            </div>
          )}

          {result && (
            <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${result.ok ? 'bg-brand-50 text-brand-700' : 'bg-accent-50 text-accent-700'}`}>
              {result.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}{result.msg}
            </div>
          )}

          <div className="mt-3 flex items-start gap-1.5 text-[11px] text-ink-400">
            <ShieldCheck size={13} className="mt-0.5 shrink-0" />
            <span>This key is stored only in your browser and sent over HTTPS to the proxy, which forwards only to Progress/Nuclia hosts.</span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-3">
          <button onClick={test} disabled={testing} className="btn-outline btn-sm">{testing ? <Loader2 size={14} className="animate-spin" /> : null} Test connection</button>
          <button onClick={add} disabled={testing} className="btn-primary btn-sm">{testing ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add</button>
        </div>
      </div>
    </div>
  ), document.body);
}

function hostName(u: string) { try { return new URL(u).host; } catch { return ''; } }
