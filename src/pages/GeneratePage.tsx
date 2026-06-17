import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Table2, FileText, GraduationCap, Loader2, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import { askStructured, type Citation } from '../lib/nuclia';
import { comparisonSchema, briefingSchema, quizSchema, type ComparisonOut, type BriefingOut, type QuizOut } from '../lib/schemas';
import { SaveButton } from '../components/SaveButton';
import { PageHeader } from '../components/PageHeader';
import { useKbProfile } from '../lib/hooks';
import { friendlyError } from '../lib/util';
import type { KbProfile } from '../lib/kbProfile';

function defaultQuery(kind: 'matrix' | 'briefing' | 'quiz', p: KbProfile | null): string {
  const subj = p?.subject || 'this knowledge base';
  if (kind === 'matrix') return `Compare the leading options or approaches in ${subj} across key criteria.`;
  if (kind === 'briefing') return `Write an executive briefing on the current state of ${subj}.`;
  return `Create a 5-question assessment on the key concepts in ${subj}.`;
}

/** Keeps a query field seeded from the KB profile until the user edits it. */
function useSeededQuery(kind: 'matrix' | 'briefing' | 'quiz') {
  const { profile } = useKbProfile();
  const [q, setQ] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (!touched) setQ(defaultQuery(kind, profile)); }, [profile, touched, kind]);
  return { q, setQ: (v: string) => { setQ(v); setTouched(true); } };
}

type Tab = 'matrix' | 'briefing' | 'quiz';

export default function GeneratePage() {
  const [tab, setTab] = useState<Tab>('matrix');
  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8">
      <PageHeader title="Generate" description="Schema-enforced research artifacts, generated and grounded in your Knowledge Box." />

      <div className="flex gap-1 rounded-lg border border-ink-200 bg-white p-1">
        <TabBtn active={tab === 'matrix'} onClick={() => setTab('matrix')} icon={<Table2 size={16} />} label="Comparison matrix" />
        <TabBtn active={tab === 'briefing'} onClick={() => setTab('briefing')} icon={<FileText size={16} />} label="Briefing" />
        <TabBtn active={tab === 'quiz'} onClick={() => setTab('quiz')} icon={<GraduationCap size={16} />} label="Assessment" />
      </div>

      <div className="mt-4">
        {tab === 'matrix' && <MatrixTool />}
        {tab === 'briefing' && <BriefingTool />}
        {tab === 'quiz' && <QuizTool />}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      active ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-100'}`}>{icon}{label}</button>
  );
}

function Composer({ value, onChange, onRun, busy, placeholder }: { value: string; onChange: (s: string) => void; onRun: () => void; busy: boolean; placeholder: string }) {
  return (
    <div className="flex gap-2">
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === 'Enter') onRun(); }}
        className="flex-1 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-400" />
      <button onClick={onRun} disabled={busy} className="btn-primary px-5">{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Generate</button>
    </div>
  );
}

function Citations({ items }: { items: Citation[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4 border-t border-ink-100 pt-3">
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-400">Sources</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((c, i) => c.resourceId
          ? <Link key={i} to={`/knowledge/${c.resourceId}`} className="chip hover:border-brand-300 hover:text-brand-700">{i + 1}. {c.title}</Link>
          : <span key={i} className="chip">{i + 1}. {c.title}</span>)}
      </div>
    </div>
  );
}

function useGenerator<T>(schema: any) {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<T | null>(null);
  const [cites, setCites] = useState<Citation[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const run = async (query: string) => {
    if (!query.trim()) return;
    setBusy(true); setErr(null); setOut(null);
    try { const { object, citations } = await askStructured<T>(query, schema); setOut(object); setCites(citations); }
    catch (e) { setErr(friendlyError(e, 'Could not generate this artifact. Try a narrower request.')); } finally { setBusy(false); }
  };
  return { busy, out, cites, err, run };
}

function MatrixTool() {
  const { q, setQ } = useSeededQuery('matrix');
  const { busy, out, cites, err, run } = useGenerator<ComparisonOut>(comparisonSchema);
  return (
    <div className="card p-5">
      <Composer value={q} onChange={setQ} onRun={() => run(q)} busy={busy} placeholder="Which vendors and dimensions to compare…" />
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      {out && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead><tr><th className="border border-ink-200 bg-ink-50 px-3 py-2 text-left">Option</th>
              {out.dimensions.map((d) => <th key={d} className="border border-ink-200 bg-ink-50 px-3 py-2 text-left">{d}</th>)}</tr></thead>
            <tbody>
              {out.vendors.map((v) => (
                <tr key={v.name}>
                  <td className="border border-ink-200 px-3 py-2 font-semibold text-ink-800">{v.name}</td>
                  {out.dimensions.map((d) => {
                    const cell = v.ratings.find((r) => r.dimension.toLowerCase() === d.toLowerCase());
                    return <td key={d} className="border border-ink-200 px-3 py-2 align-top text-ink-600">{cell?.assessment || '—'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <Citations items={cites} />
        </div>
      )}
    </div>
  );
}

function BriefingTool() {
  const { q, setQ } = useSeededQuery('briefing');
  const { busy, out, cites, err, run } = useGenerator<BriefingOut>(briefingSchema);
  return (
    <div className="card p-5">
      <Composer value={q} onChange={setQ} onRun={() => run(q)} busy={busy} placeholder="Briefing topic…" />
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      {out && (
        <article className="mt-5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold text-ink-900">{out.title}</h2>
            <SaveButton item={() => ({ type: 'artifact', title: out.title, content: `${out.executive_summary}\n\n${out.sections.map((s) => `### ${s.heading}\n${s.content}`).join('\n\n')}\n\n**Key takeaways**\n${out.key_takeaways.map((k) => `- ${k}`).join('\n')}`, citations: cites })} />
          </div>
          <p className="mt-2 rounded-lg bg-brand-50/60 p-3 text-sm text-ink-700">{out.executive_summary}</p>
          {out.sections.map((s, i) => (
            <div key={i} className="mt-4"><h3 className="font-semibold text-ink-900">{s.heading}</h3><p className="mt-1 text-sm text-ink-600">{s.content}</p></div>
          ))}
          {out.key_takeaways?.length > 0 && (
            <div className="mt-5"><h3 className="font-semibold text-ink-900">Key takeaways</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-600">{out.key_takeaways.map((k, i) => <li key={i}>{k}</li>)}</ul></div>
          )}
          <Citations items={cites} />
        </article>
      )}
    </div>
  );
}

function QuizTool() {
  const { q, setQ } = useSeededQuery('quiz');
  const { busy, out, cites, err, run } = useGenerator<QuizOut>(quizSchema);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const start = (query: string) => { setAnswers({}); setSubmitted(false); run(query); };
  const score = out ? out.questions.reduce((s, qq, i) => s + (answers[i] === qq.correct_index ? 1 : 0), 0) : 0;

  return (
    <div className="card p-5">
      <Composer value={q} onChange={setQ} onRun={() => start(q)} busy={busy} placeholder="Assessment topic…" />
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      {out && (
        <div className="mt-5 space-y-5">
          {out.questions.map((qq, qi) => (
            <div key={qi}>
              <div className="font-semibold text-ink-900">{qi + 1}. {qq.question}</div>
              <div className="mt-2 space-y-1.5">
                {qq.options.map((opt, oi) => {
                  const chosen = answers[qi] === oi;
                  const correct = submitted && oi === qq.correct_index;
                  const wrong = submitted && chosen && oi !== qq.correct_index;
                  return (
                    <button key={oi} disabled={submitted} onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        correct ? 'border-emerald-400 bg-emerald-50' : wrong ? 'border-rose-400 bg-rose-50'
                        : chosen ? 'border-brand-400 bg-brand-50' : 'border-ink-200 hover:bg-ink-50'}`}>
                      <span className="font-bold text-ink-400">{String.fromCharCode(65 + oi)}</span>
                      <span className="flex-1">{opt}</span>
                      {correct && <CheckCircle2 size={15} className="text-emerald-600" />}
                      {wrong && <XCircle size={15} className="text-rose-600" />}
                    </button>
                  );
                })}
              </div>
              {submitted && <p className="mt-1.5 text-xs text-ink-500"><span className="font-semibold">Why:</span> {qq.explanation}</p>}
            </div>
          ))}
          {!submitted ? (
            <button onClick={() => setSubmitted(true)} disabled={Object.keys(answers).length < out.questions.length} className="btn-primary">Submit answers</button>
          ) : (
            <div className="rounded-lg bg-ink-900 px-4 py-3 text-white">Score: <span className="font-bold">{score}/{out.questions.length}</span></div>
          )}
          <Citations items={cites} />
        </div>
      )}
    </div>
  );
}
