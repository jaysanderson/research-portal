import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Download } from 'lucide-react';
import { getResource, resourceFileUrl, resourceFileBlobUrl, thumbnailUrl } from '../lib/nuclia';
import { useChat } from '../lib/useChat';
import { useCurrentKb } from '../lib/hooks';
import { ChatThread } from '../components/chat/ChatThread';
import { StatusChip } from '../components/StatusChip';
import { SaveButton } from '../components/SaveButton';
import { ErrorState } from '../components/States';
import { cleanTitle, stripBoilerplate, formatDate } from '../lib/util';
import { renderMarkdown } from '../lib/markdown';

interface FileField { fieldId: string; contentType: string; filename?: string }
interface Detail {
  title: string;
  url?: string;
  summary?: string;
  status?: string;
  text: string;
  thumbnail?: string;
  file?: FileField;
  labels: { labelset: string; label: string }[];
  created?: string;
}

function extractText(r: any): string {
  const parts: string[] = [];
  const data = r?.data || {};
  for (const group of ['texts', 'links', 'files', 'conversations']) {
    for (const field of Object.values<any>(data[group] || {})) {
      const t = field?.extracted?.text?.text;
      if (t) parts.push(t);
      const body = field?.value?.body;
      if (body && !t) parts.push(body);
    }
  }
  return parts.join('\n\n').trim();
}

function pickFile(r: any): FileField | undefined {
  const files = r?.data?.files || {};
  for (const [fieldId, fv] of Object.entries<any>(files)) {
    const f = fv?.value?.file;
    if (f) return { fieldId, contentType: f.content_type || '', filename: f.filename };
  }
  return undefined;
}

export default function KnowledgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const kb = useCurrentKb();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chat = useChat({ resourceId: id });

  useEffect(() => {
    if (!id) return;
    setLoading(true); setError(null); setDetail(null);
    getResource(id).then((r) => {
      setDetail({
        title: r.title || '(untitled)',
        url: r.origin?.url,
        summary: r.summary || r?.computedmetadata?.summary,
        status: r.metadata?.status,
        text: extractText(r),
        thumbnail: r.thumbnail,
        file: pickFile(r),
        labels: r?.usermetadata?.classifications || [],
        created: r.created,
      });
    }).catch((e) => setError(String(e))).finally(() => setLoading(false));
  }, [id]);

  const directUrl = detail?.file && id && kb?.id ? resourceFileUrl(id, detail.file.fieldId, kb.id) : null;
  const isLocal = !!kb?.id?.startsWith('local-');
  const ct = detail?.file?.contentType || '';
  const embeddable = /^(video|audio|image)\//.test(ct) || ct === 'application/pdf';

  // BYO (local) KBs can't pass their key in a media src — fetch the bytes via the
  // proxy (header-auth) into an object URL so PDF/video/image still render inline.
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!(detail?.file && id && isLocal && embeddable)) { setBlobUrl(null); return; }
    let url: string | null = null; let active = true;
    resourceFileBlobUrl(id, detail.file.fieldId).then((u) => { if (active) { url = u; setBlobUrl(u); } else if (u) URL.revokeObjectURL(u); }).catch(() => {});
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [id, isLocal, embeddable, detail?.file?.fieldId]);

  const mediaUrl = isLocal ? blobUrl : directUrl;
  const mediaResolving = isLocal && embeddable && !!detail?.file && !blobUrl;
  const thumbUrl = detail?.thumbnail && kb?.id ? thumbnailUrl(detail.thumbnail, kb.id) : null;
  const isMedia = mediaUrl && /^(video|audio|image)\//.test(ct);
  const isPdf = mediaUrl && ct === 'application/pdf';

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 md:px-8">
      <Link to="/library" className="btn-ghost mb-4 text-sm"><ArrowLeft size={15} /> Back to library</Link>
      {loading ? (
        <div className="space-y-3"><div className="skeleton h-8 w-2/3" /><div className="skeleton h-72 w-full rounded-xl" /></div>
      ) : error ? (
        <ErrorState message="Couldn’t load this resource." onRetry={() => location.reload()} />
      ) : detail && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <article className="min-w-0">
            <div className="flex items-start justify-between gap-3">
              <h1 className="t-display">{cleanTitle(detail.title)}</h1>
              <StatusChip status={detail.status} />
            </div>
            {detail.created && <p className="mt-1 text-xs text-ink-400">Added {formatDate(detail.created)}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {detail.labels.map((c, i) => <span key={i} className="chip">{c.label}</span>)}
              <SaveButton item={() => ({ type: 'resource', title: cleanTitle(detail.title), content: detail.summary || detail.text.slice(0, 500), url: detail.url, resourceId: id })} />
              {detail.url && (
                <a href={detail.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
                  <ExternalLink size={14} /> {safeHost(detail.url)}
                </a>
              )}
            </div>

            {/* Media: stream video/audio, render PDF/image inline */}
            {mediaResolving && <div className="skeleton mt-5 h-72 w-full rounded-xl" />}
            {isMedia && ct.startsWith('video') && (
              <video className="mt-5 max-h-[72vh] w-full rounded-xl bg-black" src={mediaUrl!} poster={thumbUrl || undefined} controls preload="metadata" />
            )}
            {isMedia && ct.startsWith('audio') && (
              <audio className="mt-5 w-full" src={mediaUrl!} controls preload="metadata" />
            )}
            {isMedia && ct.startsWith('image') && (
              <img className="mt-5 w-full rounded-xl border border-ink-200" src={mediaUrl!} alt={cleanTitle(detail.title)} />
            )}
            {isPdf && (
              <div className="mt-5 overflow-hidden rounded-xl border border-ink-200">
                <iframe title={cleanTitle(detail.title)} src={`${mediaUrl}#view=FitH`} className="h-[80vh] w-full" />
              </div>
            )}

            {/* Link resources: a webpage we can't iframe — show preview + open */}
            {!detail.file && detail.url && (
              <a href={detail.url} target="_blank" rel="noreferrer" className="card card-hover mt-5 block overflow-hidden">
                {thumbUrl && <img src={thumbUrl} alt="" className="max-h-80 w-full object-cover object-top" />}
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-ink-600">{safeHost(detail.url)}</span>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-700">Open original <ExternalLink size={14} /></span>
                </div>
              </a>
            )}

            {/* Non-embeddable file (e.g. .zip, .docx) — offer a download/open */}
            {detail.file && !embeddable && directUrl && (
              <a href={directUrl} target="_blank" rel="noreferrer" className="btn-outline mt-5"><Download size={15} /> Open {detail.file.filename || 'file'}</a>
            )}
            {detail.file && !embeddable && !directUrl && (
              <p className="mt-5 text-sm text-ink-500">This file type can’t be previewed inline. {detail.url && <a className="text-brand-700 underline" href={detail.url} target="_blank" rel="noreferrer">Open source</a>}</p>
            )}

            {detail.summary && (
              <div className="card mt-5 p-4">
                <div className="mb-1 t-overline">Summary</div>
                <p className="text-sm text-ink-700">{detail.summary}</p>
              </div>
            )}

            <details className="card mt-4 p-5" open={!detail.file}>
              <summary className="t-overline cursor-pointer select-none">{detail.file || detail.url ? 'Extracted text' : 'Content'}</summary>
              {detail.text ? (
                <div className="prose-answer mt-3 max-h-[60vh] overflow-y-auto text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(stripBoilerplate(detail.text)) }} />
              ) : (
                <p className="mt-3 text-sm text-ink-400">No extracted text{detail.status === 'PENDING' ? ' yet — still processing.' : '.'}</p>
              )}
            </details>
          </article>

          <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
            <div className="card flex h-full min-h-[24rem] flex-col overflow-hidden">
              <div className="border-b border-ink-200 px-4 py-3">
                <div className="text-sm font-semibold text-ink-800">Ask about this resource</div>
                <div className="text-xs text-ink-400">Answers are scoped to this document.</div>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatThread messages={chat.messages} busy={chat.busy} onSend={chat.send} onStop={chat.stop} compact
                  placeholder="Ask about this resource…" />
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function safeHost(u: string) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } }
