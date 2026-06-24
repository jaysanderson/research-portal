import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, Send, Square, CheckCircle2, Circle, Cpu, Layers, Sparkles, ShieldCheck,
  ThumbsUp, ThumbsDown, Clock, Hash, History, ChevronDown, ChevronRight,
} from 'lucide-react';
import {
  askAgentic, loadTraces, saveTrace, updateTraceFeedback,
  type AgenticEvent, type ContextChunk, type Consumption, type StageId, type TurnTrace,
  type PipelineStep, type RemiScore,
} from '../lib/agentic';
import { streamAgent } from '../lib/aragAgent';
import { isRefusal, type Citation } from '../lib/nuclia';
import { useCurrentKb, useKbProfile } from '../lib/hooks';
import { renderMarkdown, toPlainText } from '../lib/markdown';
import { cleanTitle, stripBoilerplate } from '../lib/util';
import { PageHeader } from '../components/PageHeader';
import { Citations } from '../components/Citations';
import { SaveButton } from '../components/SaveButton';
import { RemiGauge } from '../components/agentic/RemiGauge';
import { DriverPanel } from '../components/agentic/DriverPanel';

const STAGES: { id: StageId; label: string; icon: React.ReactNode }[] = [
  { id: 'preprocess', label: 'Preprocess', icon: <Cpu size={15} /> },
  { id: 'retrieve', label: 'Retrieve', icon: <Layers size={15} /> },
  { id: 'generate', label: 'Generate', icon: <Sparkles size={15} /> },
  { id: 'evaluate', label: 'Validate', icon: <ShieldCheck size={15} /> },
];

const FALLBACK_EXAMPLES = [
  'Summarize the key themes across this knowledge base.',
  'Compare the leading approaches discussed in the sources.',
  'What evidence supports the main conclusions here?',
];

function strength(score: number): 1 | 2 | 3 {
  if (score >= 0.7) return 3;
  if (score >= 0.4) return 2;
  return 1;
}

export default function AgenticPage() {
  const kb = useCurrentKb();
  const { profile } = useKbProfile();
  const examples = profile?.exampleQuestions?.length ? profile.exampleQuestions : FALLBACK_EXAMPLES;
  const aragOn = !!(kb?.aragConfigured && kb?.connected);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
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
  const [showInspect, setShowInspect] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<string>(`sess-${Math.random().toString(36).slice(2)}`);

  useEffect(() => { setTraces(loadTraces(kb?.id)); }, [kb?.id]);
  // Pick up a query handed off from the command palette.
  useEffect(() => {
    const q = sessionStorage.getItem('rp_prefill');
    if (q) { sessionStorage.removeItem('rp_prefill'); setInput(q); run(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    const gen = aragOn
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
      if (!ctrl.signal.aborted && acc && !isRefusal(acc)) {
        const trace: TurnTrace = {
          id: `${startedAt}`, question: query, startedAt, durationMs: Date.now() - startedAt,
          chunks: chk, answer: acc, citations: cites, consumption: cons, remi: remiScore, steps: stepList, stages,
        };
        saveTrace(kb?.id || '', trace); setTraces(loadTraces(kb?.id));
      }
    }
  };

  const stop = () => { abortRef.current?.abort(); setRunning(false); };
  const feedback = (id: string, fb: 'up' | 'down') => { updateTraceFeedback(kb?.id || '', id, fb); setTraces(loadTraces(kb?.id)); };

  const lastActive = STAGES.reduce((acc, s, i) => (activeStages[s.id] !== undefined ? i : acc), -1);
  const currentStep = running ? (STAGES[lastActive]?.label ?? 'Starting') : null;
  const totalTokens = (consumption?.inputTokens || 0) + (consumption?.outputTokens || 0);
  const clean = isRefusal(answer) ? '' : answer;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 md:px-8">
      <PageHeader title="Agentic retrieval"
        description={`Ask a complex question and get a grounded, cited answer. Open “Show reasoning” to inspect the full pipeline.${aragOn ? ' Multi-driver agent active.' : ' KB-pipeline mode — connect an ARAG agent for multi-driver + REMi.'}`} />

      <form onSubmit={(e) => { e.preventDefault(); run((inputRef.current?.value ?? input).trim()); }} className="flex gap-2">
        <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} aria-label="Ask an agentic question"
          placeholder="Ask a complex, multi-source question…" className="input py-3" />
        {running ? (
          <button type="button" onClick={stop} className="btn-secondary px-5"><Square size={16} /> Stop</button>
        ) : (
          <button type="submit" className="btn-primary px-6"><Send size={16} /> Run</button>
        )}
      </form>
      {!question && (
        <div className="mt-3 flex flex-wrap gap-2">
          {examples.map((ex) => <button key={ex} onClick={() => { setInput(ex); run(ex); }} className="chip-link">{ex}</button>)}
        </div>
      )}

      {question && (
        <div className="mt-6 space-y-4">
          {/* HERO: the answer */}
          <div className="card p-5">
            <div className="mb-2 flex items-center gap-2 text-brand-700">
              <Sparkles size={16} strokeWidth={2} /><span className="t-h3 text-brand-800">Answer</span>
              {running && <span className="ml-1 inline-flex items-center gap-1.5 text-xs font-normal text-ink-500"><Loader2 size={12} className="animate-spin" />{currentStep === 'Generate' ? 'Writing…' : currentStep === 'Retrieve' ? 'Reading sources…' : `${currentStep}…`}</span>}
              {clean && !running && <span className="ml-auto"><SaveButton item={() => ({ type: 'answer', title: question, question, content: answer, citations })} /></span>}
            </div>
            {clean ? (
              <div className="prose-answer" dangerouslySetInnerHTML={{ __html: renderMarkdown(clean) }} />
            ) : running ? (
              <div className="space-y-2"><div className="skeleton h-3 w-5/6" /><div className="skeleton h-3 w-4/6" /><div className="skeleton h-3 w-3/5" /></div>
            ) : (
              <p className="text-sm text-ink-500">No grounded answer — try rephrasing the question.</p>
            )}
            <Citations citations={citations} />
          </div>

          {/* Progressive disclosure: the machinery */}
          {(chunks.length > 0 || steps.length > 0 || !running) && (
            <div>
              <button onClick={() => setShowInspect((v) => !v)}
                className="flex w-full items-center gap-2 rounded-md px-1 py-2 text-sm font-medium text-ink-600 hover:text-ink-900">
                {showInspect ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                Show reasoning
                <span className="ml-1 text-xs font-normal text-ink-500">
                  {chunks.length} sources{totalTokens ? ` · ${totalTokens.toLocaleString()} tokens` : ''}{consumption?.totalSec ? ` · ${consumption.totalSec.toFixed(1)}s` : ''}
                </span>
              </button>

              {showInspect && (
                <div className="mt-2 grid gap-4 lg:grid-cols-[1fr_300px]">
                  <div className="min-w-0 space-y-4">
                    <div className="card p-4">
                      <div className="mb-3 t-overline">Pipeline</div>
                      <div className="flex flex-wrap gap-2">
                        {STAGES.map((s, i) => {
                          const detail = activeStages[s.id];
                          const done = i < lastActive || (!running && detail !== undefined);
                          const active = i === lastActive && running;
                          return (
                            <div key={s.id} className={`flex min-w-[130px] flex-1 items-center gap-2 rounded-md border px-3 py-2 ${active ? 'border-brand-400 bg-brand-50' : done ? 'border-brand-200 bg-brand-50/50' : 'border-ink-200 bg-white'}`}>
                              <span className={active ? 'text-brand-600' : done ? 'text-brand-600' : 'text-ink-300'}>
                                {active ? <Loader2 size={15} className="animate-spin" /> : done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1 text-xs font-semibold text-ink-700">{s.icon}{s.label}</div>
                                {detail && <div className="truncate text-[11px] text-ink-500">{detail}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {steps.length > 0 && (
                      <div className="card p-4">
                        <div className="mb-3 t-overline">Pipeline steps</div>
                        <ol className="space-y-1.5">
                          {steps.map((s, i) => (
                            <li key={s.id} className="flex items-center gap-2 text-sm">
                              <span className="text-xs font-bold text-ink-300">{i + 1}</span>
                              <span className="chip">{s.label}</span>
                              {s.reason && <span className="truncate text-xs text-ink-500">{s.reason}</span>}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <div className="card overflow-hidden">
                      <div className="border-b border-ink-100 px-4 py-3 t-h3">Context ({chunks.length})</div>
                      <div className="max-h-[26rem] space-y-2 overflow-y-auto p-3">
                        {chunks.length === 0 && <p className="px-1 py-4 text-center text-sm text-ink-500">{running ? 'Retrieving…' : 'No context.'}</p>}
                        {chunks.map((c, i) => (
                          <Link to={`/knowledge/${c.resourceId}`} key={i} className="block rounded-md border border-ink-100 p-2.5 hover:border-brand-200 hover:bg-brand-50/40">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-ink-300">{i + 1}</span>
                              <span className="truncate text-xs font-semibold text-ink-800">{cleanTitle(c.title)}</span>
                              <span className="ml-auto flex gap-0.5" title="Match strength">
                                {[1, 2, 3].map((n) => <span key={n} className={`h-1.5 w-1.5 rounded-full ${n <= strength(c.score) ? 'bg-brand-500' : 'bg-ink-200'}`} />)}
                              </span>
                            </div>
                            {c.text && <p className="mt-1 line-clamp-2 text-[11px] text-ink-500">{toPlainText(stripBoilerplate(c.text))}</p>}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>

                  <aside className="space-y-4">
                    <RemiGauge remi={remi} connected={aragOn} />
                    <ConsumptionReadout c={consumption} running={running} />
                    <DriverPanel activeModules={activeModules} aragConfigured={aragOn} />
                  </aside>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Traces */}
      {traces.length > 0 && (
        <div className="mt-10">
          <div className="mb-3 flex items-center gap-2"><History size={15} className="text-ink-400" /><h2 className="t-overline">Trace history</h2></div>
          <div className="space-y-2">
            {traces.map((t) => (
              <div key={t.id} className="card flex items-center gap-3 px-4 py-2.5">
                <button onClick={() => { setInput(t.question); run(t.question); }} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-medium text-ink-800">{t.question}</div>
                  <div className="flex items-center gap-3 text-[11px] text-ink-500">
                    <span><Layers size={11} className="mr-0.5 inline" />{t.chunks.length} sources</span>
                    {t.consumption?.outputTokens != null && <span><Hash size={11} className="mr-0.5 inline" />{((t.consumption.inputTokens || 0) + (t.consumption.outputTokens || 0)).toLocaleString()} tok</span>}
                    {t.durationMs != null && <span><Clock size={11} className="mr-0.5 inline" />{(t.durationMs / 1000).toFixed(1)}s</span>}
                  </div>
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={() => feedback(t.id, 'up')} aria-label="Helpful" className={t.feedback === 'up' ? 'text-brand-600' : 'text-ink-300 hover:text-brand-600'}><ThumbsUp size={15} /></button>
                  <button onClick={() => feedback(t.id, 'down')} aria-label="Not helpful" className={t.feedback === 'down' ? 'text-data-clay' : 'text-ink-300 hover:text-data-clay'}><ThumbsDown size={15} /></button>
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
      <div className="mb-3 t-overline">Consumption</div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Metric label="Input tokens" value={c?.inputTokens?.toLocaleString()} />
        <Metric label="Output tokens" value={c?.outputTokens?.toLocaleString()} />
        <Metric label="First chunk" value={c?.firstChunkSec != null ? `${c.firstChunkSec.toFixed(2)}s` : undefined} />
        <Metric label="Total gen" value={c?.totalSec != null ? `${c.totalSec.toFixed(2)}s` : undefined} />
      </div>
      {running && !c && <p className="mt-2 text-xs text-ink-500">Measuring…</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value?: number | string }) {
  return (
    <div className="rounded-md bg-ink-50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-ink-500">{label}</div>
      <div className="text-base font-semibold tabular-nums text-ink-900">{value ?? '—'}</div>
    </div>
  );
}
