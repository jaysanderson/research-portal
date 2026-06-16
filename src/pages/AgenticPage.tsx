import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Workflow, Loader2, Send, Square, CheckCircle2, Circle, Cpu, Layers, Sparkles,
  ShieldCheck, ThumbsUp, ThumbsDown, Clock, Hash, History,
} from 'lucide-react';
import {
  askAgentic, loadTraces, saveTrace, updateTraceFeedback,
  type AgenticEvent, type ContextChunk, type Consumption, type StageId, type TurnTrace,
  type PipelineStep, type RemiScore,
} from '../lib/agentic';
import { streamAgent } from '../lib/aragAgent';
import type { Citation } from '../lib/nuclia';
import { useConfig } from '../lib/hooks';
import { renderMarkdown } from '../lib/markdown';
import { PageHeader } from '../components/PageHeader';
import { RemiGauge } from '../components/agentic/RemiGauge';
import { DriverPanel } from '../components/agentic/DriverPanel';
import { SaveButton } from '../components/SaveButton';

const STAGES: { id: StageId; label: string; icon: React.ReactNode }[] = [
  { id: 'preprocess', label: 'Preprocess', icon: <Cpu size={15} /> },
  { id: 'retrieve', label: 'Retrieve', icon: <Layers size={15} /> },
  { id: 'generate', label: 'Generate', icon: <Sparkles size={15} /> },
  { id: 'evaluate', label: 'Validate', icon: <ShieldCheck size={15} /> },
];

const EXAMPLES = [
  'Compare the composable architecture of Sitefinity, Sitecore and Optimizely.',
  'What do analysts say about the leaders in the DXP market?',
  'Which vendors are best for a .NET-based enterprise team and why?',
];

export default function AgenticPage() {
  const config = useConfig();
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [activeStages, setActiveStages] = useState<Record<StageId, string | undefined>>({} as any);
  const [chunks, setChunks] = useState<ContextChunk[]>([]);
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [consumption, setConsumption] = useState<Consumption | null>(null);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [remi, setRemi] = useState<RemiScore | null>(null);
  const [activeModules, setActiveModules] = useState<Set<string>>(new Set());
  const [question, setQuestion] = useState('');
  const [traces, setTraces] = useState<TurnTrace[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<string>(`sess-${Math.random().toString(36).slice(2)}`);

  useEffect(() => { setTraces(loadTraces()); }, []);

  const run = async (q: string) => {
    const query = q.trim();
    if (!query || running) return;
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setRunning(true); setQuestion(query); setActiveStages({} as any);
    setChunks([]); setAnswer(''); setCitations([]); setConsumption(null);
    setSteps([]); setRemi(null); setActiveModules(new Set());
    const startedAt = Date.now();
    const stages: { stage: StageId; at: number }[] = [];
    let acc = ''; let cites: Citation[] = []; let chk: ContextChunk[] = []; let cons: Consumption | undefined;
    let stepList: PipelineStep[] = []; let remiScore: RemiScore | undefined;

    const gen = config?.aragConfigured
      ? streamAgent(query, { sessionId: sessionRef.current, signal: ctrl.signal })
      : askAgentic(query, { signal: ctrl.signal });

    try {
      for await (const ev of gen as AsyncGenerator<AgenticEvent>) {
        if (ev.kind === 'stage') { setActiveStages((s) => ({ ...s, [ev.stage]: ev.detail })); stages.push({ stage: ev.stage, at: Date.now() - startedAt }); }
        else if (ev.kind === 'step') { stepList = [...stepList, ev.step]; setSteps(stepList); setActiveModules((m) => new Set(m).add(ev.step.module)); }
        else if (ev.kind === 'chunks') { chk = ev.chunks; setChunks(ev.chunks); }
        else if (ev.kind === 'answer') { acc += ev.text; setAnswer(acc); }
        else if (ev.kind === 'citations') { cites = ev.citations; setCitations(ev.citations); }
        else if (ev.kind === 'remi') { remiScore = ev.remi; setRemi(ev.remi); }
        else if (ev.kind === 'consumption') { cons = ev.consumption; setConsumption(ev.consumption); }
        else if (ev.kind === 'error') { acc = acc || `Error: ${ev.message}`; setAnswer(acc); }
      }
    } finally {
      setRunning(false);
      if (!ctrl.signal.aborted && acc) {
        const trace: TurnTrace = {
          id: `${startedAt}`, question: query, startedAt, durationMs: Date.now() - startedAt,
          chunks: chk, answer: acc, citations: cites, consumption: cons, remi: remiScore, steps: stepList, stages,
        };
        saveTrace(trace); setTraces(loadTraces());
      }
    }
  };

  const stop = () => { abortRef.current?.abort(); setRunning(false); };
  const feedback = (id: string, fb: 'up' | 'down') => { updateTraceFeedback(id, fb); setTraces(loadTraces()); };

  const currentStageIndex = STAGES.findIndex((s) => activeStages[s.id] !== undefined);
  const lastActive = STAGES.reduce((acc, s, i) => (activeStages[s.id] !== undefined ? i : acc), -1);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
      <PageHeader title="Agentic retrieval"
        description={`A transparent multi-step pipeline over the Knowledge Box — watch retrieval, generation, token cost and timings in real time.${!config?.aragConfigured ? ' KB-pipeline mode — connect an ARAG agent to enable multi-driver + REMi.' : ''}`} />


      <form onSubmit={(e) => { e.preventDefault(); run(input); }} className="mt-5 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a complex, multi-source question…"
          className="flex-1 rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-400" />
        {running ? (
          <button type="button" onClick={stop} className="btn bg-ink-800 text-white px-5"><Square size={16} /> Stop</button>
        ) : (
          <button type="submit" className="btn-primary px-6"><Send size={16} /> Run</button>
        )}
      </form>
      {!question && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => <button key={ex} onClick={() => { setInput(ex); run(ex); }} className="chip hover:border-brand-300 hover:text-brand-700">{ex}</button>)}
        </div>
      )}

      {question && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Left: pipeline + answer */}
          <div className="min-w-0 space-y-5">
            {/* Pipeline */}
            <div className="card p-4">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-ink-400">Pipeline</div>
              <div className="flex flex-wrap items-stretch gap-2">
                {STAGES.map((s, i) => {
                  const detail = activeStages[s.id];
                  const done = i < lastActive || (!running && detail !== undefined);
                  const active = i === lastActive && running;
                  return (
                    <div key={s.id} className={`flex min-w-[140px] flex-1 items-center gap-2 rounded-lg border px-3 py-2 ${
                      active ? 'border-brand-400 bg-brand-50' : done ? 'border-emerald-200 bg-emerald-50' : 'border-ink-200 bg-white'}`}>
                      <span className={active ? 'text-brand-600' : done ? 'text-emerald-600' : 'text-ink-300'}>
                        {active ? <Loader2 size={15} className="animate-spin" /> : done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 text-xs font-semibold text-ink-700">{s.icon}{s.label}</div>
                        {detail && <div className="truncate text-[11px] text-ink-400">{detail}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Driver steps (ARAG agent mode) */}
            {steps.length > 0 && (
              <div className="card p-4">
                <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-ink-400">Pipeline steps</div>
                <ol className="space-y-1.5">
                  {steps.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-2 text-sm">
                      <span className="text-xs font-bold text-ink-300">{i + 1}</span>
                      <span className="chip">{s.label}</span>
                      {s.reason && <span className="truncate text-xs text-ink-500">{s.reason}</span>}
                      {s.chunks != null && <span className="ml-auto text-[11px] text-ink-400">{s.chunks} chunks</span>}
                      {s.durationMs != null && <span className="text-[11px] text-ink-400">{Math.round(s.durationMs)}ms</span>}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Answer */}
            <div className="card p-5">
              <div className="mb-2 flex items-center gap-2 text-brand-700"><Sparkles size={16} /><span className="text-sm font-bold">Answer</span>
                {running && <Loader2 size={14} className="animate-spin text-brand-400" />}
                {answer && !running && (
                  <span className="ml-auto"><SaveButton item={() => ({ type: 'answer', title: question, question, content: answer, citations })} /></span>
                )}</div>
              {answer ? (
                <div className="prose-answer" dangerouslySetInnerHTML={{ __html: renderMarkdown(answer) }} />
              ) : (
                <div className="space-y-2"><div className="skeleton h-3 w-5/6" /><div className="skeleton h-3 w-4/6" /></div>
              )}
              {citations.length > 0 && (
                <div className="mt-4 border-t border-ink-100 pt-3">
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-400">Citations</div>
                  <div className="flex flex-wrap gap-1.5">
                    {citations.map((c, i) => c.resourceId
                      ? <Link key={i} to={`/knowledge/${c.resourceId}`} className="chip hover:border-brand-300 hover:text-brand-700">{i + 1}. {c.title}</Link>
                      : <span key={i} className="chip">{i + 1}. {c.title}</span>)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: chunks + consumption */}
          <aside className="space-y-5">
            <RemiGauge remi={remi} />
            <ConsumptionReadout c={consumption} running={running} />
            <DriverPanel activeModules={activeModules} aragConfigured={!!config?.aragConfigured} />
            <div className="card overflow-hidden">
              <div className="border-b border-ink-100 px-4 py-3 text-sm font-semibold text-ink-800">Context ({chunks.length})</div>
              <div className="max-h-[28rem] space-y-2 overflow-y-auto p-3">
                {chunks.length === 0 && <p className="px-1 py-4 text-center text-sm text-ink-400">{running ? 'Retrieving…' : 'No context yet.'}</p>}
                {chunks.map((c, i) => (
                  <Link to={`/knowledge/${c.resourceId}`} key={i} className="block rounded-lg border border-ink-100 p-2.5 hover:border-brand-200 hover:bg-brand-50/40">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-brand-600">{i + 1}</span>
                      <span className="truncate text-xs font-semibold text-ink-800">{c.title}</span>
                      <span className="ml-auto text-[10px] text-ink-400">{c.score.toFixed(2)}</span>
                    </div>
                    {c.text && <p className="mt-1 line-clamp-2 text-[11px] text-ink-500">{c.text}</p>}
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Traces */}
      {traces.length > 0 && (
        <div className="mt-10">
          <div className="mb-3 flex items-center gap-2"><History size={16} className="text-ink-400" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">Trace history</h2></div>
          <div className="space-y-2">
            {traces.map((t) => (
              <div key={t.id} className="card flex items-center gap-3 px-4 py-2.5">
                <button onClick={() => { setInput(t.question); run(t.question); }} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-medium text-ink-800">{t.question}</div>
                  <div className="flex items-center gap-3 text-[11px] text-ink-400">
                    <span><Layers size={11} className="mr-0.5 inline" />{t.chunks.length} sources</span>
                    {t.consumption?.outputTokens != null && <span><Hash size={11} className="mr-0.5 inline" />{(t.consumption.inputTokens || 0) + (t.consumption.outputTokens || 0)} tok</span>}
                    {t.durationMs != null && <span><Clock size={11} className="mr-0.5 inline" />{(t.durationMs / 1000).toFixed(1)}s</span>}
                  </div>
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={() => feedback(t.id, 'up')} className={t.feedback === 'up' ? 'text-emerald-600' : 'text-ink-300 hover:text-emerald-600'}><ThumbsUp size={15} /></button>
                  <button onClick={() => feedback(t.id, 'down')} className={t.feedback === 'down' ? 'text-rose-600' : 'text-ink-300 hover:text-rose-600'}><ThumbsDown size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConsumptionReadout({ c, running }: { c: Consumption | null; running: boolean }) {
  return (
    <div className="card p-4">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-ink-400">Consumption</div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Metric label="Input tokens" value={c?.inputTokens} />
        <Metric label="Output tokens" value={c?.outputTokens} />
        <Metric label="First chunk" value={c?.firstChunkSec != null ? `${c.firstChunkSec.toFixed(2)}s` : undefined} />
        <Metric label="Total gen" value={c?.totalSec != null ? `${c.totalSec.toFixed(2)}s` : undefined} />
      </div>
      {running && !c && <p className="mt-2 text-xs text-ink-400">Measuring…</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value?: number | string }) {
  return (
    <div className="rounded-lg bg-ink-50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-ink-400">{label}</div>
      <div className="text-base font-bold text-ink-900">{value ?? '—'}</div>
    </div>
  );
}
