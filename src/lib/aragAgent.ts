// Real ARAG Retrieval Agent client. Streams the full multi-driver pipeline from a
// provisioned Nuclia Retrieval Agent via the server proxy (/api/agent/session/{id}).
//
// Activates automatically when the server has NUCLIA_ARAG_* configured
// (config.aragConfigured === true). The agent can fan out across drivers:
// Knowledge Box (nucliadb), SQL, Cypher (graph), internet (Perplexity/Google/
// Tavily/Brave), and MCP tools (http/sse/stdio), with REMi scoring + consumption.
import { streamNdjson } from './api';
import type { Citation } from './nuclia';
import type { AgenticEvent, ContextChunk, StageId, PipelineStep } from './agentic';

export const DRIVER_LABELS: Record<string, string> = {
  nucliadb: 'Knowledge Box', perplexity: 'Perplexity', google: 'Google', tavily: 'Tavily',
  brave: 'Brave Search', sql: 'SQL', cypher: 'Graph (Cypher)', basic_ask: 'Basic Ask',
  mcp_http: 'MCP (HTTP)', mcp_sse: 'MCP (SSE)', mcp_stdio: 'MCP (stdio)', internet: 'Internet',
  rephrase: 'Rephrase', historical: 'Historical Context', summarize: 'Summarize',
  condition: 'Condition', remi: 'REMi', generate: 'Generate', restricted: 'Restricted', restart: 'Restart',
};

const RETRIEVAL_DRIVERS = new Set(['nucliadb', 'perplexity', 'google', 'tavily', 'brave', 'sql', 'cypher', 'mcp_http', 'mcp_sse', 'mcp_stdio', 'basic_ask']);

export function inferStage(module: string, op?: number): StageId {
  if (op === 3) return 'evaluate';
  if (['rephrase', 'historical', 'condition', 'summarize', 'restart', 'restricted'].includes(module) || op === 2) return 'preprocess';
  if (RETRIEVAL_DRIVERS.has(module)) return 'retrieve';
  if (['generate', 'answer', 'internet'].includes(module)) return 'generate';
  if (module === 'remi') return 'evaluate';
  return 'retrieve';
}

function normalizeChunks(raw: any[]): ContextChunk[] {
  return (raw || []).map((c: any, i: number) => ({
    resourceId: c.rid || c.resource_id || c.chunk_id || c.paragraph_id || String(i),
    title: c.resource_title || c.title || c.field || `Source ${i + 1}`,
    url: c.url || c.origin,
    text: c.text || c.body || '',
    score: c.score ?? 0,
    labels: c.labels || [],
  }));
}

export async function* streamAgent(
  question: string,
  opts: { sessionId: string; signal?: AbortSignal; userContext?: { author: string; text: string }[] } = { sessionId: 'default' }
): AsyncGenerator<AgenticEvent> {
  const body: any = { question };
  if (opts.userContext?.length) body.user_context = opts.userContext.map((m) => ({ author: m.author, text: m.text }));

  yield { kind: 'start' };
  try {
    for await (const obj of streamNdjson(`/api/agent/session/${opts.sessionId}`, {
      method: 'POST', body: JSON.stringify(body), signal: opts.signal,
    })) {
      const ev: any = (obj as any).item || obj;
      const op: number | undefined = ev.op ?? ev.operation;

      // pipeline step
      const module: string | undefined = ev.module || ev.driver || ev.name;
      if (module && (ev.type === 'step' || ev.title || ev.reason || RETRIEVAL_DRIVERS.has(module))) {
        const stage = inferStage(module, op);
        const step: PipelineStep = {
          id: ev.id || `${module}-${Math.random().toString(36).slice(2, 7)}`,
          module, label: DRIVER_LABELS[module] || module, stage,
          reason: ev.reason || ev.title,
          durationMs: ev.duration_ms ?? (ev.duration ? ev.duration * 1000 : undefined),
          chunks: ev.chunks_count ?? (Array.isArray(ev.chunks) ? ev.chunks.length : undefined),
        };
        yield { kind: 'step', step };
        yield { kind: 'stage', stage, detail: step.reason };
      }

      // context chunks
      const chunks = ev.context_chunks || ev.chunks || ev.results?.chunks;
      if (Array.isArray(chunks) && chunks.length && typeof chunks[0] === 'object') {
        yield { kind: 'chunks', chunks: normalizeChunks(chunks) };
      }

      // answer text
      if ((ev.type === 'answer_delta' || ev.type === 'answer') && typeof ev.text === 'string') yield { kind: 'answer', text: ev.text };
      if (ev.type === 'answer_final' && typeof ev.text === 'string') yield { kind: 'answer', text: ev.text };

      // REMi
      const remi = ev.remi || ev.remi_score || ev.score;
      if (remi && (remi.relevance != null || remi.groundedness != null)) {
        yield { kind: 'remi', remi: { relevance: remi.relevance, groundedness: remi.groundedness } };
      }

      // consumption
      const cons = ev.consumption || (ev.type === 'consumption' ? ev : null);
      if (cons && (cons.tokens || cons.normalized_tokens)) {
        const t = cons.tokens || cons.normalized_tokens || {};
        yield { kind: 'consumption', consumption: { inputTokens: t.input, outputTokens: t.output } };
      }

      // citations
      if (ev.type === 'citations' && ev.citations) {
        const cites: Citation[] = Object.keys(ev.citations).map((k, i) => ({ resourceId: k.split('/')[0], title: `Source ${i + 1}` }));
        yield { kind: 'citations', citations: cites };
      }

      if (op === 3 || ev.type === 'pipeline_done') { yield { kind: 'done' }; return; }
      if (op === 4 || ev.type === 'pipeline_error') { yield { kind: 'error', message: ev.message || 'Pipeline error' }; return; }
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
  { id: 'mcp_http', label: 'MCP (HTTP)', category: 'tool', desc: 'Call external MCP tools over HTTP.' },
  { id: 'mcp_sse', label: 'MCP (SSE)', category: 'tool', desc: 'Stream from MCP tools over SSE.' },
  { id: 'mcp_stdio', label: 'MCP (stdio)', category: 'tool', desc: 'Local MCP tools over stdio.' },
];
