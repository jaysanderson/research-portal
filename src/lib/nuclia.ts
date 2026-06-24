// Knowledge Box client — all calls go through the server proxy (/api/kb/*).
import { kb, streamNdjson, kbHeaders } from './api';

// Single shared generation prompt used by EVERY answer surface (Search, Assistant,
// Agentic, structured). Nuclia's default RAG prompt emits "Not enough data to
// answer this." as a guardrail even when relevant sources are retrieved; this
// steers it to always synthesise from the available context. One pipeline, one voice.
export const ANSWER_SYSTEM_PROMPT =
  'You are a CMS/DXP research analyst. Always answer the user\'s question using the provided context. ' +
  'Synthesize and compare across the sources even when the context is partial — surface what IS known and be specific, naming vendors. ' +
  'Never reply that there is not enough data, and never refuse, when any relevant context is present. Write in clear, well-structured prose with Markdown.';

// Belt-and-suspenders: if a refusal sentinel ever slips through, drop it so it
// can never sit above retrieved results.
const REFUSAL = /^\s*not enough data to answer this\.?\s*$/i;
export function isRefusal(text: string): boolean {
  return REFUSAL.test(text.trim());
}

export interface Counters {
  resources: number;
  paragraphs: number;
  fields: number;
  sentences: number;
  index_size: number;
}

export interface Classification { labelset: string; label: string }

export interface ResourceCard {
  id: string;
  slug?: string;
  title: string;
  summary?: string;
  icon?: string;
  url?: string;
  status?: string;
  created?: string;
  modified?: string;
  thumbnail?: string;
  classifications: Classification[];
}

/** Build an <img>-able URL for a Nuclia thumbnail path, routed through the proxy.
 *  Images can't send headers, so we pass the KB via ?kb=. Local (BYO-key) KBs
 *  can't expose a key in a URL, so they fall back to a generated visual. */
export function thumbnailUrl(thumbnail: string | undefined, kbId: string): string | null {
  if (!thumbnail || !kbId || kbId.startsWith('local-')) return null;
  const rest = thumbnail.replace(/^\/?kb\/[^/]+\//, '');
  return `/api/kb/${rest}?kb=${encodeURIComponent(kbId)}`;
}

/** Fetch a thumbnail through the proxy with the current KB's headers (BYO KBs send
 *  their key as a header, since it can't ride in an <img src>) → object URL. */
export async function thumbnailBlobUrl(thumbnail: string): Promise<string | null> {
  const rest = thumbnail.replace(/^\/?kb\/[^/]+\//, '');
  const res = await fetch(`/api/kb/${rest}`, { headers: kbHeaders() });
  if (!res.ok) return null;
  // Nuclia serves extracted thumbnails as octet-stream; coerce to an image type
  // so <img src=blob:…> decodes reliably.
  const ct = res.headers.get('content-type') || '';
  const type = ct.startsWith('image/') ? ct : 'image/jpeg';
  return URL.createObjectURL(new Blob([await res.arrayBuffer()], { type }));
}

/** Inline-streamable URL for a resource's file field (video/PDF/etc.), proxied.
 *  Media elements can't send headers, so the KB is selected via ?kb=. Returns null
 *  for BYO (local) KBs — their key can't ride in a src; use resourceFileBlobUrl. */
export function resourceFileUrl(resourceId: string, fieldId: string, kbId: string): string | null {
  if (!kbId || kbId.startsWith('local-')) return null;
  return `/api/kb/resource/${resourceId}/file/${fieldId}/download/field?kb=${encodeURIComponent(kbId)}`;
}

/** Fetch a resource file through the proxy with the current KB's headers (works for
 *  BYO KBs, whose key is sent as a header) and return an object URL for inline render. */
export async function resourceFileBlobUrl(resourceId: string, fieldId: string): Promise<string | null> {
  const res = await fetch(`/api/kb/resource/${resourceId}/file/${fieldId}/download/field`, { headers: kbHeaders() });
  if (!res.ok) return null;
  return URL.createObjectURL(await res.blob());
}

export interface FindParagraph {
  text: string;
  score?: number;
  rid?: string;
}

export interface FindResult {
  resourceId: string;
  title: string;
  url?: string;
  score: number;
  paragraphs: FindParagraph[];
  labels: string[];
}

export interface Citation { title: string; url?: string; resourceId?: string }

export async function getCounters(): Promise<Counters> {
  return kb<Counters>('counters');
}

export interface LabelsetMap {
  [id: string]: { title: string; color?: string; multiple?: boolean; labels?: { title: string }[] };
}
export async function getLabelsets(): Promise<LabelsetMap> {
  const data = await kb<{ labelsets: LabelsetMap }>('labelsets');
  return data.labelsets || {};
}

function classificationsOf(r: any): Classification[] {
  const u = r?.usermetadata?.classifications || [];
  const c = (r?.computedmetadata?.field_classifications || []).flatMap((f: any) => f.classifications || []);
  return [...u, ...c].map((x: any) => ({ labelset: x.labelset, label: x.label }));
}

export interface CatalogPage { resources: ResourceCard[]; total: number }

export type CatalogSortField = 'created' | 'modified' | 'title';
export async function listCatalog(opts: {
  page?: number;
  size?: number;
  query?: string;
  filters?: string[]; // e.g. ['/classification.labels/vendor/Progress Sitefinity']
  sortField?: CatalogSortField;
  sortOrder?: 'asc' | 'desc';
} = {}): Promise<CatalogPage> {
  const query: Record<string, string | number | string[]> = {
    page_number: opts.page ?? 0,
    page_size: opts.size ?? 20,
    show: ['basic', 'origin', 'values'],
  };
  if (opts.query) query['query'] = opts.query;
  if (opts.filters?.length) query['filters'] = opts.filters;
  if (opts.sortField) { query['sort_field'] = opts.sortField; query['sort_order'] = opts.sortOrder || 'desc'; }
  const data = await kb<any>('catalog', { query });
  const resObj = data.resources || {};
  const resources: ResourceCard[] = Object.entries(resObj).map(([id, r]: [string, any]) => ({
    id,
    slug: r.slug,
    title: r.title || '(untitled)',
    summary: r.summary,
    icon: r.icon,
    url: r.origin?.url,
    status: r.metadata?.status,
    created: r.created,
    modified: r.modified,
    thumbnail: r.thumbnail || undefined,
    classifications: classificationsOf(r),
  }));
  const total = data.fulltext?.total ?? data.total ?? resources.length;
  return { resources, total };
}

export type RetrievalMode = 'keyword' | 'semantic' | 'hybrid';
const FEATURES: Record<RetrievalMode, string[]> = {
  keyword: ['keyword'],
  semantic: ['semantic'],
  hybrid: ['keyword', 'semantic'],
};

export function vendorFilter(labelset: string, label: string) {
  return `/classification.labels/${labelset}/${label}`;
}

export async function getStatusCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  // Page the whole KB (cap as a runaway guard) so totals reconcile with the resource count.
  for (let page = 0; page < 40; page++) {
    const data = await kb<any>('catalog', { query: { page_number: page, page_size: 200, show: ['basic'] } });
    const res = data.resources || {};
    const keys = Object.keys(res);
    if (!keys.length) break;
    for (const k of keys) { const s = res[k]?.metadata?.status || 'PROCESSED'; counts[s] = (counts[s] || 0) + 1; }
    if (keys.length < 200) break;
  }
  return counts;
}

export async function find(query: string, opts: { filters?: string[]; pageSize?: number; mode?: RetrievalMode } = {}): Promise<FindResult[]> {
  const body: any = {
    query,
    features: FEATURES[opts.mode || 'hybrid'],
    page_size: opts.pageSize ?? 20,
    show: ['basic', 'origin'],
  };
  if (opts.filters?.length) body.filters = opts.filters;
  const data = await kb<any>('find', { method: 'POST', body: JSON.stringify(body) });
  const resObj = data.resources || {};
  const results: FindResult[] = Object.entries(resObj).map(([id, r]: [string, any]) => {
    const paragraphs: FindParagraph[] = [];
    const fields = r.fields || {};
    for (const f of Object.values<any>(fields)) {
      for (const p of Object.values<any>(f.paragraphs || {})) {
        paragraphs.push({ text: p.text, score: p.score, rid: id });
      }
    }
    paragraphs.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return {
      resourceId: id,
      title: r.title || '(untitled)',
      url: r.origin?.url,
      score: r.score ?? paragraphs[0]?.score ?? 0,
      paragraphs: paragraphs.slice(0, 3),
      labels: classificationsOf(r).map((c) => c.label),
    };
  });
  results.sort((a, b) => b.score - a.score);
  return results;
}

export interface CitationMark { pos: number; n: number } // insert marker [n] at answer char offset pos
export interface AskChunk { kind: 'answer' | 'citations' | 'status' | 'metadata'; text?: string; citations?: Citation[]; marks?: CitationMark[] }

/** Streaming /ask. Yields incremental answer text + final citations. */
export async function* ask(
  query: string,
  opts: { filters?: string[]; signal?: AbortSignal; context?: { author: string; text: string }[]; resourceId?: string } = {}
): AsyncGenerator<AskChunk> {
  const body: any = {
    query,
    features: ['keyword', 'semantic'],
    citations: true,
    show: ['basic', 'origin'],
    prompt: { system: ANSWER_SYSTEM_PROMPT },
  };
  if (opts.filters?.length) body.filters = opts.filters;
  if (opts.context?.length) body.context = opts.context;
  if (opts.resourceId) body.resource_filters = [opts.resourceId];

  const resourceMap: Record<string, { title: string; url?: string }> = {};
  for await (const obj of streamNdjson('/api/kb/ask', {
    method: 'POST',
    body: JSON.stringify(body),
    signal: opts.signal,
  })) {
    const item: any = (obj as any).item || obj;
    const t = item.type;
    if (t === 'answer' && typeof item.text === 'string') {
      yield { kind: 'answer', text: item.text };
    } else if (t === 'retrieval') {
      for (const [rid, r] of Object.entries<any>(item.results?.resources || {})) {
        resourceMap[rid] = { title: r.title || rid, url: r.origin?.url };
      }
      yield { kind: 'status' };
    } else if (t === 'citations') {
      // Keys: "<rid>/<field_type>/<field>/<range>"; values: [[answer_start, answer_end], …]
      // — the char ranges in the answer each source supports. We number sources by
      // first appearance and emit inline marks at each range end for [n] anchors.
      const order: string[] = [];
      const nOf = (rid: string) => { let i = order.indexOf(rid); if (i < 0) { order.push(rid); i = order.length - 1; } return i + 1; };
      const marks: CitationMark[] = [];
      for (const [key, val] of Object.entries<any>(item.citations || {})) {
        const rid = key.split('/')[0];
        const n = nOf(rid);
        for (const range of (Array.isArray(val) ? val : [])) {
          if (Array.isArray(range) && range.length === 2 && Number.isFinite(range[1])) marks.push({ pos: range[1], n });
        }
      }
      const cites: Citation[] = order.map((rid, i) => ({ resourceId: rid, title: resourceMap[rid]?.title || `Source ${i + 1}`, url: resourceMap[rid]?.url }));
      yield { kind: 'citations', citations: cites, marks };
    } else if (t === 'status') {
      yield { kind: 'status' };
    }
  }
}

// ---------------- Ingestion (Sprint 1) ----------------

function classificationBody(labels: Classification[]) {
  return labels.length ? { usermetadata: { classifications: labels } } : {};
}

export async function createLinkResource(input: { url: string; title?: string; labels?: Classification[] }): Promise<string> {
  const body = {
    title: input.title?.trim() || input.url,
    icon: 'application/stf-link',
    origin: { url: input.url },
    links: { link: { uri: input.url } },
    ...classificationBody(input.labels || []),
  };
  const r = await kb<{ uuid: string }>('resources', { method: 'POST', body: JSON.stringify(body) });
  return r.uuid;
}

export async function createTextResource(input: { title: string; body: string; format?: 'PLAIN' | 'MARKDOWN'; labels?: Classification[] }): Promise<string> {
  const body = {
    title: input.title.trim() || 'Untitled note',
    icon: 'text/plain',
    texts: { text: { body: input.body, format: input.format || 'PLAIN' } },
    ...classificationBody(input.labels || []),
  };
  const r = await kb<{ uuid: string }>('resources', { method: 'POST', body: JSON.stringify(body) });
  return r.uuid;
}

export async function uploadFile(file: File, opts: { labels?: Classification[] } = {}): Promise<string> {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-filename': encodeURIComponent(file.name), ...kbHeaders() },
    body: file,
  });
  if (!res.ok) throw new Error(`upload -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const uuid = data.uuid || data.resource;
  // Apply labels (if any) via a follow-up PATCH; upload itself can't carry classifications.
  if (uuid && opts.labels?.length) {
    try { await classifyResource(uuid, opts.labels); } catch { /* non-fatal */ }
  }
  return uuid;
}

export async function classifyResource(id: string, labels: Classification[]): Promise<void> {
  await kb(`resource/${id}`, { method: 'PATCH', body: JSON.stringify({ usermetadata: { classifications: labels } }) });
}

export async function deleteResource(id: string): Promise<void> {
  await kb(`resource/${id}`, { method: 'DELETE' });
}

export async function createLabelset(id: string, title: string, opts: { color?: string; multiple?: boolean } = {}): Promise<void> {
  await kb(`labelset/${id}`, {
    method: 'POST',
    body: JSON.stringify({ title, color: opts.color || '#3366ff', multiple: opts.multiple ?? true, kind: ['RESOURCES'] }),
  });
}

export async function crawlSite(url: string, limit = 40): Promise<{ source: string; links: string[] }> {
  const res = await fetch(`/api/crawl?url=${encodeURIComponent(url)}&limit=${limit}`, { headers: kbHeaders() });
  if (!res.ok) throw new Error(`crawl -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Facet counts for a labelset, e.g. getFacets('vendor') -> { 'Progress Sitefinity': 20, ... } */
export async function getFacets(labelset: string): Promise<Record<string, number>> {
  const key = `/classification.labels/${labelset}`;
  const data = await kb<any>('catalog', { query: { faceted: key, page_size: 0 } });
  const facets = data.fulltext?.facets || data.facets || {};
  const node = facets[key] || {};
  const out: Record<string, number> = {};
  // Nuclia catalog returns a flat map: { "/classification.labels/<set>/<label>": count }
  for (const [tag, count] of Object.entries(node)) {
    out[tag.split('/').pop() || tag] = count as number;
  }
  return out;
}

// Schema-enforced structured generation grounded in the KB (Nuclia answer_json_schema).
export async function askStructured<T = any>(
  query: string,
  schema: { name: string; description: string; parameters: object },
  opts: { filters?: string[]; signal?: AbortSignal } = {}
): Promise<{ object: T; citations: Citation[] }> {
  // Nuclia rejects citations + answer_json_schema together, so we derive sources
  // from the retrieval event (the resources the answer was grounded in).
  // max_tokens must be generous: structured JSON for matrices/briefings is large
  // and the default cap triggers a 412 "Error generating json: max_tokens".
  const body: any = { query, features: ['keyword', 'semantic'], answer_json_schema: schema, show: ['basic', 'origin'], max_tokens: 4096 };
  if (opts.filters?.length) body.filters = opts.filters;

  let object: any = null;
  const citations: Citation[] = [];
  const seen = new Set<string>();
  for await (const obj of streamNdjson('/api/kb/ask', { method: 'POST', body: JSON.stringify(body), signal: opts.signal })) {
    const item: any = (obj as any).item || obj;
    if (item.type === 'answer_json' && item.object) object = item.object;
    else if (item.type === 'retrieval') {
      for (const [rid, r] of Object.entries<any>(item.results?.resources || {})) {
        if (seen.has(rid)) continue; seen.add(rid);
        citations.push({ resourceId: rid, title: r.title || rid, url: r.origin?.url });
      }
    }
  }
  if (!object) throw new Error('No structured answer returned.');
  return { object, citations: citations.slice(0, 12) };
}

export async function getResource(id: string): Promise<any> {
  return kb<any>(`resource/${id}`, { query: { show: ['basic', 'origin', 'values', 'extracted', 'extra'], extracted: ['text', 'metadata'] } });
}
