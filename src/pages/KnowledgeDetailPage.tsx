import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Download, Sparkles, Loader2, Tags, FileText, X } from 'lucide-react';
import { getResource, resourceFileUrl, resourceFileBlobUrl, summarizeText, find, type FindResult } from '../lib/nuclia';
import { useChat } from '../lib/useChat';
import { useCurrentKb, useKbImage } from '../lib/hooks';
import { ChatThread } from '../components/chat/ChatThread';
import { StatusChip } from '../components/StatusChip';
import { SaveButton } from '../components/SaveButton';
import { ErrorState } from '../components/States';
import { cleanTitle, stripBoilerplate, formatDate } from '../lib/util';
import { renderMarkdown } from '../lib/markdown';

interface Entity { text: string; type: string }
interface FileField { fieldId: string; contentType: string; filename?: string }
interface Detail {
  title: string;
  url?: string;
  summary?: string;
  status?: string;
  text: string;
  thumbnail?: string;
  file?: FileField;
  files: FileField[];
  labels: { labelset: string; label: string }[];
  entities: Entity[];
  language?: string;
  created?: string;
}

const ENTITY_SKIP = new Set(['DATE', 'TIME', 'CARDINAL', 'ORDINAL', 'PERCENT', 'QUANTITY', 'MONEY']);
function extractEntities(r: any): Entity[] {
  const merged: Record<string, string> = {};
  for (const group of Object.values<any>(r?.data || {})) {
    for (const field of Object.values<any>(group || {})) {
      const ner = field?.extracted?.metadata?.metadata?.ner;
      if (ner && typeof ner === 'object') for (const [t, ty] of Object.entries<any>(ner)) if (!merged[t]) merged[t] = ty;
    }
  }
  return Object.entries(merged)
    .filter(([t, ty]) => t.trim().length > 1 && !ENTITY_SKIP.has(ty))
    .map(([text, type]) => ({ text, type }))
    .sort((a, b) => a.text.localeCompare(b.text))
    .slice(0, 18);
}
function firstLanguage(r: any): string | undefined {
  for (const group of Object.values<any>(r?.data || {}))
    for (const field of Object.values<any>(group || {})) {
      const l = field?.extracted?.metadata?.metadata?.language;
      if (l) return l;
    }
  return undefined;
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

function pickFiles(r: any): FileField[] {
  const files = r?.data?.files || {};
  const out: FileField[] = [];
  for (const [fieldId, fv] of Object.entries<any>(files)) {
    const f = fv?.value?.file;
    if (f) out.push({ fieldId, contentType: f.content_type || '', filename: f.filename });
  }
  return out;
}
function pickFile(r: any): FileField | undefined { return pickFiles(r)[0]; }

export default function KnowledgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const kb = useCurrentKb();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [related, setRelated] = useState<FindResult[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const chat = useChat({ resourceId: id });

  useEffect(() => {
    if (!id) return;
    setLoading(true); setError(null); setDetail(null); setRelated([]); setAiSummary(null);
    getResource(id).then((r) => {
      setDetail({
        title: r.title || '(untitled)',
        url: r.origin?.url,
        summary: r.summary || r?.computedmetadata?.summary,
        status: r.metadata?.status,
        text: extractText(r),
        thumbnail: r.thumbnail,
        file: pickFile(r),
        files: pickFiles(r),
        labels: r?.usermetadata?.classifications || [],
        entities: extractEntities(r),
        language: firstLanguage(r),
        created: r.created,
      });
    }).catch((e) => setError(String(e))).finally(() => setLoading(false));
  }, [id]);

  // "More like this" — semantic neighbours seeded from the title (excluding self).
  useEffect(() => {
    if (!detail?.title || !id) return;
    let active = true;
    find(cleanTitle(detail.title), { pageSize: 7, mode: 'semantic' })
      .then((r) => { if (active) setRelated(r.filter((x) => x.resourceId !== id).slice(0, 5)); })
      .catch(() => {});
    return () => { active = false; };
  }, [detail?.title, id]);

  const summarize = async () => {
    if (!detail?.text) return;
    setSummarizing(true);
    try { setAiSummary(await summarizeText(detail.text)); }
    catch { setAiSummary('Could not generate a summary right now.'); }
    finally { setSummarizing(false); }
  };

  const suggestedQuestions = useMemo(() => {
    if (!detail) return [] as string[];
    const topic = detail.labels[0]?.label || detail.entities[0]?.text;
    return [
      'Summarize the key points',
      topic ? `What does this say about ${topic}?` : 'What are the main takeaways?',
      'What questions does this leave open?',
    ];
  }, [detail]);

  const directUrl = detail?.file && id && kb?.id ? resourceFileUrl(id, detail.file.fieldId, kb.id) : null;
  const isLocal = !!kb?.id?.startsWith('local-');
  const ct = detail?.file?.contentType || '';
  const embeddable = /^(video|audio|image)\//.test(ct) || ct === 'application/pdf';

  // BYO (local) KBs can't pass their key in a media src — fetch the bytes via the
  // proxy (header-auth) into an object URL so PDF/video/image still render inline.
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pdfPage, setPdfPage] = useState(1);
  useEffect(() => {
    if (!(detail?.file && id && isLocal && embeddable)) { setBlobUrl(null); return; }
    let url: string | null = null; let active = true;
    resourceFileBlobUrl(id, detail.file.fieldId).then((u) => { if (active) { url = u; setBlobUrl(u); } else if (u) URL.revokeObjectURL(u); }).catch(() => {});
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [id, isLocal, embeddable, detail?.file?.fieldId]);

  const mediaUrl = isLocal ? blobUrl : directUrl;
  const mediaResolving = isLocal && embeddable && !!detail?.file && !blobUrl;
  const thumbUrl = useKbImage(detail?.thumbnail, kb?.id);
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
              <div className="mt-5">
                <div className="mb-2 flex items-center gap-2">
                  <span className="t-overline">Page</span>
                  <input type="number" min={1} value={pdfPage} onChange={(e) => setPdfPage(Math.max(1, Number(e.target.value) || 1))}
                    aria-label="Jump to PDF page" className="input w-20 py-1 text-sm" />
                  <span className="text-xs text-ink-400">Jump straight to the page an answer cites.</span>
                </div>
                <div className="overflow-hidden rounded-xl border border-ink-200">
                  <iframe key={pdfPage} title={cleanTitle(detail.title)} src={`${mediaUrl}#page=${pdfPage}&view=FitH`} className="h-[80vh] w-full" />
                </div>
              </div>
            )}

            {/* Multi-image resources: gallery + lightbox (direct-URL KBs) */}
            {!isLocal && id && kb?.id && detail.files.filter((f) => f.contentType.startsWith('image/')).length > 1 && (
              <div className="mt-5">
                <div className="mb-2 t-overline">Images ({detail.files.filter((f) => f.contentType.startsWith('image/')).length})</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {detail.files.filter((f) => f.contentType.startsWith('image/')).map((f) => {
                    const u = resourceFileUrl(id, f.fieldId, kb.id);
                    if (!u) return null;
                    return (
                      <button key={f.fieldId} onClick={() => setLightbox(u)} className="overflow-hidden rounded-lg border border-ink-200 focus-visible:outline-none">
                        <img src={u} alt={f.filename || ''} loading="lazy" className="h-28 w-full object-cover transition-transform hover:scale-105" />
                      </button>
                    );
                  })}
                </div>
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

            {detail.entities.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 flex items-center gap-1.5 t-overline"><Tags size={12} /> Entities in this resource</div>
                <div className="flex flex-wrap gap-1.5">
                  {detail.entities.map((e) => (
                    <button key={e.text} onClick={() => navigate(`/search?q=${encodeURIComponent(e.text)}`)} className="chip-link" title={`${e.type} — search for this entity`}>{e.text}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="card mt-4 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="t-overline">Summary</span>
                <button onClick={summarize} disabled={summarizing || !detail.text} className="btn-ghost btn-sm">
                  {summarizing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {aiSummary ? 'Regenerate' : 'Summarize with AI'}
                </button>
              </div>
              {aiSummary ? <p className="text-sm text-ink-700">{aiSummary}</p>
                : detail.summary ? <p className="text-sm text-ink-700">{detail.summary}</p>
                : <p className="text-sm text-ink-400">No summary yet — generate a fresh one from the extracted text.</p>}
            </div>

            <details className="card mt-4 p-5" open={!detail.file}>
              <summary className="t-overline cursor-pointer select-none">{detail.file || detail.url ? 'Extracted text' : 'Content'}</summary>
              {detail.text ? (
                <div className="prose-answer mt-3 max-h-[60vh] overflow-y-auto text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(stripBoilerplate(detail.text)) }} />
              ) : (
                <p className="mt-3 text-sm text-ink-400">No extracted text{detail.status === 'PENDING' ? ' yet — still processing.' : '.'}</p>
              )}
            </details>

            {related.length > 0 && (
              <div className="card mt-4 p-4">
                <div className="mb-2 t-overline">Related resources</div>
                <ul className="space-y-0.5">
                  {related.map((r) => (
                    <li key={r.resourceId}>
                      <Link to={`/knowledge/${r.resourceId}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-700 hover:bg-ink-100">
                        <FileText size={13} className="shrink-0 text-ink-400" /><span className="truncate">{cleanTitle(r.title)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>

          <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
            <div className="card flex h-full min-h-[24rem] flex-col overflow-hidden">
              <div className="border-b border-ink-200 px-4 py-3">
                <div className="text-sm font-semibold text-ink-800">Ask about this resource</div>
                <div className="text-xs text-ink-400">Answers are scoped to this document.</div>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatThread messages={chat.messages} busy={chat.busy} onSend={chat.send} onStop={chat.stop} compact
                  examples={chat.messages.length === 0 ? suggestedQuestions : undefined}
                  placeholder="Ask about this resource…" />
              </div>
            </div>
          </aside>
        </div>
      )}

      {lightbox && (
        <div role="dialog" aria-modal="true" onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-950/85 p-6 backdrop-blur-sm animate-fade-in">
          <button onClick={() => setLightbox(null)} aria-label="Close image" className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X size={18} /></button>
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg object-contain shadow-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function safeHost(u: string) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } }
