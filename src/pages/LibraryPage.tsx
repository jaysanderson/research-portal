import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchIcon, ExternalLink, Loader2, FileText, Link2, File, Library as LibIcon } from 'lucide-react';
import { listCatalog, type ResourceCard } from '../lib/nuclia';
import { FacetFilters } from '../components/search/FacetFilters';
import { StatusChip } from '../components/StatusChip';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, SkeletonGrid } from '../components/States';

const PAGE = 24;

export default function LibraryPage() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [items, setItems] = useState<ResourceCard[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p: number, q: string, f: string[], append: boolean) => {
    setLoading(true);
    try {
      const res = await listCatalog({ page: p, size: PAGE, query: q || undefined, filters: f.length ? f : undefined });
      setTotal(res.total);
      setItems((prev) => append ? [...prev, ...res.resources] : res.resources);
    } catch { if (!append) setItems([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { setPage(0); load(0, query, filters, false); }, [query, filters, load]);

  const more = () => { const np = page + 1; setPage(np); load(np, query, filters, true); };
  const toggle = (f: string) => setFilters((x) => x.includes(f) ? x.filter((y) => y !== f) : [...x, f]);
  const hasMore = items.length < total;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <PageHeader title="Library" description={`Browse every resource in the Knowledge Box.${total > 0 ? ` ${total.toLocaleString()} total.` : ''}`} />

      <form onSubmit={(e) => { e.preventDefault(); setQuery(input); }} className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={input} onChange={(e) => setInput(e.target.value)} aria-label="Filter library by title or keyword"
            placeholder="Filter by title or keyword…" className="input py-2.5 pl-10" />
        </div>
        <button className="btn-outline">Filter</button>
      </form>

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block"><FacetFilters selected={filters} onToggle={toggle} onClear={() => setFilters([])} /></aside>
        <div className="min-w-0">
          {loading && items.length === 0 ? (
            <SkeletonGrid count={6} />
          ) : items.length === 0 ? (
            <EmptyState compact icon={<LibIcon size={22} strokeWidth={1.75} />} title="No resources match"
              description="Try a different keyword or clear the filters." />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((r) => <LibCard key={r.id} r={r} />)}
              </div>
              {hasMore && (
                <div className="mt-6 text-center">
                  <button onClick={more} disabled={loading} className="btn-outline">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null} Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LibCard({ r }: { r: ResourceCard }) {
  const Icon = r.url ? Link2 : r.icon?.startsWith('text') ? FileText : File;
  return (
    <div className="card flex flex-col p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-2">
        <Icon size={16} className="mt-0.5 shrink-0 text-ink-400" />
        <Link to={`/knowledge/${r.id}`} className="min-w-0 flex-1 font-semibold leading-snug text-ink-900 hover:text-brand-700">{r.title}</Link>
        {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-ink-400 hover:text-brand-600"><ExternalLink size={15} /></a>}
      </div>
      {r.url && <div className="mt-1 truncate pl-6 text-xs text-ink-400">{safeHost(r.url)}</div>}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
        {r.classifications.slice(0, 3).map((c, i) => <span key={i} className="chip">{c.label}</span>)}
        <span className="ml-auto"><StatusChip status={r.status} /></span>
      </div>
    </div>
  );
}

function safeHost(u: string) { try { return new URL(u).hostname; } catch { return u; } }
