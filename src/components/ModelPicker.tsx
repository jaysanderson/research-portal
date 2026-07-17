import { useEffect, useRef, useState } from 'react';
import { Cpu, Check, ChevronDown } from 'lucide-react';
import { GEN_MODELS, getModel, setModel, modelLabel } from '../lib/nuclia';

/** Choose the generative LLM for answers — 50+ models reachable over the one Nuclia key.
 *  Selection is global (localStorage) and flows into every /ask via generative_model. */
export function ModelPicker() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(getModel());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onChange = () => setCurrent(getModel());
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('rp-model-change', onChange);
    document.addEventListener('mousedown', onDoc);
    return () => { window.removeEventListener('rp-model-change', onChange); document.removeEventListener('mousedown', onDoc); };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} title="Answer model"
        className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:border-ink-300">
        <Cpu size={13} className="text-brand-600" /> {modelLabel(current)}
        <ChevronDown size={13} className="text-ink-400" />
      </button>
      {open && (
        <div role="listbox" className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-lg border border-ink-200 bg-white py-1 shadow-lg animate-fade-in">
          <div className="px-3 py-1.5 t-overline text-ink-400">Answer model · one key</div>
          {GEN_MODELS.map((m) => {
            const active = m.id === current;
            return (
              <button key={m.id || 'default'} role="option" aria-selected={active}
                onClick={() => { setModel(m.id); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${active ? 'bg-brand-50' : 'hover:bg-ink-100'}`}>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink-900">{m.label}</span>
                  <span className="block text-[11px] text-ink-500">{m.note}</span>
                </span>
                {active && <Check size={15} className="shrink-0 text-brand-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
