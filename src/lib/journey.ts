// Answer Journey — turn an answer's grounding into an ordered, walkable set of "stops"
// (most → least confident), and stream a per-resource "how does this relate?" answer.
import { find, ask, type FindResult } from './nuclia';
import type { ContextChunk } from './agentic';
import { stripBoilerplate } from './util';
import { toPlainText } from './markdown';

export interface JourneyStop {
  resourceId: string;
  title: string;
  url?: string;
  score: number;        // 0–1 confidence
  quote: string;        // best supporting passage (boilerplate-stripped)
  labels: string[];
  thumbnail?: string;   // page-screenshot path (gradient fallback if absent)
  cited: boolean;       // resourceId appears in the answer's citations
}

function quoteOf(paragraphs: { text: string }[], summary?: string): string {
  for (const p of paragraphs) {
    const t = stripBoilerplate(toPlainText(p.text)).trim();
    if (t.length > 24) return t;
  }
  return stripBoilerplate(toPlainText(summary || '')).trim();
}

/** Search/Assistant: rebuild the ranked grounding via the same hybrid retrieval. */
export async function buildStops(query: string, filters: string[] = [], citedIds: string[] = []): Promise<JourneyStop[]> {
  const results: FindResult[] = await find(query, { filters, mode: 'hybrid', pageSize: 8 });
  const cited = new Set(citedIds.filter(Boolean));
  return results
    .map((r) => ({
      resourceId: r.resourceId, title: r.title, url: r.url, score: r.score,
      quote: quoteOf(r.paragraphs, r.summary), labels: r.labels.slice(0, 4),
      thumbnail: r.thumbnail, cited: cited.has(r.resourceId),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

/** Agentic: reuse the context chunks already retrieved on the page. */
export function fromChunks(chunks: ContextChunk[], citedIds: string[] = []): JourneyStop[] {
  const cited = new Set(citedIds.filter(Boolean));
  return chunks
    .map((c) => ({
      resourceId: c.resourceId, title: c.title, url: c.url, score: c.score,
      quote: stripBoilerplate(toPlainText(c.text || '')).trim(), labels: (c.labels || []).slice(0, 4),
      thumbnail: undefined as string | undefined, cited: cited.has(c.resourceId),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

/** Stream a short, resource-scoped answer to "how does this relate to the question?". */
export async function* relate(resourceId: string, question: string, signal?: AbortSignal): AsyncGenerator<string> {
  const q = `How does this source relate to the question: "${question}"? Answer in 2-3 sentences, grounded only in this source.`;
  let acc = '';
  for await (const chunk of ask(q, { resourceId, signal })) {
    if (chunk.kind === 'answer' && chunk.text) { acc += chunk.text; yield acc; }
  }
}
