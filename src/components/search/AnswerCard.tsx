import { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, Compass } from 'lucide-react';
import { ask, isRefusal, type Citation, type CitationMark } from '../../lib/nuclia';
import { renderWithCitations } from '../../lib/markdown';
import { Citations } from '../Citations';
import { AnswerJourney } from '../journey/AnswerJourney';
import { friendlyError } from '../../lib/util';

export function AnswerCard({ query, filters }: { query: string; filters: string[] }) {
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [marks, setMarks] = useState<CitationMark[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [journey, setJourney] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!query.trim()) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    // Debounce so rapid facet toggles don't fire a fresh generation on every click.
    const timer = setTimeout(() => {
      setAnswer(''); setCitations([]); setMarks([]); setError(null); setStreaming(true);
      (async () => {
        try {
          for await (const chunk of ask(query, { filters, signal: ctrl.signal })) {
            if (chunk.kind === 'answer' && chunk.text) setAnswer((a) => a + chunk.text);
            if (chunk.kind === 'citations' && chunk.citations) { setCitations(chunk.citations); setMarks(chunk.marks || []); }
          }
        } catch (err) {
          if (!ctrl.signal.aborted) setError(friendlyError(err, 'Could not generate an answer. Please try again.'));
        } finally {
          if (!ctrl.signal.aborted) setStreaming(false);
        }
      })();
    }, 450);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [query, filters.join('|')]);

  if (!query.trim()) return null;

  const clean = isRefusal(answer) ? '' : answer;

  return (
    <div className="card border-brand-100 bg-gradient-to-br from-brand-50/50 to-white p-5">
      <div className="mb-2 flex items-center gap-2 text-brand-700">
        <Sparkles size={16} strokeWidth={2} />
        <span className="t-h3 text-brand-800">AI Answer</span>
        {streaming && <span className="ml-1 inline-flex items-center gap-1.5 text-xs font-normal text-ink-500"><Loader2 size={12} className="animate-spin" />{answer ? 'Writing…' : 'Reading sources…'}</span>}
      </div>
      {error ? (
        <p className="text-sm text-data-clay">{error}</p>
      ) : (
        <>
          {clean ? (
            <div className="prose-answer" dangerouslySetInnerHTML={{ __html: renderWithCitations(clean, streaming ? [] : marks) }} />
          ) : streaming ? (
            <div className="space-y-2"><div className="skeleton h-3 w-5/6" /><div className="skeleton h-3 w-4/6" /><div className="skeleton h-3 w-3/5" /></div>
          ) : (
            <p className="text-sm text-ink-500">No grounded answer for this query — try rephrasing, or browse the ranked results below.</p>
          )}
          <Citations citations={citations} />
          {clean && !streaming && (
            <div className="mt-3">
              <button onClick={() => setJourney(true)}
                className="group inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-50">
                <Compass size={14} className="transition-transform group-hover:rotate-12" /> Journey through the context
              </button>
            </div>
          )}
          <AnswerJourney open={journey} query={query} filters={filters}
            citedIds={citations.map((c) => c.resourceId || '').filter(Boolean)} onClose={() => setJourney(false)} />
        </>
      )}
    </div>
  );
}
