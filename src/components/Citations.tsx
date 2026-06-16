import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import type { Citation } from '../lib/nuclia';

function host(u?: string) { if (!u) return ''; try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }

/** Numbered citation reference with a hover preview card and click-through. */
export function CitationRef({ index, c }: { index: number; c: Citation }) {
  const inner = (
    <>
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">{index}</span>
      <span className="max-w-[180px] truncate">{c.title}</span>
    </>
  );
  return (
    <span className="group relative inline-flex">
      {c.resourceId ? (
        <Link to={`/knowledge/${c.resourceId}`} className="chip-link">{inner}</Link>
      ) : (
        <span className="chip">{inner}</span>
      )}
      {/* hover preview */}
      <span className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 hidden w-64 rounded-lg border border-ink-200 bg-white p-3 text-left shadow-md group-hover:block">
        <span className="block text-xs font-semibold leading-snug text-ink-900">{c.title}</span>
        {c.url && <span className="mt-1 block truncate text-[11px] text-ink-500">{host(c.url)}</span>}
        <span className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-brand-700">Open source <ExternalLink size={11} /></span>
      </span>
    </span>
  );
}

export function Citations({ citations, label = 'Sources' }: { citations: Citation[]; label?: string }) {
  if (!citations.length) return null;
  return (
    <div className="mt-4 border-t border-ink-100 pt-3">
      <div className="mb-1.5 t-overline">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {citations.map((c, i) => <CitationRef key={i} index={i + 1} c={c} />)}
      </div>
    </div>
  );
}
