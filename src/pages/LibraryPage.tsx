import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchIcon, Loader2, FileText, Link2, File, Library as LibIcon, Film, Music, Image as ImageIcon, FileType } from 'lucide-react';
import { listCatalog, thumbnailUrl, type ResourceCard } from '../lib/nuclia';
import { FacetFilters } from '../components/search/FacetFilters';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, SkeletonGrid } from '../components/States';
import { useCurrentKb, useKbProfile } from '../lib/hooks';
import { StatusChip } from '../components/StatusChip';

const PAGE = 24;

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

  const load = useCallback(async (p: number, q: string, f: string[], append: boolean) => {
    setLoading(true);
    try {
      const res = await listCatalog({ page: p, size: PAGE, query: q || undefined, filters: f.length ? f : undefined });
      setTotal(res.total);
      setItems((prev) => append ? [...prev, ...res.resources] : res.resources);
    } catch { if (!append) setItems([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { setPage(0); load(0, query, filters, false); }, [query, filters, load]);
  // refetch when the KB changes
  useEffect(() => { const h = () => { setItems([]); setPage(0); load(0, '', [], false); setQuery(''); setFilters([]); }; window.addEventListener('rp-kb-change', h); return () => window.removeEventListener('rp-kb-change', h); }, [load]);

  const more = () => { const np = page + 1; setPage(np); load(np, query, filters, true); };
  const toggle = (f: string) => setFilters((x) => x.includes(f) ? x.filter((y) => y !== f) : [...x, f]);
  const hasMore = items.length < total;

  const desc = profile?.description
    ? `${profile.description}${total > 0 ? ` · ${total.toLocaleString()} resources` : ''}`
    : `Browse every resource in the Knowledge Box.${total > 0 ? ` ${total.toLocaleString()} total.` : ''}`;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <PageHeader title="Library" description={desc} />

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
            <SkeletonGrid count={6} cols="sm:grid-cols-2 xl:grid-cols-3" height="h-56" />
          ) : items.length === 0 ? (
            <EmptyState compact icon={<LibIcon size={22} strokeWidth={1.75} />} title="No resources match"
              description="Try a different keyword or clear the filters." />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((r) => <LibCard key={r.id} r={r} kbId={kb?.id || ''} />)}
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

const PALETTE: [string, string][] = [
  ['#1A6A4F', '#237D5E'], ['#0e7490', '#06b6d4'], ['#8E5C14', '#C8861A'],
  ['#7C5C8A', '#9b6fae'], ['#324160', '#5B7B8A'], ['#B5543F', '#cf6e57'],
];
function gradientFor(s: string): string {
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const [a, b] = PALETTE[h % PALETTE.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
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

function LibCard({ r, kbId }: { r: ResourceCard; kbId: string }) {
  const src = thumbnailUrl(r.thumbnail, kbId);
  const [imgOk, setImgOk] = useState(!!src);
  const { label, Icon } = kindOf(r.icon);
  return (
    <Link to={`/knowledge/${r.id}`} className="card card-hover group flex flex-col overflow-hidden focus-visible:outline-none">
      <div className="relative aspect-video w-full overflow-hidden" style={{ background: gradientFor(r.title) }}>
        {src && imgOk ? (
          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" onError={() => setImgOk(false)} />
        ) : (
          <div className="flex h-full items-center justify-center text-white/85"><Icon size={30} strokeWidth={1.5} /></div>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
          <Icon size={11} /> {label}
        </span>
        {r.status && r.status !== 'PROCESSED' && <span className="absolute right-2 top-2"><StatusChip status={r.status} /></span>}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink-900 group-hover:text-brand-700">{r.title}</h3>
        {r.url && <div className="mt-1 truncate text-xs text-ink-500">{safeHost(r.url)}</div>}
        <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
          {r.classifications.slice(0, 3).map((c, i) => <span key={i} className="chip">{c.label}</span>)}
        </div>
      </div>
    </Link>
  );
}
