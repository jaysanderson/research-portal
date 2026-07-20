import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, Loader2, FileSearch, Tag, Sparkles, ImagePlus, X, Bookmark } from 'lucide-react';
import { find, suggest, rephrase, listSearchConfigs, saveSearchConfig, deleteSearchConfig, type FindResult, type RetrievalMode, type Suggestion, type SavedSearch } from '../lib/nuclia';
import { toast } from '../lib/toast';
import { logQuery } from '../lib/querylog';
import { FacetFilters } from '../components/search/FacetFilters';
import { AnswerCard } from '../components/search/AnswerCard';
import { ResultCard } from '../components/search/ResultCard';
import { ModelPicker } from '../components/ModelPicker';
import { MicButton } from '../components/MicButton';
import { EmptyState, ErrorState, SkeletonRows } from '../components/States';
import { useKbProfile } from '../lib/hooks';

const MODES: { id: RetrievalMode; label: string }[] = [
  { id: 'hybrid', label: 'Hybrid' }, { id: 'semantic', label: 'Semantic' }, { id: 'keyword', label: 'Keyword' },
];
const SORTS = [{ id: 'relevance', label: 'Relevance' }, { id: 'date', label: 'Newest' }, { id: 'title', label: 'Title' }] as const;
type SortId = typeof SORTS[number]['id'];
// Paragraph-kind filters (ARAG filter_expression) — surfaces content the platform
// extracted from scans, tables and media that plain text search hides.
const KINDS = [
  { id: 'OCR', label: 'Scanned (OCR)' },
  { id: 'TABLE', label: 'Tables' },
  { id: 'TRANSCRIPT', label: 'Transcripts' },
] as const;
type KindId = typeof KINDS[number]['id'];
const LANGS = [
  { id: 'en', label: 'English' }, { id: 'es', label: 'Spanish' }, { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' }, { id: 'pt', label: 'Portuguese' }, { id: 'it', label: 'Italian' }, { id: 'nl', label: 'Dutch' },
];
const PAGE = 12;
const FALLBACK_EXAMPLES = ['key findings', 'comparison', 'best practices', 'recent developments'];

/** Saved searches live on the Knowledge Box (search_configurations), so they follow
 *  the box across devices rather than sitting in one browser. */
function SavedSearches({ current, onApply }: { current: SavedSearch; onApply: (s: SavedSearch) => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Record<string, SavedSearch>>({});
  const ref = useRef<HTMLDivElement>(null);

  const reload = () => listSearchConfigs().then(setItems).catch(() => setItems({}));
  useEffect(() => { reload(); }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const save = async () => {
    const name = window.prompt('Name this search');
    if (!name?.trim()) return;
    try { await saveSearchConfig(name.trim(), current); await reload(); toast(`Saved “${name.trim()}”.`, 'success'); }
    catch { toast('Could not save this search.', 'error'); }
  };

  const names = Object.keys(items);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} title="Saved searches"
        className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:border-ink-300">
        <Bookmark size={14} className="text-brand-600" /> Saved{names.length ? ` (${names.length})` : ''}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-64 overflow-hidden rounded-lg border border-ink-200 bg-white py-1 shadow-lg animate-fade-in">
          <button onClick={() => { setOpen(false); save(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-brand-700 hover:bg-brand-50">
            <Bookmark size={14} /> Save current search
          </button>
          {names.length > 0 && <div className="my-1 border-t border-ink-100" />}
          {names.map((n) => (
            <div key={n} className="flex items-center gap-1 px-1">
              <button onClick={() => { onApply(items[n]); setOpen(false); }} className="min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-sm text-ink-700 hover:bg-ink-100">{n}</button>
              <button onClick={async () => { await deleteSearchConfig(n).catch(() => {}); reload(); }} aria-label={`Delete ${n}`} className="shrink-0 px-1.5 text-ink-400 hover:text-data-clay"><X size={13} /></button>
            </div>
          ))}
          {names.length === 0 && <p className="px-3 py-2 text-xs text-ink-400">No saved searches yet.</p>}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('q') || '');
  const [query, setQuery] = useState(params.get('q') || '');
  const [mode, setMode] = useState<RetrievalMode>('hybrid');
  const [sort, setSort] = useState<SortId>('relevance');
  const [filters, setFilters] = useState<string[]>([]);
  const [results, setResults] = useState<FindResult[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [kind, setKind] = useState<KindId | null>(null);
  const [language, setLanguage] = useState('');
  const [matchAny, setMatchAny] = useState(false);
  const [nonce, setNonce] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const { profile } = useKbProfile();

  // Entity scope arrives via the URL (e.g. from a resource's entity chips).
  const entityValue = params.get('entity') || '';
  const entityType = params.get('etype') || 'ORG';

  const parseLabel = (p: string) => { const m = p.match(/^\/classification\.labels\/([^/]+)\/(.+)$/); return m ? { labelset: m[1], label: m[2] } : null; };
  /** Compose ARAG filter_expression from entity + language + label-any + paragraph kind. */
  const buildFE = (k: KindId | null, f: string[]) => {
    const clauses: any[] = [];
    if (entityValue) clauses.push({ prop: 'entity', subtype: entityType, value: entityValue });
    if (language) clauses.push({ prop: 'language', language });
    if (matchAny && f.length > 1) {
      const ls = f.map(parseLabel).filter(Boolean) as { labelset: string; label: string }[];
      if (ls.length) clauses.push({ or: ls.map((l) => ({ prop: 'label', ...l })) });
    }
    const fe: any = {};
    if (clauses.length) fe.field = clauses.length === 1 ? clauses[0] : { and: clauses };
    if (k) fe.paragraph = { prop: 'kind', kind: k };
    if (fe.field && fe.paragraph) fe.operator = 'and';
    return Object.keys(fe).length ? fe : undefined;
  };
  // Labels go through legacy AND filters unless we're doing an OR (match-any) pass.
  const legacyFilters = (f: string[]) => (matchAny && f.length > 1 ? [] : f);
  const examples = profile?.topics?.length ? profile.topics : FALLBACK_EXAMPLES;

  // Typeahead: ARAG /suggest over indexed paragraphs + extracted entities.
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  useEffect(() => {
    const q = input.trim();
    if (q.length < 2 || q === query) { setSuggestions([]); return; }
    let active = true; const ctrl = new AbortController();
    const t = setTimeout(() => {
      suggest(q, { signal: ctrl.signal }).then((s) => { if (active) { setSuggestions(s); setShowSuggest(true); } }).catch(() => {});
    }, 180);
    return () => { active = false; ctrl.abort(); clearTimeout(t); };
  }, [input, query]);
  const pick = (text: string) => { setInput(text); setQuery(text); setParams({ q: text }); setShowSuggest(false); };

  // Primary search — re-runs whenever the query or any scope changes.
  useEffect(() => {
    if (!query.trim()) { setResults([]); setHasMore(false); setDidYouMean(null); return; }
    let active = true;
    setLoading(true); setError(null); setPage(0); setDidYouMean(null);
    find(query, { filters: legacyFilters(filters), mode, pageSize: PAGE, page: 0, highlight: true, filterExpression: buildFE(kind, filters) })
      .then((batch) => {
        if (!active) return;
        setResults(batch); setHasMore(batch.length >= PAGE);
        logQuery(query, batch.length);
        if (batch.length === 0) rephrase(query).then((r) => { if (active && r && r.toLowerCase() !== query.toLowerCase()) setDidYouMean(r); }).catch(() => {});
      })
      .catch((e) => { if (active) { setError(String(e).slice(0, 160)); setResults([]); setHasMore(false); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filters.join('|'), mode, kind, language, matchAny, entityValue, entityType, nonce]);

  const loadMore = async () => {
    const next = page + 1;
    setLoadingMore(true);
    try {
      const batch = await find(query, { filters: legacyFilters(filters), mode, pageSize: PAGE, page: next, highlight: true, filterExpression: buildFE(kind, filters) });
      setResults((r) => [...r, ...batch.filter((b) => !r.some((x) => x.resourceId === b.resourceId))]);
      setPage(next); setHasMore(batch.length >= PAGE);
    } catch { setHasMore(false); } finally { setLoadingMore(false); }
  };

  const clearEntity = () => { const p = new URLSearchParams(params); p.delete('entity'); p.delete('etype'); setParams(p); };

  const sorted = useMemo(() => {
    const arr = [...results];
    if (sort === 'date') arr.sort((a, b) => (b.created || '').localeCompare(a.created || ''));
    else if (sort === 'title') arr.sort((a, b) => a.title.localeCompare(b.title));
    return arr; // 'relevance' keeps server order
  }, [results, sort]);

  // Multimodal: search the KB by an uploaded image (ARAG query_image).
  const onImage = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = String(reader.result).split(',')[1];
      if (!b64) return;
      setLoading(true); setError(null); setImageName(file.name); setQuery(''); setResults([]); setHasMore(false);
      try { setResults(await find('', { queryImage: { b64encoded: b64, content_type: file.type || 'image/png' }, pageSize: PAGE, mode: 'semantic' })); }
      catch (e) { setError(String(e).slice(0, 160)); } finally { setLoading(false); }
    };
    reader.readAsDataURL(file);
  };

  const submit = (e: React.FormEvent) => { e.preventDefault(); setShowSuggest(false); setImageName(null); setQuery(input); setParams(input ? { q: input } : {}); };
  const toggle = (f: string) => setFilters((x) => x.includes(f) ? x.filter((y) => y !== f) : [...x, f]);
  const related = Array.from(new Set(results.flatMap((r) => r.labels))).slice(0, 8);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <form onSubmit={submit} role="search" className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} aria-label="Search the knowledge base"
            onFocus={() => suggestions.length && setShowSuggest(true)}
            onBlur={() => setTimeout(() => setShowSuggest(false), 120)}
            role="combobox" aria-expanded={showSuggest && suggestions.length > 0} aria-autocomplete="list" aria-controls="search-suggestions"
            placeholder={profile?.subject ? `Search ${profile.subject}…` : 'Search the knowledge base…'} className="input py-3 pl-10" />
          {showSuggest && suggestions.length > 0 && (
            <ul id="search-suggestions" role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-ink-200 bg-white py-1 shadow-lg animate-fade-in">
              {suggestions.map((s) => (
                <li key={`${s.kind}:${s.text}`} role="option" aria-selected={false}>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); pick(s.text); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink-700 hover:bg-ink-100">
                    {s.kind === 'entity'
                      ? <Tag size={13} className="shrink-0 text-accent-500" />
                      : <SearchIcon size={13} className="shrink-0 text-ink-400" />}
                    <span className="truncate">{s.text}</span>
                    {s.kind === 'entity' && <span className="ml-auto rounded bg-accent-50 px-1.5 text-[10px] font-semibold text-accent-700">entity</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <MicButton onText={(t) => setInput(t)} className="py-3" />
        <button type="submit" className="btn-primary px-6">Search</button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="t-overline mr-1">Mode</span>
        <div className="inline-flex rounded-md border border-ink-200 bg-white p-0.5" role="group" aria-label="Retrieval mode">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)} aria-pressed={mode === m.id}
              className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${mode === m.id ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100'}`}>{m.label}</button>
          ))}
        </div>
        <span className="t-overline ml-2 mr-0.5">Content</span>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setKind(null)} aria-pressed={kind === null}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${kind === null ? 'bg-ink-900 text-white' : 'border border-ink-200 bg-white text-ink-600 hover:bg-ink-100'}`}>All</button>
          {KINDS.map((k) => (
            <button key={k.id} onClick={() => setKind(kind === k.id ? null : k.id)} aria-pressed={kind === k.id}
              title={`Only results whose matched passage came from ${k.label.toLowerCase()}`}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${kind === k.id ? 'bg-ink-900 text-white' : 'border border-ink-200 bg-white text-ink-600 hover:bg-ink-100'}`}>{k.label}</button>
          ))}
        </div>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Language"
          className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs font-semibold text-ink-700 outline-none focus:border-brand-500">
          <option value="">Any language</option>
          {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        {filters.length > 1 && (
          <button onClick={() => setMatchAny((v) => !v)} title="Match all selected labels, or any of them"
            className="rounded-full border border-ink-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink-600 hover:bg-ink-100">
            {matchAny ? 'Match any' : 'Match all'}
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <SavedSearches
            current={{ mode, kind, language, labels: filters, matchAny, query }}
            onApply={(s) => {
              setMode(s.mode); setKind((s.kind as KindId) || null); setLanguage(s.language || '');
              setFilters(s.labels || []); setMatchAny(!!s.matchAny);
              if (s.query) { setInput(s.query); setQuery(s.query); setParams({ q: s.query }); }
            }} />
          {results.length > 0 && !imageName && (
            <select value={sort} onChange={(e) => setSort(e.target.value as SortId)} aria-label="Sort results"
              className="rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-700 outline-none focus:border-brand-500">
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onImage(e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" onClick={() => fileRef.current?.click()} title="Search the Knowledge Box by image"
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:border-ink-300"><ImagePlus size={14} className="text-brand-600" /> Image</button>
          <ModelPicker />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block"><FacetFilters selected={filters} onToggle={toggle} onClear={() => setFilters([])} /></aside>
        <div className="min-w-0 space-y-4">
          {!query && !imageName ? (
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
              {entityValue && (
                <div className="flex items-center gap-2 rounded-lg border border-accent-200 bg-accent-50/60 px-3 py-2">
                  <Tag size={14} className="shrink-0 text-accent-600" />
                  <span className="text-sm text-ink-700">Scoped to entity <b className="font-semibold">{entityValue}</b> <span className="text-ink-400">({entityType})</span></span>
                  <button onClick={clearEntity} aria-label="Clear entity scope" className="ml-auto text-ink-400 hover:text-ink-700"><X size={15} /></button>
                </div>
              )}
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
              {imageName ? (
                <div className="card flex items-center justify-between gap-2 border-brand-100 bg-brand-50/40 p-3">
                  <span className="flex items-center gap-2 text-sm text-ink-700"><ImagePlus size={15} className="text-brand-600" /> Results visually similar to <b className="font-semibold">{imageName}</b></span>
                  <button onClick={() => { setImageName(null); setResults([]); }} aria-label="Clear image search" className="text-ink-400 hover:text-ink-700"><X size={15} /></button>
                </div>
              ) : (
                <AnswerCard query={query} filters={filters} />
              )}

              {!imageName && related.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="t-overline mr-1">Refine</span>
                  {related.map((l) => (
                    <button key={l} onClick={() => { const q = `${query} ${l}`.trim(); setInput(q); setQuery(q); }} className="chip-link">{l}</button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between">
                <h2 className="t-h3">{loading ? 'Searching…' : `${results.length}${hasMore ? '+' : ''} result${results.length === 1 ? '' : 's'}`}</h2>
                {loading && <Loader2 size={16} className="animate-spin text-brand-500" />}
              </div>

              {error ? <ErrorState message={error} onRetry={() => setNonce((n) => n + 1)} />
                : loading ? <SkeletonRows count={4} height="h-24" />
                : results.length === 0 ? (
                  <EmptyState compact icon={<FileSearch size={22} strokeWidth={1.75} />} title="No results"
                    description="Try a broader query, switch retrieval mode, or clear filters."
                    action={didYouMean ? (
                      <button onClick={() => pick(didYouMean)} className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-100">
                        <Sparkles size={14} /> Did you mean “{didYouMean}”?
                      </button>
                    ) : undefined} />
                ) : (
                  <>
                    <div className="space-y-3">{sorted.map((r) => <ResultCard key={r.resourceId} r={r} />)}</div>
                    {hasMore && (
                      <div className="pt-1 text-center">
                        <button onClick={loadMore} disabled={loadingMore} className="btn-outline">
                          {loadingMore ? <Loader2 size={15} className="animate-spin" /> : null} Load more
                        </button>
                      </div>
                    )}
                  </>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
