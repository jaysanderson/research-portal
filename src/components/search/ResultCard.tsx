import { Link } from 'react-router-dom';
import { ExternalLink, FileText, Film, Music, Image as ImageIcon, FileType2, Link2 } from 'lucide-react';
import { mediaKind, type FindResult, type MediaKind } from '../../lib/nuclia';
import { useCurrentKb, useKbImage } from '../../lib/hooks';
import { toPlainText } from '../../lib/markdown';
import { cleanTitle, stripBoilerplate, formatDate, sanitizeHighlight } from '../../lib/util';

function safeHost(u?: string) { if (!u) return ''; try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } }

const KIND: Record<MediaKind, { icon: typeof FileText; label: string; cls: string }> = {
  video: { icon: Film, label: 'Video', cls: 'bg-data-plum/10 text-data-plum' },
  audio: { icon: Music, label: 'Audio', cls: 'bg-data-clay/10 text-data-clay' },
  pdf: { icon: FileType2, label: 'PDF', cls: 'bg-accent-100 text-accent-700' },
  image: { icon: ImageIcon, label: 'Image', cls: 'bg-data-green/10 text-data-green' },
  doc: { icon: FileText, label: 'Doc', cls: 'bg-brand-50 text-brand-700' },
  link: { icon: Link2, label: 'Web', cls: 'bg-ink-100 text-ink-500' },
  text: { icon: FileText, label: 'Text', cls: 'bg-ink-100 text-ink-500' },
};

export function ResultCard({ r }: { r: FindResult }) {
  const kb = useCurrentKb();
  const thumb = useKbImage(r.thumbnail, kb?.id);
  const kind = mediaKind(r.icon);
  const meta = KIND[kind];
  const Icon = meta.icon;

  // Keep Nuclia's <mark> highlights; strip nav/cookie chrome for the length test.
  const snippetHtml = (() => {
    for (const p of r.paragraphs) {
      const plain = stripBoilerplate(toPlainText(p.text || '')).trim();
      if (plain.length > 20) return sanitizeHighlight((p.text || '').replace(/\s+/g, ' ').trim());
    }
    const s = stripBoilerplate(toPlainText(r.summary || '')).trim();
    return s.length > 20 ? sanitizeHighlight(s) : '';
  })();

  return (
    <div className="card card-hover p-4">
      <div className="flex items-start gap-3">
        {thumb ? (
          <Link to={`/knowledge/${r.resourceId}`} className="hidden shrink-0 overflow-hidden rounded-lg border border-ink-200 sm:block">
            <img src={thumb} alt="" className="h-14 w-20 object-cover object-top" loading="lazy" />
          </Link>
        ) : (
          <span className={`hidden h-14 w-20 shrink-0 items-center justify-center rounded-lg sm:flex ${meta.cls}`}><Icon size={20} strokeWidth={1.75} /></span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <Link to={`/knowledge/${r.resourceId}`} className="t-h3 hover:text-brand-700">{cleanTitle(r.title)}</Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-500">
                <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.cls}`}><Icon size={10} /> {meta.label}</span>
                {r.url && <span className="truncate">{safeHost(r.url)}</span>}
                {r.created && <span className="text-ink-400">· {formatDate(r.created)}</span>}
              </div>
            </div>
            {r.score > 0 && (
              <span title="Relevance" className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">{Math.round(Math.min(r.score, 1) * 100)}%</span>
            )}
            {r.url && <a href={r.url} target="_blank" rel="noreferrer" aria-label="Open source" className="shrink-0 text-ink-400 hover:text-brand-600"><ExternalLink size={15} /></a>}
          </div>
          {snippetHtml && <p className="prose-snippet mt-2 line-clamp-2 text-sm text-ink-600" dangerouslySetInnerHTML={{ __html: snippetHtml }} />}
          {r.labels.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {r.labels.slice(0, 4).map((l) => <span key={l} className="chip">{l}</span>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
