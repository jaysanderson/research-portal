// Knowledge Box client — all calls go through the server proxy (/api/kb/*).
import { kb, streamNdjson } from './api';

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
  classifications: Classification[];
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

export async function listCatalog(opts: {
  page?: number;
  size?: number;
  query?: string;
  filters?: string[]; // e.g. ['/classification.labels/vendor/Progress Sitefinity']
} = {}): Promise<CatalogPage> {
  const query: Record<string, string | number | string[]> = {
    page_number: opts.page ?? 0,
    page_size: opts.size ?? 20,
    show: ['basic', 'origin', 'values'],
  };
  if (opts.query) query['query'] = opts.query;
  if (opts.filters?.length) query['filters'] = opts.filters;
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
    classifications: classificationsOf(r),
  }));
  const total = data.fulltext?.total ?? data.total ?? resources.length;
  return { resources, total };
}

export async function find(query: string, opts: { filters?: string[]; pageSize?: number } = {}): Promise<FindResult[]> {
  const body: any = {
    query,
    features: ['keyword', 'semantic'],
    page_size: opts.pageSize ?? 12,
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

export interface AskChunk { kind: 'answer' | 'citations' | 'status' | 'metadata'; text?: string; citations?: Citation[] }

/** Streaming /ask. Yields incremental answer text + final citations. */
export async function* ask(
  query: string,
  opts: { filters?: string[]; signal?: AbortSignal; context?: { author: string; text: string }[] } = {}
): AsyncGenerator<AskChunk> {
  const body: any = {
    query,
    features: ['keyword', 'semantic'],
    citations: true,
    show: ['basic', 'origin'],
  };
  if (opts.filters?.length) body.filters = opts.filters;
  if (opts.context?.length) body.context = opts.context;

  for await (const obj of streamNdjson('/api/kb/ask', {
    method: 'POST',
    body: JSON.stringify(body),
    signal: opts.signal,
  })) {
    const item: any = (obj as any).item || obj;
    const t = item.type;
    if (t === 'answer' && typeof item.text === 'string') {
      yield { kind: 'answer', text: item.text };
    } else if (t === 'citations') {
      const cites: Citation[] = Object.entries(item.citations || {}).map(([key]) => ({
        title: key.split('/').pop() || key,
        resourceId: key.split('/')[0],
      }));
      yield { kind: 'citations', citations: cites };
    } else if (t === 'retrieval' || t === 'status') {
      yield { kind: 'status' };
    }
  }
}

export async function getResource(id: string): Promise<any> {
  return kb<any>(`resource/${id}`, { query: { show: ['basic', 'origin', 'values', 'extracted', 'extra'], extracted: ['text', 'metadata'] } });
}
