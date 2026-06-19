import { useEffect, useState } from 'react';
import { Globe, Loader2, CheckCircle2, AlertCircle, Save, Trash2, FlaskConical } from 'lucide-react';
import { getIntegrations, savePerplexity, testPerplexity, removePerplexity, type PerplexityStatus } from '../lib/integrations';

export function PerplexityPanel() {
  const [status, setStatus] = useState<PerplexityStatus | null>(null);
  const [key, setKey] = useState('');
  const [model, setModel] = useState('sonar');
  const [busy, setBusy] = useState<'save' | 'test' | 'remove' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = () => getIntegrations().then((d) => { setStatus(d.perplexity); if (d.perplexity.model) setModel(d.perplexity.model); }).catch(() => setStatus(null));
  useEffect(() => { refresh(); }, []);

  const save = async () => {
    if (!key.trim()) { setMsg({ ok: false, text: 'Enter a Perplexity API key.' }); return; }
    setBusy('save'); setMsg(null);
    try { const s = await savePerplexity(key.trim(), model.trim() || 'sonar'); setStatus(s); setKey(''); setMsg({ ok: true, text: 'Saved and validated — live web search is on.' }); }
    catch (e) { setMsg({ ok: false, text: String(e instanceof Error ? e.message : e) }); }
    finally { setBusy(null); }
  };
  const test = async () => {
    setBusy('test'); setMsg(null);
    const r = await testPerplexity();
    setBusy(null); setMsg(r.ok ? { ok: true, text: 'Perplexity responded — connection works.' } : { ok: false, text: r.detail || 'Test failed.' });
  };
  const remove = async () => {
    if (!confirm('Remove the Perplexity key? Source discovery will fall back to the Knowledge Box model.')) return;
    setBusy('remove'); setMsg(null);
    try { const s = await removePerplexity(); setStatus(s); setMsg({ ok: true, text: 'Removed.' }); } finally { setBusy(null); }
  };

  const on = status?.configured;
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${on ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-500'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-brand-500' : 'bg-ink-400'}`} />
          {on ? 'Live web search on' : 'Off — using KB model'}
        </span>
        {on && status?.source && <span className="chip">{status.source === 'app' ? 'Key set in-app' : 'Key from server env'}</span>}
        {on && <span className="chip">model: {status?.model}</span>}
      </div>

      <p className="text-sm text-ink-600">When on, <strong>Add a theme</strong> uses Perplexity to find current, real sources from a live web search instead of the model’s static knowledge. The key is stored server-side and never sent to the browser.</p>

      <label className="field-label mt-4">Perplexity API key</label>
      <input className="input font-mono text-xs" type="password" value={key} onChange={(e) => setKey(e.target.value)}
        placeholder={on ? '•••••••• (set — enter a new key to replace)' : 'pplx-…'} />
      <label className="field-label mt-3">Model</label>
      <input className="input font-mono text-xs" value={model} onChange={(e) => setModel(e.target.value)} placeholder="sonar" />
      <p className="mt-1 text-[11px] text-ink-400">e.g. <code className="font-mono">sonar</code> (fast) or <code className="font-mono">sonar-pro</code> (stronger).</p>

      {msg && (
        <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-brand-50 text-brand-700' : 'bg-accent-50 text-accent-700'}`}>
          {msg.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}{msg.text}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={save} disabled={!!busy} className="btn-primary btn-sm">{busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save key</button>
        <button onClick={test} disabled={!!busy || !on} className="btn-outline btn-sm">{busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />} Test</button>
        {on && status?.source === 'app' && <button onClick={remove} disabled={!!busy} className="btn-ghost btn-sm text-data-clay">{busy === 'remove' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Remove</button>}
      </div>
    </div>
  );
}

export { Globe as PerplexityIcon };
