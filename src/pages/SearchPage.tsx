import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, Loader2, FileSearch } from 'lucide-react';
import { find, type FindResult, type RetrievalMode } from '../lib/nuclia';
import { FacetFilters } from '../components/search/FacetFilters';
import { AnswerCard } from '../components/search/AnswerCard';
import { ResultCard } from '../components/search/ResultCard';
import { EmptyState, ErrorState, SkeletonRows } from '../components/States';
import { useKbProfile } from '../lib/hooks';

const MODES: { id: RetrievalMode; label: string }[] = [
  { id: 'hybrid', label: 'Hybrid' }, { id: 'semantic', label: 'Semantic' }, { id: 'keyword', label: 'Keyword' },
];
const FALLBACK_EXAMPLES = ['key findings', 'comparison', 'best practices', 'recent developments'];

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('q') || '');
  const [query, setQuery] = useState(params.get('q') || '');
  const [mode, setMode] = useState<RetrievalMode>('hybrid');
  const [filters, setFilters] = useState<string[]>([]);
  const [results, setResults] = useState<FindResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useKbProfile();
  const examples = profile?.topics?.length ? profile.topics : FALLBACK_EXAMPLES;

  const run = useCallback(async (q: string, f: string[], m: RetrievalMode) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true); setError(null);
    try { setResults(await find(q, { filters: f, mode: m, pageSize: 25 })); }
    catch (e) { setError(String(e).slice(0, 160)); setResults([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { run(query, filters, mode); }, [query, filters, mode, run]);

  const submit = (e: React.FormEvent) => { e.preventDefault(); setQuery(input); setParams(input ? { q: input } : {}); };
  const toggle = (f: string) => setFilters((x) => x.includes(f) ? x.filter((y) => y !== f) : [...x, f]);
  const related = Array.from(new Set(results.flatMap((r) => r.labels))).slice(0, 8);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <form onSubmit={submit} role="search" className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} aria-label="Search the knowledge base"
            placeholder={profile?.subject ? `Search ${profile.subject}…` : 'Search the knowledge base…'} className="input py-3 pl-10" />
        </div>
        <button type="submit" className="btn-primary px-6">Search</button>
      </form>

      <div className="mt-3 flex items-center gap-2">
        <span className="t-overline mr-1">Mode</span>
        <div className="inline-flex rounded-md border border-ink-200 bg-white p-0.5" role="group" aria-label="Retrieval mode">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)} aria-pressed={mode === m.id}
              className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${mode === m.id ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100'}`}>{m.label}</button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block"><FacetFilters selected={filters} onToggle={toggle} onClear={() => setFilters([])} /></aside>
        <div className="min-w-0 space-y-4">
          {!query ? (
            <div className="card">
              <EmptyState icon={<FileSearch size={24} strokeWidth={1.75} />} title="Search your knowledge base"
                description="Get cited AI answers alongside ranked results. Try one of these:"
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    {examples.map((ex) => <button key={ex} onClick={() => { setInput(ex); setQuery(ex); setParams({ q: ex }); }} className="chip-link">{ex}</button>)}
                  </div>
                } />
            </div>
          ) : (
            <>
              {filters.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="t-overline mr-1">Filters</span>
                  {filters.map((f) => (
                    <button key={f} onClick={() => toggle(f)} className="chip-link" aria-label={`Remove filter ${f.split('/').pop()}`}>
                      {f.split('/').pop()} <span className="text-ink-400">✕</span>
                    </button>
                  ))}
                  <button onClick={() => setFilters([])} className="text-xs font-medium text-brand-700 hover:underline">Clear all</button>
                </div>
              )}
              <AnswerCard query={query} filters={filters} />

              {related.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="t-overline mr-1">Refine</span>
                  {related.map((l) => (
                    <button key={l} onClick={() => { const q = `${query} ${l}`.trim(); setInput(q); setQuery(q); }} className="chip-link">{l}</button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between">
                <h2 className="t-h3">{loading ? 'Searching…' : `${results.length} result${results.length === 1 ? '' : 's'}`}</h2>
                {loading && <Loader2 size={16} className="animate-spin text-brand-500" />}
              </div>

              {error ? <ErrorState message={error} onRetry={() => run(query, filters, mode)} />
                : loading ? <SkeletonRows count={4} height="h-24" />
                : results.length === 0 ? (
                  <EmptyState compact icon={<FileSearch size={22} strokeWidth={1.75} />} title="No results"
                    description="Try a broader query, switch retrieval mode, or clear filters." />
                ) : (
                  <div className="space-y-3">{results.map((r) => <ResultCard key={r.resourceId} r={r} />)}</div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
