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
  summary?: string;
  thumbnail?: string;
  icon?: string;
  created?: string;
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

// ---- Multi-model gateway: one Nuclia key → many LLMs (via generative_model on /ask) ----
export interface GenModel { id: string; label: string; note: string }
// Verified enabled on this account (others like Claude/Gemini return 403 until provisioned).
export const GEN_MODELS: GenModel[] = [
  { id: '', label: 'Default', note: 'Knowledge Box default' },
  { id: 'chatgpt-azure-4o', label: 'GPT-4o', note: 'Balanced quality' },
  { id: 'chatgpt-azure-4o-mini', label: 'GPT-4o mini', note: 'Fastest' },
  { id: 'chatgpt-azure-o1', label: 'o1', note: 'Deep reasoning' },
];
let _model = (typeof localStorage !== 'undefined' && localStorage.getItem('rp_model')) || '';
export function getModel(): string { return _model; }
export function setModel(id: string) {
  _model = id;
  try { localStorage.setItem('rp_model', id); } catch { /* */ }
  window.dispatchEvent(new Event('rp-model-change'));
}
export function modelLabel(id: string): string { return GEN_MODELS.find((m) => m.id === id)?.label || 'Default'; }

export type MediaKind = 'video' | 'audio' | 'pdf' | 'image' | 'doc' | 'link' | 'text';
/** Coarse media type from a Nuclia icon/mime — drives result/library badges & filters. */
export function mediaKind(icon?: string): MediaKind {
  const c = (icon || '').toLowerCase();
  if (c.startsWith('video/')) return 'video';
  if (c.startsWith('audio/')) return 'audio';
  if (c === 'application/pdf') return 'pdf';
  if (c.startsWith('image/')) return 'image';
  if (c.includes('stf-link') || c.includes('html')) return 'link';
  if (/word|officedocument|msword|ms-powerpoint|presentation|spreadsheet|excel/.test(c)) return 'doc';
  return 'text';
}

export function vendorFilter(labelset: string, label: string) {
  return `/classification.labels/${labelset}/${label}`;
}

export interface ProblemResource { id: string; title: string; url?: string; status: string }
export interface SourceHealth { counts: Record<string, number>; total: number; problems: ProblemResource[] }

/** Status counts (from the /metadata.status facet — one call, exact) + the drillable
 *  list of non-PROCESSED resources. The old per-page walk read metadata.status off the
 *  catalog rows, but /catalog rows don't carry it, so every resource looked un-indexed
 *  (0%). The faceted count is authoritative; we then fetch only the problem rows. */
export async function getSourceHealth(): Promise<SourceHealth> {
  const data = await kb<any>('catalog', { query: { faceted: ['/metadata.status'], page_size: 0 } });
  const node = (data.fulltext?.facets || data.facets || {})['/metadata.status'] || {};
  const counts: Record<string, number> = {};
  for (const [tag, count] of Object.entries(node)) counts[tag.split('/').pop() || tag] = count as number;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // Pull the actual non-PROCESSED resources so the list is drillable (cap per status).
  const problems: ProblemResource[] = [];
  const badStatuses = Object.keys(counts).filter((s) => s !== 'PROCESSED' && counts[s] > 0);
  for (const status of badStatuses) {
    try {
      const d = await kb<any>('catalog', { query: { filters: [`/metadata.status/${status}`], page_size: 50, show: ['basic', 'origin'] } });
      for (const [id, r] of Object.entries<any>(d.resources || {})) {
        problems.push({ id, title: r.title || id, url: r.origin?.url, status });
      }
    } catch { /* a status with no drill is still counted above */ }
  }
  return { counts, total, problems };
}

export async function getStatusCounts(): Promise<Record<string, number>> {
  return (await getSourceHealth()).counts;
}

// Cross-encoder reranker (ARAG /predict) — reorders the fused candidate set by true
// query-passage relevance. `window` processes more candidates than we display so the
// merge quality is higher. Shared by find() and ask().
export const RERANKER = { name: 'predict', window: 50 } as const;
// RAG strategies expand each matched paragraph into richer LLM context: hierarchy
// prepends the resource title/summary, neighbouring_paragraphs adds surrounding text.
// Directly fixes thin single-paragraph context (what ANSWER_SYSTEM_PROMPT was patching).
export const RAG_STRATEGIES = [
  { name: 'neighbouring_paragraphs', before: 1, after: 1 },
  { name: 'hierarchy' },
] as const;

export async function find(query: string, opts: { filters?: string[]; pageSize?: number; page?: number; mode?: RetrievalMode; highlight?: boolean; filterExpression?: object; queryImage?: { b64encoded: string; content_type: string } } = {}): Promise<FindResult[]> {
  const body: any = {
    query,
    features: FEATURES[opts.mode || 'hybrid'],
    page_size: opts.pageSize ?? 20,
    show: ['basic', 'origin'],
    reranker: RERANKER,
  };
  if (opts.filters?.length) body.filters = opts.filters;
  if (opts.filterExpression) body.filter_expression = opts.filterExpression;
  if (opts.page) body.page_number = opts.page;
  if (opts.highlight) body.highlight = true;
  if (opts.queryImage) body.query_image = opts.queryImage;
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
      summary: r.summary,
      thumbnail: r.thumbnail,
      icon: r.icon,
      created: r.created,
    };
  });
  results.sort((a, b) => b.score - a.score);
  // Relevance floor: real matches score ≳0.2, noise/gibberish ≲0.01 — drop the noise
  // so off-corpus queries return a true "no results" instead of 18 unrelated docs.
  const MIN_SCORE = 0.1;
  const relevant = results.filter((r) => (r.score ?? 0) >= MIN_SCORE);
  // Near-duplicate suppression: collapse repeated site nav/footer chrome that crawls
  // into many near-identical resources (e.g. 7 copies of a vendor menu).
  const seen = new Set<string>();
  return relevant.filter((r) => {
    const sig = (r.paragraphs[0]?.text || r.title).toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120);
    if (sig.length > 24 && seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
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
    reranker: RERANKER,
    rag_strategies: RAG_STRATEGIES,
  };
  if (_model) body.generative_model = _model;
  if (opts.filters?.length) body.filters = opts.filters;
  if (opts.context?.length) body.context = opts.context;
  if (opts.resourceId) body.resource_filters = [opts.resourceId];

  // Nuclia's generative step occasionally throws a transient 412/5xx ("Unknown
  // generative exception") before any answer streams — retry a couple of times
  // (only while nothing has been emitted yet) so a hiccup doesn't surface as a failure.
  for (let attempt = 1; ; attempt++) {
   const resourceMap: Record<string, { title: string; url?: string }> = {};
   let emitted = false;
   try {
    for await (const obj of streamNdjson('/api/kb/ask', {
      method: 'POST',
      body: JSON.stringify(body),
      signal: opts.signal,
    })) {
    const item: any = (obj as any).item || obj;
    const t = item.type;
    if (t === 'answer' && typeof item.text === 'string') {
      emitted = true;
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
    return; // stream completed
   } catch (err) {
    const retryable = /->\s*(412|5\d\d)/.test(String(err));
    if (attempt < 3 && !emitted && retryable && !opts.signal?.aborted) {
      await new Promise((r) => setTimeout(r, 700 * attempt));
      continue;
    }
    throw err;
   }
  }
}

// ---------------- Rephrase & summarize (ARAG /predict) ----------------

/** Rewrite a query for better retrieval (also powers "did you mean"). */
export async function rephrase(question: string, opts: { signal?: AbortSignal } = {}): Promise<string> {
  const raw = await kb<any>('predict/rephrase', { method: 'POST', body: JSON.stringify({ question, user_id: 'research-portal' }), signal: opts.signal });
  // The endpoint returns the rephrased string with a trailing status char.
  const s = typeof raw === 'string' ? raw : String(raw?.rephrased ?? raw ?? '');
  return s.replace(/\s*[0-9]$/, '').trim();
}

/** On-demand summary of arbitrary text via ARAG /predict/summarize. */
export async function summarizeText(text: string, opts: { signal?: AbortSignal } = {}): Promise<string> {
  const d = await kb<any>('predict/summarize', {
    method: 'POST',
    body: JSON.stringify({ resources: { a: { fields: { t: text.slice(0, 24000) } } } }),
    signal: opts.signal,
  });
  return d?.resources?.a?.summary || d?.summary || '';
}

// ---------------- Suggest (typeahead) ----------------

export interface Suggestion { text: string; kind: 'entity' | 'phrase' }

/** ARAG /suggest: autocomplete over indexed paragraphs + extracted entities. */
export async function suggest(query: string, opts: { signal?: AbortSignal } = {}): Promise<Suggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const data = await kb<any>('suggest', { query: { query: q }, signal: opts.signal });
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const push = (raw: string, kind: 'entity' | 'phrase') => {
    const t = String(raw || '').replace(/\s+/g, ' ').trim();
    const key = t.toLowerCase();
    if (t.length < 2 || t.length > 72 || seen.has(key)) return;
    seen.add(key); out.push({ text: t, kind });
  };
  // Extracted entities first — short and clean. Shape varies across versions.
  const ents = data.entities;
  const entList = Array.isArray(ents?.entities) ? ents.entities : Array.isArray(ents) ? ents : [];
  for (const e of entList) push(typeof e === 'string' ? e : e?.value || e?.family || '', 'entity');
  // Then the leading phrase of each matched paragraph.
  for (const p of (data.paragraphs?.results || [])) {
    const first = String(p?.text || '').split('\n').map((s: string) => s.trim()).find((s: string) => s.length > 3);
    if (first) push(first.length > 64 ? first.slice(0, 64) : first, 'phrase');
  }
  return out.slice(0, 8);
}

// ---------------- REMi answer-quality (ARAG /predict/remi) ----------------

export interface RemiResult { answerRelevance: number; contextRelevance: number; groundedness: number }

const norm5 = (n: unknown): number => {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v > 1 ? v / 5 : v)); // scores come back 0–5 (sometimes 0–1)
};
const maxOf = (a: unknown): number => (Array.isArray(a) ? a.reduce((m: number, x) => Math.max(m, norm5(typeof x === 'object' && x ? (x as any).score ?? x : x)), 0) : norm5(a));

/** Evaluate a completed answer with REMi (relevance / context-relevance / groundedness).
 *  The KB-scoped predict endpoint ({kb}/predict/remi) is the one the service account can
 *  use — the public zone-root predict rejects service-account auth. Routed via /api/kb. */
export async function scoreRemi(input: { question: string; answer: string; contexts: string[] }): Promise<RemiResult | null> {
  const contexts = input.contexts.filter(Boolean).slice(0, 20);
  if (!input.answer.trim() || !contexts.length) return null;
  const d = await kb<any>('predict/remi', {
    method: 'POST',
    body: JSON.stringify({ user_id: 'research-portal', question: input.question, answer: input.answer, contexts }),
  });
  return {
    answerRelevance: norm5(d.answer_relevance?.score ?? d.answer_relevance),
    contextRelevance: maxOf(d.context_relevance),
    groundedness: maxOf(d.groundedness),
  };
}

// ---------------- Knowledge graph (real extracted entity relations) ----------------

export interface GraphNode { id: string; label: string; group: string; weight: number }
export interface GraphEdge { source: string; target: string; label?: string; weight: number }
export interface RelationGraph { nodes: GraphNode[]; edges: GraphEdge[] }

/** Real entity-relationship graph from ARAG's `relations` feature: the platform's
 *  extracted entities + labeled relations (e.g. Adobe —developer→ AEM) around a seed
 *  query. This is genuine GraphRAG data, not classification co-occurrence. */
export async function relationGraph(query: string, opts: { signal?: AbortSignal } = {}): Promise<RelationGraph> {
  const body = { query, features: ['keyword', 'semantic', 'relations'], page_size: 10, show: ['basic'] };
  const data = await kb<any>('find', { method: 'POST', body: JSON.stringify(body), signal: opts.signal });
  const entities: Record<string, any> = data.relations?.entities || {};
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const addNode = (label: string, group: string) => {
    const id = label;
    const n = nodes.get(id);
    if (n) { n.weight += 1; if (group && group !== 'entity') n.group = group; }
    else nodes.set(id, { id, label, group: group || 'entity', weight: 1 });
  };
  for (const [source, info] of Object.entries(entities)) {
    const rels = info?.related_to || info?.relations || [];
    addNode(source, 'entity');
    for (const r of rels) {
      const target = String(r?.entity || '').trim();
      if (!target || target === source) continue;
      addNode(target, r?.entity_subtype || r?.entity_type || 'entity');
      const [a, b] = r?.direction === 'in' ? [target, source] : [source, target];
      const key = `${a}→${b}:${r?.relation_label || ''}`;
      const e = edges.get(key);
      if (e) e.weight += 1;
      else edges.set(key, { source: a, target: b, label: r?.relation_label || undefined, weight: 1 });
    }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
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
    body: JSON.stringify({ title, color: opts.color || '#2F31D8', multiple: opts.multiple ?? true, kind: ['RESOURCES'] }),
  });
}

export async function crawlSite(url: string, limit = 40): Promise<{ source: string; links: string[] }> {
  const res = await fetch(`/api/crawl?url=${encodeURIComponent(url)}&limit=${limit}`, { headers: kbHeaders() });
  if (!res.ok) throw new Error(`crawl -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Facet counts for a labelset, e.g. getFacets('vendor') -> { 'Progress Sitefinity': 20, ... } */
/** All labelsets' facet counts in ONE /catalog call (Nuclia accepts multiple `faceted`). */
export async function getFacetsBatch(labelsets: string[]): Promise<Record<string, Record<string, number>>> {
  if (!labelsets.length) return {};
  const keys = labelsets.map((l) => `/classification.labels/${l}`);
  const data = await kb<any>('catalog', { query: { faceted: keys, page_size: 0 } });
  const facets = data.fulltext?.facets || data.facets || {};
  const out: Record<string, Record<string, number>> = {};
  for (const l of labelsets) {
    const node = facets[`/classification.labels/${l}`] || {};
    const m: Record<string, number> = {};
    for (const [tag, count] of Object.entries(node)) m[tag.split('/').pop() || tag] = count as number;
    out[l] = m;
  }
  return out;
}

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
  const body: any = { query, features: ['keyword', 'semantic'], answer_json_schema: schema, show: ['basic', 'origin'], max_tokens: 4096, reranker: RERANKER };
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
