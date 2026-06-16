import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageSquare, Workflow, CornerDownLeft } from 'lucide-react';
import { NAV } from './layout/AppLayout';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('rp-open-palette', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('rp-open-palette', onOpen); };
  }, []);

  useEffect(() => { if (open) { setQ(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 20); } }, [open]);

  if (!open) return null;

  const term = q.trim().toLowerCase();
  const navMatches = NAV.filter((n) => n.label.toLowerCase().includes(term) || n.section.toLowerCase().includes(term));
  const askActions = term
    ? [
        { id: 'ask', label: `Ask the assistant: “${q}”`, icon: <MessageSquare size={16} />, to: `/assistant`, q },
        { id: 'search', label: `Search for “${q}”`, icon: <Search size={16} />, to: `/search?q=${encodeURIComponent(q)}` },
        { id: 'agentic', label: `Run agentic query: “${q}”`, icon: <Workflow size={16} />, to: `/agentic`, q },
      ]
    : [];
  const items = [...askActions, ...navMatches.map((n) => ({ id: n.to, label: n.label, icon: n.icon, to: n.to, section: n.section }))];
  const clampedActive = Math.min(active, Math.max(items.length - 1, 0));

  const go = (item: any) => {
    setOpen(false);
    if (item.q && item.to === '/assistant') { navigate('/assistant'); sessionStorage.setItem('rp_prefill', item.q); window.dispatchEvent(new Event('rp-prefill')); }
    else if (item.q && item.to === '/agentic') { navigate('/agentic'); sessionStorage.setItem('rp_prefill', item.q); window.dispatchEvent(new Event('rp-prefill')); }
    else navigate(item.to);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink-900/30 px-4 pt-[14vh]" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-ink-100 px-3">
          <Search size={16} className="text-ink-400" />
          <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === 'Enter' && items[clampedActive]) { e.preventDefault(); go(items[clampedActive]); }
            }}
            placeholder="Search or ask anything…" className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-ink-400" />
          <kbd className="hidden rounded border border-ink-200 px-1.5 py-0.5 text-[10px] text-ink-400 sm:block">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-500">No matches.</p>
          ) : items.map((item, i) => (
            <button key={item.id} onMouseEnter={() => setActive(i)} onClick={() => go(item)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm ${i === clampedActive ? 'bg-brand-50 text-brand-800' : 'text-ink-700 hover:bg-ink-100'}`}>
              <span className={i === clampedActive ? 'text-brand-700' : 'text-ink-400'}>{item.icon}</span>
              <span className="flex-1 truncate">{item.label}</span>
              {(item as any).section && <span className="text-[10px] uppercase tracking-wide text-ink-400">{(item as any).section}</span>}
              {i === clampedActive && <CornerDownLeft size={13} className="text-ink-400" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
