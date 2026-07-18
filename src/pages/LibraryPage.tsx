import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchIcon, Loader2, FileText, Link2, File, Library as LibIcon, Film, Music, Image as ImageIcon, FileType, CalendarDays, LayoutGrid, List } from 'lucide-react';
import { listCatalog, mediaKind, type ResourceCard, type CatalogSortField, type MediaKind } from '../lib/nuclia';
import { FacetFilters } from '../components/search/FacetFilters';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, SkeletonGrid } from '../components/States';
import { useCurrentKb, useKbProfile, useKbImage } from '../lib/hooks';
import { StatusChip } from '../components/StatusChip';
import { cleanTitle, formatDate, gradientFor } from '../lib/util';

const PAGE = 24;

const SORTS = [
  { id: 'created-desc', label: 'Newest added', field: 'created' as CatalogSortField, order: 'desc' as const },
  { id: 'created-asc', label: 'Oldest added', field: 'created' as CatalogSortField, order: 'asc' as const },
  { id: 'modified-desc', label: 'Recently updated', field: 'modified' as CatalogSortField, order: 'desc' as const },
  { id: 'title-asc', label: 'Title A–Z', field: 'title' as CatalogSortField, order: 'asc' as const },
];
type SortId = (typeof SORTS)[number]['id'];

export default function LibraryPage() {
  const kb = useCurrentKb();
  const { profile } = useKbProfile();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [items, setItems] = useState<ResourceCard[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [sort, setSort] = useState<SortId>('created-desc');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [mediaFilter, setMediaFilter] = useState<MediaKind | null>(null);

  const load = useCallback(async (p: number, q: string, f: string[], append: boolean, sortId: SortId) => {
    setLoading(true); if (!append) setError(false);
    const s = SORTS.find((x) => x.id === sortId) || SORTS[0];
    try {
      const res = await listCatalog({ page: p, size: PAGE, query: q || undefined, filters: f.length ? f : undefined, sortField: s.field, sortOrder: s.order });
      setTotal(res.total);
      setItems((prev) => append ? [...prev, ...res.resources] : res.resources);
    } catch { if (!append) { setItems([]); setError(true); } } finally { setLoading(false); }
  }, []);

  useEffect(() => { setPage(0); load(0, query, filters, false, sort); }, [query, filters, sort, load]);
  // refetch when the KB changes
  useEffect(() => { const h = () => { setItems([]); setPage(0); setQuery(''); setFilters([]); setSort('created-desc'); load(0, '', [], false, 'created-desc'); }; window.addEventListener('rp-kb-change', h); return () => window.removeEventListener('rp-kb-change', h); }, [load]);

  const more = () => { const np = page + 1; setPage(np); load(np, query, filters, true, sort); };
  const toggle = (f: string) => setFilters((x) => x.includes(f) ? x.filter((y) => y !== f) : [...x, f]);
  const hasMore = items.length < total;

  // Media-type quick-filter over the loaded set (kinds present in the current results).
  const shown = useMemo(() => mediaFilter ? items.filter((r) => mediaKind(r.icon) === mediaFilter) : items, [items, mediaFilter]);
  const kindsPresent = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of items) { const k = mediaKind(r.icon); counts[k] = (counts[k] || 0) + 1; }
    return counts;
  }, [items]);
  const MEDIA: { id: MediaKind; label: string }[] = [
    { id: 'link', label: 'Web' }, { id: 'doc', label: 'Docs' }, { id: 'pdf', label: 'PDF' },
    { id: 'video', label: 'Video' }, { id: 'audio', label: 'Audio' }, { id: 'image', label: 'Image' }, { id: 'text', label: 'Text' },
  ];

  const desc = profile?.description
    ? `${profile.description}${total > 0 ? ` · ${total.toLocaleString()} resources` : ''}`
    : `Browse every resource in the Knowledge Box.${total > 0 ? ` ${total.toLocaleString()} total.` : ''}`;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <PageHeader title="Library" description={desc} />

      <form onSubmit={(e) => { e.preventDefault(); setQuery(input); }} className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <SearchIcon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={input} onChange={(e) => setInput(e.target.value)} aria-label="Filter library by title or keyword"
            placeholder="Filter by title or keyword…" className="input py-2.5 pl-10" />
        </div>
        <label className="relative">
          <span className="sr-only">Sort resources</span>
          <CalendarDays size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <select value={sort} onChange={(e) => setSort(e.target.value as SortId)}
            className="h-full cursor-pointer rounded-lg border border-ink-200 bg-white py-2.5 pl-8 pr-3 text-sm font-medium text-ink-700 outline-none focus:border-brand-400">
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <button className="btn-outline">Filter</button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setMediaFilter(null)} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${mediaFilter === null ? 'bg-ink-900 text-white' : 'border border-ink-200 bg-white text-ink-600 hover:bg-ink-100'}`}>All</button>
          {MEDIA.filter((m) => kindsPresent[m.id]).map((m) => (
            <button key={m.id} onClick={() => setMediaFilter(mediaFilter === m.id ? null : m.id)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${mediaFilter === m.id ? 'bg-ink-900 text-white' : 'border border-ink-200 bg-white text-ink-600 hover:bg-ink-100'}`}>
              {m.label} <span className="opacity-60">{kindsPresent[m.id]}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto inline-flex rounded-lg border border-ink-200 bg-white p-0.5">
          <button onClick={() => setView('grid')} aria-pressed={view === 'grid'} aria-label="Grid view" className={`rounded px-2 py-1 ${view === 'grid' ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-ink-100'}`}><LayoutGrid size={15} /></button>
          <button onClick={() => setView('list')} aria-pressed={view === 'list'} aria-label="List view" className={`rounded px-2 py-1 ${view === 'list' ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-ink-100'}`}><List size={15} /></button>
        </div>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block"><FacetFilters selected={filters} onToggle={toggle} onClear={() => setFilters([])} /></aside>
        <div className="min-w-0">
          {loading && items.length === 0 ? (
            <SkeletonGrid count={6} cols="sm:grid-cols-2 xl:grid-cols-3" height="h-56" />
          ) : error && items.length === 0 ? (
            <ErrorState message="Couldn’t load resources — the Knowledge Box may still be waking up." onRetry={() => load(0, query, filters, false, sort)} />
          ) : items.length === 0 ? (
            <EmptyState compact icon={<LibIcon size={22} strokeWidth={1.75} />} title="No resources match"
              description="Try a different keyword or clear the filters." />
          ) : (
            <>
              {view === 'grid' ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {shown.map((r) => <LibCard key={r.id} r={r} kbId={kb?.id || ''} />)}
                </div>
              ) : (
                <div className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200 bg-white">
                  {shown.map((r) => <LibRow key={r.id} r={r} />)}
                </div>
              )}
              {mediaFilter && shown.length === 0 && (
                <p className="mt-4 text-sm text-ink-500">No {mediaFilter} resources in the loaded set — clear the filter or load more.</p>
              )}
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

function kindOf(icon?: string): { label: string; Icon: typeof FileText } {
  const i = icon || '';
  if (i.includes('stf-link') || i.includes('html')) return { label: 'Link', Icon: Link2 };
  if (i.startsWith('video')) return { label: 'Video', Icon: Film };
  if (i.startsWith('audio')) return { label: 'Audio', Icon: Music };
  if (i.startsWith('image')) return { label: 'Image', Icon: ImageIcon };
  if (i.includes('pdf')) return { label: 'PDF', Icon: FileType };
  if (i.startsWith('text')) return { label: 'Text', Icon: FileText };
  return { label: 'Document', Icon: File };
}
function safeHost(u?: string) { if (!u) return ''; try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } }

function LibRow({ r }: { r: ResourceCard }) {
  const { label, Icon } = kindOf(r.icon);
  return (
    <Link to={`/knowledge/${r.id}`} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-ink-50">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500"><Icon size={15} /></span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink-900">{cleanTitle(r.title)}</div>
        <div className="flex items-center gap-1.5 truncate text-xs text-ink-500">
          <span className="shrink-0 rounded bg-ink-100 px-1.5 text-[10px] font-semibold text-ink-500">{label}</span>
          {r.url && <span className="truncate">{safeHost(r.url)}</span>}
          {r.created && <span className="shrink-0 text-ink-400">· {formatDate(r.created)}</span>}
        </div>
      </div>
      {r.status && r.status !== 'PROCESSED' && <StatusChip status={r.status} />}
      <div className="hidden shrink-0 gap-1.5 sm:flex">{r.classifications.slice(0, 2).map((c, i) => <span key={i} className="chip">{c.label}</span>)}</div>
    </Link>
  );
}

function LibCard({ r, kbId }: { r: ResourceCard; kbId: string }) {
  const src = useKbImage(r.thumbnail, kbId);
  const [failed, setFailed] = useState(false);
  const { label, Icon } = kindOf(r.icon);
  return (
    <Link to={`/knowledge/${r.id}`} className="card card-hover group flex flex-col overflow-hidden focus-visible:outline-none">
      <div className="relative aspect-video w-full overflow-hidden" style={{ background: gradientFor(r.title) }}>
        {src && !failed ? (
          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" onError={() => setFailed(true)} />
        ) : (
          <div className="flex h-full items-center justify-center text-white/85"><Icon size={30} strokeWidth={1.5} /></div>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
          <Icon size={11} /> {label}
        </span>
        {r.status && r.status !== 'PROCESSED' && <span className="absolute right-2 top-2"><StatusChip status={r.status} /></span>}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink-900 group-hover:text-brand-700">{cleanTitle(r.title)}</h3>
        <div className="mt-1 flex items-center gap-1.5 truncate text-xs text-ink-500">
          {r.url && <span className="truncate">{safeHost(r.url)}</span>}
          {r.url && r.created && <span className="text-ink-300">·</span>}
          {r.created && <span className="shrink-0">Added {formatDate(r.created)}</span>}
        </div>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
          {r.classifications.slice(0, 3).map((c, i) => <span key={i} className="chip">{c.label}</span>)}
        </div>
      </div>
    </Link>
  );
}
