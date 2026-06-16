import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Loader2 } from 'lucide-react';
import { ask, type Citation } from '../../lib/nuclia';
import { renderMarkdown } from '../../lib/markdown';

export function AnswerCard({ query, filters }: { query: string; filters: string[] }) {
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!query.trim()) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setAnswer(''); setCitations([]); setError(null); setStreaming(true);
    (async () => {
      try {
        for await (const chunk of ask(query, { filters, signal: ctrl.signal })) {
          if (chunk.kind === 'answer' && chunk.text) setAnswer((a) => a + chunk.text);
          if (chunk.kind === 'citations' && chunk.citations) setCitations(chunk.citations);
        }
      } catch (err) {
        if (!ctrl.signal.aborted) setError(String(err).slice(0, 160));
      } finally {
        if (!ctrl.signal.aborted) setStreaming(false);
      }
    })();
    return () => ctrl.abort();
  }, [query, filters.join('|')]);

  if (!query.trim()) return null;

  return (
    <div className="card border-brand-100 bg-gradient-to-br from-brand-50/60 to-white p-5">
      <div className="mb-2 flex items-center gap-2 text-brand-700">
        <Sparkles size={16} />
        <span className="text-sm font-bold">AI Answer</span>
        {streaming && <Loader2 size={14} className="animate-spin text-brand-400" />}
      </div>
      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : (
        <>
          <div className="prose-answer" dangerouslySetInnerHTML={{ __html: renderMarkdown(answer || (streaming ? '' : '')) }} />
          {!answer && streaming && <div className="space-y-2"><div className="skeleton h-3 w-5/6" /><div className="skeleton h-3 w-4/6" /></div>}
          {citations.length > 0 && (
            <div className="mt-4 border-t border-brand-100 pt-3">
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-400">Sources</div>
              <div className="flex flex-wrap gap-1.5">
                {citations.map((c, i) => (
                  c.resourceId ? (
                    <Link key={i} to={`/knowledge/${c.resourceId}`} className="chip bg-white hover:border-brand-300 hover:text-brand-700">{i + 1}. {c.title}</Link>
                  ) : (
                    <span key={i} className="chip bg-white">{i + 1}. {c.title}</span>
                  )
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
