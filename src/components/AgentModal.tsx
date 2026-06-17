import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, CheckCircle2, AlertCircle, Save, Trash2, Workflow, ShieldCheck } from 'lucide-react';
import {
  probeAgent, updateLocalKb, getLocalKbs, getAgentOverride, setAgentOverride, removeAgentOverride, type KbInfo,
} from '../lib/api';

export function AgentModal({ open, kb, onClose }: { open: boolean; kb: KbInfo | null; onClose: () => void }) {
  const [base, setBase] = useState('');
  const [agent, setAgent] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState<'test' | 'save' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const isLocal = kb?.source === 'local';
  const local = kb && isLocal ? getLocalKbs().find((k) => k.id === kb.id) : undefined;
  const override = kb && !isLocal ? getAgentOverride(kb.id) : undefined;
  const hasExisting = isLocal ? !!(local?.aragBase && local?.aragAgent) : !!override;

  useEffect(() => {
    if (!open || !kb) return;
    setResult(null);
    if (isLocal) { setBase(local?.aragBase || ''); setAgent(local?.aragAgent || ''); setKey(local?.aragKey || ''); }
    else { setBase(override?.aragBase || ''); setAgent(override?.aragAgent || ''); setKey(override?.aragKey || ''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kb?.id]);

  if (!open || !kb) return null;

  const headers = (): Record<string, string> => {
    const ag = { 'x-kb-arag-url': base.trim(), 'x-kb-arag-agent': agent.trim(), 'x-kb-arag-key': key.trim() };
    return isLocal && local ? { 'x-kb-url': local.url, 'x-kb-key': local.key, ...ag } : { 'x-kb': kb.id, ...ag };
  };

  const test = async () => {
    if (!base.trim() || !agent.trim() || !key.trim()) { setResult({ ok: false, msg: 'Fill all three fields to test.' }); return; }
    setBusy('test'); setResult(null);
    const r = await probeAgent(headers());
    setBusy(null);
    setResult(r.ok ? { ok: true, msg: 'Retrieval Agent responded — streaming works.' } : { ok: false, msg: r.error || 'Agent did not respond.' });
  };

  const save = async () => {
    if (!base.trim() || !agent.trim() || !key.trim()) { setResult({ ok: false, msg: 'Fill all three fields.' }); return; }
    setBusy('save');
    const r = await probeAgent(headers());
    if (!r.ok) { setBusy(null); setResult({ ok: false, msg: r.error || 'Agent did not respond — check the details.' }); return; }
    const cfg = { aragBase: base.trim(), aragAgent: agent.trim(), aragKey: key.trim() };
    if (isLocal) updateLocalKb(kb.id, cfg); else setAgentOverride(kb.id, cfg);
    setBusy(null); onClose();
  };

  const remove = () => {
    if (isLocal) updateLocalKb(kb.id, { aragBase: undefined, aragAgent: undefined, aragKey: undefined });
    else removeAgentOverride(kb.id);
    onClose();
  };

  return createPortal((
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink-900/40 px-4 pt-[10vh]" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
          <h3 className="t-h2 flex items-center gap-2"><Workflow size={17} className="text-brand-600" /> Retrieval Agent — {kb.name}</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700"><X size={18} /></button>
        </div>
        <div className="px-5 py-4">
          <p className="mb-3 text-sm text-ink-600">Connect a Nuclia Retrieval Agent (its MCP endpoint) to power the Agentic function for this Knowledge Box.</p>
          {!isLocal && kb.aragConfigured && !override && (
            <div className="mb-3 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-500">
              A server-configured agent is already active for this box. Saving here adds a client override for your browser.
            </div>
          )}
          <label className="field-label">Agent base URL (MCP endpoint)</label>
          <input className="input font-mono text-xs" value={base} onChange={(e) => setBase(e.target.value)} placeholder="https://aws-…dp.progress.cloud/api/v1" />
          <label className="field-label mt-3">Agent id</label>
          <input className="input font-mono text-xs" value={agent} onChange={(e) => setAgent(e.target.value)} placeholder="agent uuid" />
          <label className="field-label mt-3">Agent API key</label>
          <input className="input font-mono text-xs" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="agent service-account key" />

          {result && (
            <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${result.ok ? 'bg-brand-50 text-brand-700' : 'bg-accent-50 text-accent-700'}`}>
              {result.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}{result.msg}
            </div>
          )}
          <div className="mt-3 flex items-start gap-1.5 text-[11px] text-ink-400">
            <ShieldCheck size={13} className="mt-0.5 shrink-0" />
            <span>Stored only in your browser, sent over HTTPS to the proxy, which forwards only to Progress/Nuclia hosts.</span>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3">
          <div>{hasExisting && <button onClick={remove} className="btn-ghost btn-sm text-data-clay"><Trash2 size={14} /> Remove agent</button>}</div>
          <div className="flex gap-2">
            <button onClick={test} disabled={!!busy} className="btn-outline btn-sm">{busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : null} Test agent</button>
            <button onClick={save} disabled={!!busy} className="btn-primary btn-sm">{busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save</button>
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}
