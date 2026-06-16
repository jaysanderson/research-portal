import { useEffect, useRef, useState } from 'react';
import { Database, Check, ChevronsUpDown, Lock } from 'lucide-react';
import { useConfig, useCurrentKb } from '../lib/hooks';
import { setSelectedKbId, getSelectedKbId } from '../lib/api';

export function KbSwitcher() {
  const config = useConfig();
  const current = useCurrentKb();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const kbs = config?.kbs || [];
  const select = (id: string) => {
    setOpen(false);
    if (id === getSelectedKbId()) return;
    setSelectedKbId(id);
    // Reload so every view reflects the newly selected Knowledge Box.
    window.location.assign('/');
  };

  if (!config) return <div className="skeleton mx-3 h-12 rounded-md" />;

  return (
    <div ref={ref} className="relative px-3 pb-2">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-md border border-[#272d36] bg-[#1a1f27] px-3 py-2 text-left transition-colors hover:border-[#34404e]">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-600/20 text-brand-300"><Database size={15} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-white">{current?.name || 'Knowledge Box'}</span>
          <span className="flex items-center gap-1.5 text-[11px] text-[#8a93a0]">
            <span className={`h-1.5 w-1.5 rounded-full ${current?.connected ? 'bg-brand-400' : 'bg-amber-400'}`} />
            {current?.connected ? 'Connected' : 'Offline'}
          </span>
        </span>
        <ChevronsUpDown size={14} className="shrink-0 text-[#8a93a0]" />
      </button>

      {open && (
        <div role="listbox" className="absolute left-3 right-3 z-50 mt-1 overflow-hidden rounded-md border border-ink-200 bg-white py-1 shadow-lg animate-fade-in">
          {kbs.map((kb) => {
            const active = kb.id === current?.id;
            const disabled = !kb.connected;
            return (
              <button key={kb.id} role="option" aria-selected={active} disabled={disabled} onClick={() => select(kb.id)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${
                  disabled ? 'cursor-not-allowed opacity-55' : active ? 'bg-brand-50' : 'hover:bg-ink-100'}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${active ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500'}`}>
                  {disabled ? <Lock size={12} /> : <Database size={13} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink-900">{kb.name}</span>
                  <span className="flex items-center gap-2 text-[11px] text-ink-500">
                    <span>{kb.connected ? 'Connected' : 'Not connected'}</span>
                    {kb.aragConfigured && <span className="rounded bg-accent-50 px-1 text-[10px] font-semibold text-accent-700">Agent</span>}
                  </span>
                </span>
                {active && <Check size={15} className="shrink-0 text-brand-600" />}
              </button>
            );
          })}
          {kbs.length === 0 && <div className="px-3 py-3 text-sm text-ink-500">No Knowledge Boxes configured.</div>}
        </div>
      )}
    </div>
  );
}
