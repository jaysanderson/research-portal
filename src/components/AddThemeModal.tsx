import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Sparkles, Plus, Trash2, ArrowLeft, CheckCircle2, AlertCircle, Wand2 } from 'lucide-react';
import { planTheme, ingestTheme, type ThemePlan } from '../lib/theme';
import { friendlyError } from '../lib/util';

type Phase = 'describe' | 'review' | 'running' | 'done';
const COUNTS = [10, 25, 50];

export function AddThemeModal({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded?: () => void }) {
  const [phase, setPhase] = useState<Phase>('describe');
  const [request, setRequest] = useState('');
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [theme, setTheme] = useState('');
  const [summary, setSummary] = useState('');
  const [scope, setScope] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [newSource, setNewSource] = useState('');
  const [count, setCount] = useState(25);

  const [progress, setProgress] = useState<{ stage: string; message: string }[]>([]);
  const [created, setCreated] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!open) return;
    // reset on open
    setPhase('describe'); setRequest(''); setError(null); setPlanning(false);
    setTheme(''); setSummary(''); setScope(''); setSources([]); setTopics([]); setNewSource(''); setCount(25);
    setProgress([]); setCreated(0); setTotal(0);
  }, [open]);

  if (!open) return null;

  const applyPlan = (p: ThemePlan) => {
    setTheme(p.theme); setSummary(p.summary); setScope(p.scope); setSources(p.sources); setTopics(p.suggestedTopics);
    setCount(25); setPhase('review');
  };

  const describe = async () => {
    if (!request.trim()) return;
    setPlanning(true); setError(null);
    try { applyPlan(await planTheme(request.trim())); }
    catch (e) { setError(friendlyError(e, 'Could not interpret that request. Try rephrasing.')); }
    finally { setPlanning(false); }
  };

  const addSource = () => {
    const s = newSource.trim(); if (!s) return;
    setSources((xs) => Array.from(new Set([...xs, s]))); setNewSource('');
  };

  const go = async () => {
    if (!theme.trim() || !sources.length) return;
    setPhase('running'); setError(null); setProgress([]); setCreated(0); setTotal(0);
    try {
      for await (const ev of ingestTheme({ label: theme.trim(), sources, count, topics })) {
        if (ev.stage === 'error') { setError(ev.message || 'Something went wrong.'); return; }
        if (typeof ev.total === 'number') setTotal(ev.total);
        if (typeof ev.created === 'number') setCreated(ev.created);
        if (ev.message) setProgress((p) => [...p.slice(-4), { stage: ev.stage, message: ev.message! }]);
        if (ev.stage === 'done') { setCreated(ev.created || 0); setPhase('done'); onAdded?.(); window.dispatchEvent(new Event('rp-kb-change')); }
      }
    } catch (e) {
      setError(friendlyError(e, 'The import did not complete. Please try again.'));
    }
  };

  return createPortal((
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink-900/40 px-4 pt-[8vh]" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
          <h3 className="t-h2 flex items-center gap-2"><Sparkles size={17} className="text-brand-600" /> Add a theme</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700"><X size={18} /></button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {/* STEP 1 — describe */}
          {phase === 'describe' && (
            <>
              <p className="mb-2 text-sm text-ink-600">Describe a theme or topic you want this Knowledge Box to cover. The portal will restate it, then retrieve fresh resources to seed it.</p>
              <textarea value={request} onChange={(e) => setRequest(e.target.value)} rows={4} autoFocus
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') describe(); }}
                placeholder="e.g. Add coverage of AI governance and the EU AI Act for enterprise content teams"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
              {error && <div className="mt-3 flex items-center gap-2 rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700"><AlertCircle size={15} />{error}</div>}
            </>
          )}

          {/* STEP 2 — review (AI redescription) */}
          {phase === 'review' && (
            <>
              <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-700"><Wand2 size={12} /> Here’s what I’ll add</div>
                <p className="mt-1.5 text-sm text-ink-700">{summary || `Resources about “${theme}”.`}</p>
                {scope && <p className="mt-1 text-xs text-ink-500">{scope}</p>}
              </div>

              <label className="field-label mt-4">Theme name (the label applied to every resource)</label>
              <input value={theme} onChange={(e) => setTheme(e.target.value)} className="input" placeholder="Theme name" />

              <div className="mt-4 flex items-center justify-between">
                <label className="field-label !mb-0">Sources to retrieve from ({sources.length})</label>
              </div>
              <div className="mt-1.5 space-y-1.5">
                {sources.map((s) => (
                  <div key={s} className="flex items-center gap-2 rounded-lg border border-ink-100 bg-ink-50/60 px-2.5 py-1.5">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-600">{s}</span>
                    <button onClick={() => setSources((xs) => xs.filter((x) => x !== s))} className="text-ink-400 hover:text-data-clay"><Trash2 size={13} /></button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input value={newSource} onChange={(e) => setNewSource(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSource(); } }}
                    placeholder="Add a source (domain or URL)" className="input flex-1 font-mono text-xs" />
                  <button onClick={addSource} className="btn-outline btn-sm"><Plus size={13} /> Add</button>
                </div>
              </div>

              <label className="field-label mt-4">How many resources to retrieve initially?</label>
              <div className="mt-1 flex gap-2">
                {COUNTS.map((c) => (
                  <button key={c} onClick={() => setCount(c)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${count === c ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'}`}>{c}</button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink-400">Links are discovered from your sources, checked for reachability, then indexed. More takes a little longer.</p>
              {error && <div className="mt-3 flex items-center gap-2 rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700"><AlertCircle size={15} />{error}</div>}
            </>
          )}

          {/* STEP 3 — running */}
          {phase === 'running' && (
            <div className="py-2">
              {!error ? (
                <>
                  <div className="flex items-center gap-2 text-sm font-medium text-ink-700"><Loader2 size={15} className="animate-spin text-brand-600" /> Adding “{theme}”…</div>
                  {total > 0 && (
                    <div className="mt-3">
                      <div className="h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.round((created / total) * 100)}%` }} /></div>
                      <div className="mt-1 text-xs text-ink-500">{created} / {total} resources</div>
                    </div>
                  )}
                  <ul className="mt-4 space-y-1.5">
                    {progress.map((p, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-ink-500">
                        <span className={`h-1.5 w-1.5 rounded-full ${i === progress.length - 1 ? 'bg-brand-500' : 'bg-ink-300'}`} />{p.message}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="flex items-start gap-2 rounded-lg bg-accent-50 px-3 py-2.5 text-sm text-accent-700"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>
              )}
            </div>
          )}

          {/* STEP 4 — done */}
          {phase === 'done' && (
            <div className="py-4 text-center">
              <CheckCircle2 size={34} className="mx-auto text-brand-600" />
              <p className="mt-3 text-sm text-ink-700"><span className="font-semibold">{created}</span> resources added to <span className="font-semibold">“{theme}”</span>.</p>
              <p className="mt-1 text-xs text-ink-400">They’re indexing now — content becomes searchable over the next few minutes.</p>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3">
          <div>
            {phase === 'review' && <button onClick={() => setPhase('describe')} className="btn-ghost btn-sm"><ArrowLeft size={14} /> Back</button>}
            {phase === 'running' && error && <button onClick={() => setPhase('review')} className="btn-ghost btn-sm"><ArrowLeft size={14} /> Back</button>}
          </div>
          <div className="flex gap-2">
            {phase === 'describe' && (
              <button onClick={describe} disabled={planning || !request.trim()} className="btn-primary btn-sm">
                {planning ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Describe it for me
              </button>
            )}
            {phase === 'review' && (
              <button onClick={go} disabled={!theme.trim() || !sources.length} className="btn-primary btn-sm"><Sparkles size={14} /> Go — retrieve {count}</button>
            )}
            {phase === 'done' && (
              <>
                <button onClick={() => { setPhase('describe'); setRequest(''); }} className="btn-outline btn-sm">Add another</button>
                <button onClick={onClose} className="btn-primary btn-sm">Done</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}
