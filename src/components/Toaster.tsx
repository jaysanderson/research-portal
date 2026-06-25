import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import type { ToastMsg } from '../lib/toast';

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  useEffect(() => {
    const onToast = (e: Event) => {
      const t = (e as CustomEvent<ToastMsg>).detail;
      setToasts((all) => [...all, t]);
      setTimeout(() => setToasts((all) => all.filter((x) => x.id !== t.id)), 4000);
    };
    window.addEventListener('rp-toast', onToast);
    return () => window.removeEventListener('rp-toast', onToast);
  }, []);
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[80] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} role="status" className="flex items-start gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm shadow-lg animate-fade-in">
          {t.kind === 'success' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-600" />
            : t.kind === 'error' ? <AlertCircle size={16} className="mt-0.5 shrink-0 text-data-clay" />
            : <Info size={16} className="mt-0.5 shrink-0 text-ink-400" />}
          <span className="min-w-0 flex-1 text-ink-700">{t.text}</span>
          <button onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} className="text-ink-300 hover:text-ink-600"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}
