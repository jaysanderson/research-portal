import { Link } from 'react-router-dom';
import { ExternalLink, FileText } from 'lucide-react';
import type { FindResult } from '../../lib/nuclia';
import { toPlainText } from '../../lib/markdown';

function safeHost(u?: string) { if (!u) return ''; try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } }

export function ResultCard({ r }: { r: FindResult }) {
  const snippet = r.paragraphs[0] ? toPlainText(r.paragraphs[0].text) : '';
  return (
    <div className="card card-hover p-4">
      <div className="flex items-start gap-2.5">
        <FileText size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-400" />
        <div className="min-w-0 flex-1">
          <Link to={`/knowledge/${r.resourceId}`} className="t-h3 hover:text-brand-700">{r.title}</Link>
          {r.url && <div className="truncate text-xs text-ink-500">{safeHost(r.url)}</div>}
        </div>
        {r.url && <a href={r.url} target="_blank" rel="noreferrer" aria-label="Open source" className="text-ink-400 hover:text-brand-600"><ExternalLink size={15} /></a>}
      </div>
      {snippet && <p className="mt-2 line-clamp-2 text-sm text-ink-600">{snippet}</p>}
      {r.labels.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {r.labels.slice(0, 4).map((l) => <span key={l} className="chip">{l}</span>)}
        </div>
      )}
    </div>
  );
}
