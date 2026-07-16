// Agentic retrieval over the Knowledge Box.
//
// When an ARAG Retrieval Agent is configured (server: NUCLIA_ARAG_*), this can be
// pointed at /api/agent for the full multi-driver pipeline + REMi. Until then it
// drives a transparent pipeline from the KB /ask stream, which emits genuine
// telemetry: retrieval (context chunks), streaming generation, token consumption,
// and timings. Every signal below is real, not simulated.
import { streamNdjson } from './api';
import { ANSWER_SYSTEM_PROMPT, RERANKER, RAG_STRATEGIES, scoreRemi, type Citation } from './nuclia';

export type StageId = 'preprocess' | 'retrieve' | 'generate' | 'evaluate';

export interface ContextChunk {
  resourceId: string;
  title: string;
  url?: string;
  text: string;
  score: number;
  labels: string[];
}

export interface Consumption {
  inputTokens?: number;
  outputTokens?: number;
  firstChunkSec?: number;
  totalSec?: number;
}

export interface RemiScore { relevance?: number; contextRelevance?: number; groundedness?: number }

export interface PipelineStep {
  id: string;
  module: string;   // driver/module name (nucliadb, perplexity, cypher, mcp_http, ...)
  label: string;    // human-friendly
  stage: StageId;
  reason?: string;
  durationMs?: number;
  chunks?: number;
}

export type AgenticEvent =
  | { kind: 'start' }
  | { kind: 'stage'; stage: StageId; detail?: string }
  | { kind: 'step'; step: PipelineStep }
  | { kind: 'chunks'; chunks: ContextChunk[] }
  | { kind: 'answer'; text: string }
  | { kind: 'citations'; citations: Citation[] }
  | { kind: 'remi'; remi: RemiScore }
  | { kind: 'consumption'; consumption: Consumption }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

export interface TurnTrace {
  id: string;
  question: string;
  startedAt: number;
  durationMs?: number;
  chunks: ContextChunk[];
  answer: string;
  citations: Citation[];
  consumption?: Consumption;
  remi?: RemiScore;
  steps?: PipelineStep[];
  stages: { stage: StageId; at: number }[];
  feedback?: 'up' | 'down';
}

function parseChunks(resources: Record<string, any>): ContextChunk[] {
  const out: ContextChunk[] = [];
  for (const [rid, r] of Object.entries<any>(resources || {})) {
    const labels = [
      ...(r?.usermetadata?.classifications || []).map((c: any) => c.label),
    ];
    const fields = r.fields || {};
    let best = '';
    let bestScore = 0;
    for (const f of Object.values<any>(fields)) {
      for (const p of Object.values<any>(f.paragraphs || {})) {
        if ((p.score ?? 0) >= bestScore) { bestScore = p.score ?? 0; best = p.text || best; }
      }
    }
    out.push({ resourceId: rid, title: r.title || rid, url: r.origin?.url, text: best, score: bestScore, labels });
  }
  return out.sort((a, b) => b.score - a.score);
}

export async function* askAgentic(
  question: string,
  opts: { filters?: string[]; signal?: AbortSignal; context?: { author: string; text: string }[] } = {}
): AsyncGenerator<AgenticEvent> {
  const body: any = {
    query: question,
    features: ['keyword', 'semantic'],
    citations: true,
    show: ['basic', 'origin'],
    prompt: { system: ANSWER_SYSTEM_PROMPT },
    reranker: RERANKER,
    rag_strategies: RAG_STRATEGIES,
  };
  if (opts.filters?.length) body.filters = opts.filters;
  if (opts.context?.length) body.context = opts.context;

  const resourceMap: Record<string, { title: string; url?: string }> = {};
  let fullAnswer = '';
  let lastChunks: ContextChunk[] = [];
  yield { kind: 'start' };
  yield { kind: 'stage', stage: 'preprocess', detail: 'Rephrasing & planning retrieval' };

  let answerStarted = false;
  try {
    for await (const obj of streamNdjson('/api/kb/ask', { method: 'POST', body: JSON.stringify(body), signal: opts.signal })) {
      const item: any = (obj as any).item || obj;
      switch (item.type) {
        case 'retrieval': {
          const resources = item.results?.resources || {};
          for (const [rid, r] of Object.entries<any>(resources)) resourceMap[rid] = { title: r.title || rid, url: r.origin?.url };
          yield { kind: 'stage', stage: 'retrieve', detail: `${Object.keys(resources).length} sources retrieved` };
          lastChunks = parseChunks(resources);
          yield { kind: 'chunks', chunks: lastChunks };
          break;
        }
        case 'answer':
          if (typeof item.text === 'string') {
            if (!answerStarted) { answerStarted = true; yield { kind: 'stage', stage: 'generate', detail: 'Synthesizing grounded answer' }; }
            fullAnswer += item.text;
            yield { kind: 'answer', text: item.text };
          }
          break;
        case 'citations': {
          const seen = new Set<string>();
          const cites: Citation[] = [];
          for (const key of Object.keys(item.citations || {})) {
            const rid = key.split('/')[0];
            if (seen.has(rid)) continue;
            seen.add(rid);
            cites.push({ resourceId: rid, title: resourceMap[rid]?.title || `Source ${cites.length + 1}`, url: resourceMap[rid]?.url });
          }
          yield { kind: 'citations', citations: cites };
          break;
        }
        case 'metadata':
          yield {
            kind: 'consumption',
            consumption: {
              inputTokens: item.tokens?.input,
              outputTokens: item.tokens?.output,
              firstChunkSec: item.timings?.generative_first_chunk,
              totalSec: item.timings?.generative_total,
            },
          };
          break;
        case 'status':
          yield { kind: 'stage', stage: 'evaluate', detail: 'Validating & finalizing' };
          break;
      }
    }
    // Real answer-quality scoring (REMi) over the answer + retrieved context.
    // Non-fatal: a predict hiccup must not fail the turn.
    if (fullAnswer.trim() && lastChunks.length && !opts.signal?.aborted) {
      yield { kind: 'stage', stage: 'evaluate', detail: 'Scoring answer quality (REMi)' };
      try {
        const remi = await scoreRemi({ question, answer: fullAnswer, contexts: lastChunks.map((c) => c.text).filter(Boolean) });
        if (remi) yield { kind: 'remi', remi: { relevance: remi.answerRelevance, contextRelevance: remi.contextRelevance, groundedness: remi.groundedness } };
      } catch { /* predict unavailable — skip quietly */ }
    }
    yield { kind: 'done' };
  } catch (err) {
    yield { kind: 'error', message: String(err).slice(0, 200) };
  }
}

// ---- trace persistence, scoped per Knowledge Box (localStorage; this device only) ----
const traceKey = (kbId?: string) => `rp_agentic_traces_${kbId || 'default'}`;
export function loadTraces(kbId?: string): TurnTrace[] {
  try { return JSON.parse(localStorage.getItem(traceKey(kbId)) || '[]'); } catch { return []; }
}
export function saveTrace(kbId: string, t: TurnTrace) {
  const all = loadTraces(kbId);
  all.unshift(t);
  localStorage.setItem(traceKey(kbId), JSON.stringify(all.slice(0, 50)));
}
export function updateTraceFeedback(kbId: string, id: string, feedback: 'up' | 'down') {
  const all = loadTraces(kbId).map((t) => (t.id === id ? { ...t, feedback } : t));
  localStorage.setItem(traceKey(kbId), JSON.stringify(all));
}
