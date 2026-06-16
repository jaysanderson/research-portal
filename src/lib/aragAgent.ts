// Real ARAG Retrieval Agent client. Streams the multi-driver pipeline from a
// provisioned Nuclia Retrieval Agent via the server proxy (/api/agent/session/ephemeral).
//
// Event schema (one flat JSON object per NDJSON line, mostly-null fields):
//   operation: 2 (start) | 3 (done)
//   step: { module, title, value }          -> a planner/retrieval step
//   context: { id, question, chunks:[...] } -> retrieved context
//   possible_answer: { answer, ... }        -> intermediate candidate
//   answer: "<final answer>"                -> final synthesis
//   answer_citations: { metadata: { block: { context_id, origin_urls } } }
import { streamNdjson } from './api';
import type { Citation } from './nuclia';
import type { AgenticEvent, ContextChunk, StageId, PipelineStep } from './agentic';

export const DRIVER_LABELS: Record<string, string> = {
  nucliadb: 'Knowledge Box', perplexity: 'Perplexity', google: 'Google', tavily: 'Tavily',
  brave: 'Brave Search', sql: 'SQL', cypher: 'Graph (Cypher)', mcp_http: 'MCP', internet: 'Internet',
  smart: 'Planner', generate: 'Generate', remi: 'REMi',
};

function inferStage(title: string, op?: number): StageId {
  const t = title.toLowerCase();
  if (op === 3) return 'evaluate';
  if (/plan|reflect|decompos|restart|rephrase|condition/.test(t)) return 'preprocess';
  if (/answer|synthe|generat|writing|compose|final/.test(t)) return 'generate';
  if (/search|retriev|knowledge base|internet|web|perplexity|google|tavily|brave|graph|cypher|sql|mcp|lookup/.test(t)) return 'retrieve';
  return 'retrieve';
}

function inferModule(title: string, fallback?: string): string {
  const t = title.toLowerCase();
  if (/perplexity|internet/.test(t)) return 'perplexity';
  if (/google/.test(t)) return 'google';
  if (/tavily/.test(t)) return 'tavily';
  if (/brave/.test(t)) return 'brave';
  if (/graph|cypher/.test(t)) return 'cypher';
  if (/\bsql\b/.test(t)) return 'sql';
  if (/mcp/.test(t)) return 'mcp_http';
  if (/knowledge base|nucliadb|search/.test(t)) return 'nucliadb';
  return fallback || 'smart';
}

function host(u?: string) { if (!u) return undefined; try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } }

export async function* streamAgent(
  question: string,
  opts: { sessionId?: string; signal?: AbortSignal; userContext?: { author: string; text: string }[] } = {}
): AsyncGenerator<AgenticEvent> {
  const body: any = { question };
  if (opts.userContext?.length) body.user_context = opts.userContext.map((m) => ({ author: m.author, text: m.text }));

  const contextsById: Record<string, ContextChunk[]> = {};
  let streamedAny = false;
  let stepN = 0;

  yield { kind: 'start' };
  yield { kind: 'stage', stage: 'preprocess', detail: 'Planning retrieval' };

  try {
    // session must be 'ephemeral' or a UUID
    for await (const obj of streamNdjson('/api/agent/session/ephemeral', { method: 'POST', body: JSON.stringify(body), signal: opts.signal })) {
      const ev: any = (obj as any).item || obj;
      const op: number | undefined = ev.operation;

      if (ev.step && (ev.step.title || ev.step.module)) {
        const title: string = ev.step.title || ev.step.module;
        const stage = inferStage(title, op);
        const module = inferModule(title, ev.step.module);
        yield { kind: 'step', step: { id: `s${stepN++}`, module, label: title, stage, reason: typeof ev.step.value === 'string' ? ev.step.value.slice(0, 200) : undefined } };
        yield { kind: 'stage', stage, detail: title };
      }

      if (ev.context && Array.isArray(ev.context.chunks) && ev.context.chunks.length) {
        const chunks: ContextChunk[] = ev.context.chunks.map((c: any, i: number) => ({
          resourceId: c.chunk_id || ev.context.id || `c${i}`,
          title: c.title || ev.context.question || `Source ${i + 1}`,
          url: c.source || undefined,
          text: c.text || '',
          score: c.score ?? 0,
          labels: [],
        }));
        contextsById[ev.context.id] = chunks;
        yield { kind: 'stage', stage: 'retrieve', detail: `${chunks.length} sources retrieved` };
        yield { kind: 'chunks', chunks };
      }

      if (typeof ev.streaming_response_chunk === 'string' && ev.streaming_response_chunk) {
        if (!streamedAny) { streamedAny = true; yield { kind: 'stage', stage: 'generate', detail: 'Synthesizing answer' }; }
        yield { kind: 'answer', text: ev.streaming_response_chunk };
      }

      // final full answer — only emit if we didn't already stream it in chunks
      if (typeof ev.answer === 'string' && ev.answer && !streamedAny) {
        streamedAny = true;
        yield { kind: 'stage', stage: 'generate', detail: 'Answer ready' };
        yield { kind: 'answer', text: ev.answer };
      }

      const meta = ev.answer_citations?.metadata;
      if (meta && typeof meta === 'object') {
        const cites: Citation[] = [];
        let i = 0;
        for (const m of Object.values<any>(meta)) {
          i++;
          const ctx = contextsById[m?.context_id];
          const first = ctx?.[0];
          const url = (m?.origin_urls && m.origin_urls[0]) || first?.url;
          cites.push({ resourceId: undefined, title: first?.title || host(url) || `Source ${i}`, url });
        }
        if (cites.length) yield { kind: 'citations', citations: cites };
      }

      if (op === 3) { yield { kind: 'done' }; return; }
      if (ev.exception) { yield { kind: 'error', message: String(ev.exception).slice(0, 200) }; return; }
    }
    yield { kind: 'done' };
  } catch (err) {
    yield { kind: 'error', message: String(err).slice(0, 200) };
  }
}

export interface DriverInfo { id: string; label: string; category: 'kb' | 'web' | 'data' | 'tool' | 'reason'; desc: string }
export const DRIVER_CATALOG: DriverInfo[] = [
  { id: 'nucliadb', label: 'Knowledge Box', category: 'kb', desc: 'Semantic + keyword retrieval over your indexed corpus.' },
  { id: 'cypher', label: 'Graph (Cypher)', category: 'kb', desc: 'Relationship-aware retrieval over the knowledge graph.' },
  { id: 'sql', label: 'SQL', category: 'data', desc: 'Query structured/tabular data sources.' },
  { id: 'perplexity', label: 'Perplexity', category: 'web', desc: 'Live web answers via Perplexity.' },
  { id: 'google', label: 'Google', category: 'web', desc: 'Google web search.' },
  { id: 'tavily', label: 'Tavily', category: 'web', desc: 'Tavily research search API.' },
  { id: 'brave', label: 'Brave Search', category: 'web', desc: 'Privacy-first web search.' },
  { id: 'mcp_http', label: 'MCP tools', category: 'tool', desc: 'Call external MCP tools mid-pipeline.' },
];
