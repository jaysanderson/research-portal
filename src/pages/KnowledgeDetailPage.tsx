import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { getResource } from '../lib/nuclia';
import { useChat } from '../lib/useChat';
import { ChatThread } from '../components/chat/ChatThread';
import { StatusChip } from '../components/StatusChip';
import { SaveButton } from '../components/SaveButton';

interface Detail {
  title: string;
  url?: string;
  summary?: string;
  status?: string;
  text: string;
  labels: { labelset: string; label: string }[];
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

export default function KnowledgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chat = useChat({ resourceId: id });

  useEffect(() => {
    if (!id) return;
    setLoading(true); setError(null);
    getResource(id).then((r) => {
      setDetail({
        title: r.title || '(untitled)',
        url: r.origin?.url,
        summary: r.summary || r?.computedmetadata?.summary,
        status: r.metadata?.status,
        text: extractText(r),
        labels: r?.usermetadata?.classifications || [],
      });
    }).catch((e) => setError(String(e).slice(0, 160))).finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 md:px-8">
      <Link to="/library" className="btn-ghost mb-4 text-sm"><ArrowLeft size={15} /> Back to library</Link>
      {loading ? (
        <div className="space-y-3"><div className="skeleton h-8 w-2/3" /><div className="skeleton h-64 w-full rounded-xl" /></div>
      ) : error ? (
        <div className="card border-rose-200 bg-rose-50 p-5 text-rose-700">{error}</div>
      ) : detail && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <article className="min-w-0">
            <div className="flex items-start justify-between gap-3">
              <h1 className="t-display">{detail.title}</h1>
              <StatusChip status={detail.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {detail.labels.map((c, i) => <span key={i} className="chip">{c.label}</span>)}
              <SaveButton item={() => ({ type: 'resource', title: detail.title, content: detail.summary || detail.text.slice(0, 500), url: detail.url, resourceId: id })} />
              {detail.url && (
                <a href={detail.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
                  <ExternalLink size={14} /> {safeHost(detail.url)}
                </a>
              )}
            </div>

            {detail.summary && (
              <div className="card mt-5 p-4">
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-400">Summary</div>
                <p className="text-sm text-ink-700">{detail.summary}</p>
              </div>
            )}

            <div className="card mt-4 p-5">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">Extracted content</div>
              {detail.text ? (
                <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{detail.text}</div>
              ) : (
                <p className="text-sm text-ink-400">No extracted text available{detail.status === 'PENDING' ? ' yet — still processing.' : '.'}</p>
              )}
            </div>
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

function safeHost(u: string) { try { return new URL(u).hostname; } catch { return u; } }
