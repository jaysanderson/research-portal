import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, Loader2 } from 'lucide-react';
import { find, type FindResult, type RetrievalMode } from '../lib/nuclia';
import { FacetFilters } from '../components/search/FacetFilters';
import { AnswerCard } from '../components/search/AnswerCard';
import { ResultCard } from '../components/search/ResultCard';

const MODES: RetrievalMode[] = ['hybrid', 'semantic', 'keyword'];

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('q') || '');
  const [query, setQuery] = useState(params.get('q') || '');
  const [mode, setMode] = useState<RetrievalMode>('hybrid');
  const [filters, setFilters] = useState<string[]>([]);
  const [results, setResults] = useState<FindResult[]>([]);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (q: string, f: string[], m: RetrievalMode) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try { setResults(await find(q, { filters: f, mode: m, pageSize: 25 })); }
    catch { setResults([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { run(query, filters, mode); }, [query, filters, mode, run]);

  const submit = (e: React.FormEvent) => { e.preventDefault(); setQuery(input); setParams(input ? { q: input } : {}); };
  const toggle = (f: string) => setFilters((x) => x.includes(f) ? x.filter((y) => y !== f) : [...x, f]);

  // Derived "related searches" from the labels surfaced in results.
  const related = Array.from(new Set(results.flatMap((r) => r.labels))).slice(0, 8);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <form onSubmit={submit} className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input autoFocus value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Search the CMS/DXP knowledge base…"
            className="w-full rounded-xl border border-ink-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-brand-400" />
        </div>
        <button type="submit" className="btn-primary px-6">Search</button>
      </form>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs font-semibold text-ink-400">Mode:</span>
        {MODES.map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
              mode === m ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}>{m}</button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block"><FacetFilters selected={filters} onToggle={toggle} onClear={() => setFilters([])} /></aside>
        <div className="min-w-0 space-y-4">
          {query && <AnswerCard query={query} filters={filters} />}

          {related.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-ink-400">Refine:</span>
              {related.map((l) => (
                <button key={l} onClick={() => { const q = `${query} ${l}`.trim(); setInput(q); setQuery(q); }}
                  className="chip hover:border-brand-300 hover:text-brand-700">{l}</button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-700">{loading ? 'Searching…' : query ? `${results.length} results` : 'Enter a query'}</h2>
            {loading && <Loader2 size={16} className="animate-spin text-brand-500" />}
          </div>

          {loading ? (
            <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24 w-full rounded-xl" />)}</div>
          ) : (
            <div className="space-y-3">{results.map((r) => <ResultCard key={r.resourceId} r={r} />)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
