import { Link } from 'react-router-dom';
import { ExternalLink, FileText } from 'lucide-react';
import type { FindResult } from '../../lib/nuclia';

export function ResultCard({ r }: { r: FindResult }) {
  return (
    <div className="card p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-2">
        <FileText size={16} className="mt-0.5 shrink-0 text-ink-400" />
        <div className="min-w-0 flex-1">
          <Link to={`/knowledge/${r.resourceId}`} className="font-semibold text-ink-900 hover:text-brand-700">{r.title}</Link>
          {r.url && <div className="truncate text-xs text-ink-400">{new URL(r.url).hostname}</div>}
        </div>
        {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-ink-400 hover:text-brand-600"><ExternalLink size={15} /></a>}
      </div>
      {r.paragraphs[0] && (
        <p className="mt-2 line-clamp-2 text-sm text-ink-600">{r.paragraphs[0].text}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {r.labels.slice(0, 4).map((l) => <span key={l} className="chip">{l}</span>)}
        {r.score > 0 && <span className="ml-auto text-[11px] text-ink-400">score {r.score.toFixed(2)}</span>}
      </div>
    </div>
  );
}
