import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Sparkles, Wand2, ArrowLeft, CheckCircle2, AlertCircle, Trash2, Tag, FileText, Share2 } from 'lucide-react';
import { planKbSetup, applyKbSetup, type KbSetupPlan } from '../lib/kbSetup';
import { friendlyError } from '../lib/util';
import type { KbInfo } from '../lib/api';

type Phase = 'describe' | 'review' | 'running' | 'done';

export function KbSetupModal({ open, kb, onClose, onDone }: { open: boolean; kb: KbInfo | null; onClose: () => void; onDone?: () => void }) {
  const [phase, setPhase] = useState<Phase>('describe');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<KbSetupPlan | null>(null);
  const [progress, setProgress] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setPhase('describe'); setDesc(''); setBusy(false); setError(null); setPlan(null); setProgress([]);
  }, [open]);

  if (!open || !kb) return null;

  const describe = async () => {
    if (!desc.trim()) return;
    setBusy(true); setError(null);
    try { setPlan(await planKbSetup(desc.trim(), kb.id)); setPhase('review'); }
    catch (e) { setError(friendlyError(e, 'Could not design a setup from that description. Try rephrasing.')); }
    finally { setBusy(false); }
  };

  const patch = (p: Partial<KbSetupPlan>) => setPlan((cur) => (cur ? { ...cur, ...p } : cur));
  const removeLabelset = (id: string) => patch({ labelsets: plan!.labelsets.filter((l) => l.id !== id) });

  const apply = async () => {
    if (!plan) return;
    setPhase('running'); setError(null); setProgress([]);
    try {
      await applyKbSetup(plan, kb.id, (pr) => setProgress((x) => [...x.slice(-4), pr.message]));
      setPhase('done'); onDone?.(); window.dispatchEvent(new Event('rp-kb-change'));
    } catch (e) { setError(friendlyError(e, 'Setup did not complete. Please try again.')); }
  };

  return createPortal((
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink-900/40 px-4 pt-[7vh]" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
          <h3 className="t-h2 flex items-center gap-2"><Sparkles size={17} className="text-brand-600" /> Set up — {kb.name}</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700"><X size={18} /></button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {phase === 'describe' && (
            <>
              <p className="mb-2 text-sm text-ink-600">Describe what this Knowledge Box is about. The portal designs the taxonomy (labels), tailors the page copy and generator, and prepares the knowledge graph — all from your description.</p>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} autoFocus
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') describe(); }}
                placeholder="e.g. A research hub on enterprise cybersecurity — vendors, threats, compliance frameworks and incident case studies."
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
              {error && <div className="mt-3 flex items-center gap-2 rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700"><AlertCircle size={15} />{error}</div>}
            </>
          )}

          {phase === 'review' && plan && (
            <>
              <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-700"><Wand2 size={12} /> Proposed setup</div>
                <label className="field-label mt-2">Subject</label>
                <input value={plan.subject} onChange={(e) => patch({ subject: e.target.value })} className="input" />
                <label className="field-label mt-2">Tagline</label>
                <input value={plan.tagline} onChange={(e) => patch({ tagline: e.target.value })} className="input" />
                <label className="field-label mt-2">Description</label>
                <textarea value={plan.description} onChange={(e) => patch({ description: e.target.value })} rows={2} className="input" />
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-ink-800"><Tag size={14} /> Taxonomy ({plan.labelsets.length})</div>
              <div className="mt-1.5 space-y-2">
                {plan.labelsets.map((ls) => (
                  <div key={ls.id} className="rounded-lg border border-ink-100 bg-ink-50/60 p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink-800">{ls.title}</span>
                      <span className="chip">{ls.multiple ? 'multi' : 'single'}</span>
                      <button onClick={() => removeLabelset(ls.id)} className="ml-auto text-ink-400 hover:text-data-clay"><Trash2 size={13} /></button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {ls.labels.slice(0, 8).map((l) => <span key={l} className="chip text-[11px]">{l}</span>)}
                    </div>
                  </div>
                ))}
                {plan.labelsets.length === 0 && <p className="text-xs text-ink-400">No taxonomy — add content-only KB. (You can add labels later in Taxonomy.)</p>}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-ink-500">
                <div><div className="flex items-center gap-1 font-semibold text-ink-700"><FileText size={12} /> Generator</div><p className="mt-0.5">Copy &amp; Generate prompts tailored to “{plan.subject}”.</p></div>
                <div><div className="flex items-center gap-1 font-semibold text-ink-700"><Share2 size={12} /> Graph</div><p className="mt-0.5">{plan.labelsets.length >= 2 ? `Axes: ${plan.graphPrimary || plan.labelsets[0].title} ↔ ${plan.graphSecondary || plan.labelsets[1].title}.` : 'Needs 2+ labelsets to draw.'}</p></div>
              </div>
              {error && <div className="mt-3 flex items-center gap-2 rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700"><AlertCircle size={15} />{error}</div>}
            </>
          )}

          {phase === 'running' && (
            <div className="py-2">
              {!error ? (
                <>
                  <div className="flex items-center gap-2 text-sm font-medium text-ink-700"><Loader2 size={15} className="animate-spin text-brand-600" /> Setting up “{kb.name}”…</div>
                  <ul className="mt-3 space-y-1.5">
                    {progress.map((m, i) => <li key={i} className="flex items-center gap-2 text-xs text-ink-500"><span className={`h-1.5 w-1.5 rounded-full ${i === progress.length - 1 ? 'bg-brand-500' : 'bg-ink-300'}`} />{m}</li>)}
                  </ul>
                </>
              ) : (
                <div className="flex items-start gap-2 rounded-lg bg-accent-50 px-3 py-2.5 text-sm text-accent-700"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>
              )}
            </div>
          )}

          {phase === 'done' && (
            <div className="py-4 text-center">
              <CheckCircle2 size={34} className="mx-auto text-brand-600" />
              <p className="mt-3 text-sm text-ink-700"><span className="font-semibold">{kb.name}</span> is set up — taxonomy, tailored copy and graph are ready.</p>
              <p className="mt-1 text-xs text-ink-400">Now add content with <span className="font-medium">Add a theme</span> or upload/crawl — new resources can be classified into your taxonomy.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3">
          <div>
            {phase === 'review' && <button onClick={() => setPhase('describe')} className="btn-ghost btn-sm"><ArrowLeft size={14} /> Back</button>}
            {phase === 'running' && error && <button onClick={() => setPhase('review')} className="btn-ghost btn-sm"><ArrowLeft size={14} /> Back</button>}
          </div>
          <div className="flex gap-2">
            {phase === 'describe' && <button onClick={describe} disabled={busy || !desc.trim()} className="btn-primary btn-sm">{busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Design setup</button>}
            {phase === 'review' && <button onClick={apply} disabled={!plan?.subject} className="btn-primary btn-sm"><Sparkles size={14} /> Apply setup</button>}
            {phase === 'done' && <button onClick={onClose} className="btn-primary btn-sm">Done</button>}
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}
