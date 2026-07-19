import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Table2, FileText, GraduationCap, Loader2, Sparkles, CheckCircle2, XCircle, Copy, Check, Download, Printer, CalendarClock, Scale, HelpCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { askStructured, type Citation } from '../lib/nuclia';
import { comparisonSchema, briefingSchema, quizSchema, timelineSchema, prosConsSchema, faqSchema, type ComparisonOut, type BriefingOut, type QuizOut, type TimelineOut, type ProsConsOut, type FaqOut } from '../lib/schemas';
import { copyText, matrixToCsv, matrixToMarkdown, briefingToMarkdown, downloadCsv, printDocument } from '../lib/exports';
import { SaveButton } from '../components/SaveButton';
import { PageHeader } from '../components/PageHeader';
import { useKbProfile } from '../lib/hooks';
import { friendlyError } from '../lib/util';
import type { KbProfile } from '../lib/kbProfile';

function defaultQuery(kind: Tab, p: KbProfile | null): string {
  const subj = p?.subject || 'this knowledge base';
  if (kind === 'matrix') return `Compare the leading options or approaches in ${subj} across key criteria.`;
  if (kind === 'briefing') return `Write an executive briefing on the current state of ${subj}.`;
  if (kind === 'timeline') return `Build a timeline of the key developments and milestones in ${subj}.`;
  if (kind === 'proscons') return `Weigh the pros and cons of the leading approach in ${subj}.`;
  if (kind === 'faq') return `Write an FAQ covering the most common questions about ${subj}.`;
  return `Create a 5-question assessment on the key concepts in ${subj}.`;
}

/** Keeps a query field seeded from the KB profile until the user edits it. */
function useSeededQuery(kind: Tab) {
  const { profile } = useKbProfile();
  const [q, setQ] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (!touched) setQ(defaultQuery(kind, profile)); }, [profile, touched, kind]);
  return { q, setQ: (v: string) => { setQ(v); setTouched(true); } };
}

type Tab = 'matrix' | 'briefing' | 'timeline' | 'proscons' | 'faq' | 'quiz';

export default function GeneratePage() {
  const [tab, setTab] = useState<Tab>('matrix');
  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8">
      <PageHeader title="Generate" description="Schema-enforced research artifacts, generated and grounded in your Knowledge Box." />

      <div className="flex gap-1 overflow-x-auto rounded-lg border border-ink-200 bg-white p-1">
        <TabBtn active={tab === 'matrix'} onClick={() => setTab('matrix')} icon={<Table2 size={16} />} label="Comparison" />
        <TabBtn active={tab === 'briefing'} onClick={() => setTab('briefing')} icon={<FileText size={16} />} label="Briefing" />
        <TabBtn active={tab === 'timeline'} onClick={() => setTab('timeline')} icon={<CalendarClock size={16} />} label="Timeline" />
        <TabBtn active={tab === 'proscons'} onClick={() => setTab('proscons')} icon={<Scale size={16} />} label="Pros & cons" />
        <TabBtn active={tab === 'faq'} onClick={() => setTab('faq')} icon={<HelpCircle size={16} />} label="FAQ" />
        <TabBtn active={tab === 'quiz'} onClick={() => setTab('quiz')} icon={<GraduationCap size={16} />} label="Assessment" />
      </div>

      <div className="mt-4">
        {tab === 'matrix' && <MatrixTool />}
        {tab === 'briefing' && <BriefingTool />}
        {tab === 'timeline' && <TimelineTool />}
        {tab === 'proscons' && <ProsConsTool />}
        {tab === 'faq' && <FaqTool />}
        {tab === 'quiz' && <QuizTool />}
      </div>
    </div>
  );
}

function ExportBtn({ onClick, icon, label, done }: { onClick: () => void; icon: React.ReactNode; label: string; done?: boolean }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 transition-colors hover:border-ink-300 hover:text-ink-800">
      {done ? <Check size={13} className="text-brand-600" /> : icon} {done ? 'Copied' : label}
    </button>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      active ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-100'}`}>{icon}{label}</button>
  );
}

function Composer({ value, onChange, onRun, busy, placeholder }: { value: string; onChange: (s: string) => void; onRun: (live: string) => void; busy: boolean; placeholder: string }) {
  const ref = useRef<HTMLInputElement>(null);
  // Read the live DOM value so a click right after a keystroke can't fire on stale state.
  const submit = () => onRun((ref.current?.value ?? value).trim());
  return (
    <div className="flex gap-2">
      <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        className="flex-1 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-400" />
      <button onClick={submit} disabled={busy} className="btn-primary px-5">{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Generate</button>
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

function GenSkeleton({ label }: { label: string }) {
  return (
    <div className="mt-5" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-2 text-sm text-ink-500"><Loader2 size={14} className="animate-spin" /> {label}</div>
      <div className="mt-4 space-y-2.5">
        <div className="skeleton h-5 w-2/3 rounded" />
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-4 w-11/12 rounded" />
        <div className="skeleton h-4 w-4/5 rounded" />
        <div className="skeleton mt-3 h-24 w-full rounded-lg" />
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
  const [copied, setCopied] = useState(false);
  const copyMd = () => copyText(matrixToMarkdown(out!)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  const matrixHtml = () => `<h1>Comparison — ${q}</h1><table><thead><tr><th>Option</th>${out!.dimensions.map((d) => `<th>${d}</th>`).join('')}</tr></thead><tbody>${out!.vendors.map((v) => `<tr><td><b>${v.name}</b></td>${out!.dimensions.map((d) => `<td>${v.ratings.find((r) => r.dimension.toLowerCase() === d.toLowerCase())?.assessment || '—'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  return (
    <div className="card p-5">
      <Composer value={q} onChange={setQ} onRun={(v) => run(v)} busy={busy} placeholder="Which vendors and dimensions to compare…" />
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      {busy && !out && <GenSkeleton label="Building comparison matrix…" />}
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
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ExportBtn onClick={copyMd} icon={<Copy size={13} />} label="Copy" done={copied} />
            <ExportBtn onClick={() => downloadCsv('comparison.csv', matrixToCsv(out))} icon={<Download size={13} />} label="CSV" />
            <ExportBtn onClick={() => printDocument('Comparison', matrixHtml())} icon={<Printer size={13} />} label="Print / PDF" />
            <SaveButton item={() => ({ type: 'artifact', title: `Comparison: ${q.slice(0, 60)}`, content: matrixToMarkdown(out), citations: cites })} />
          </div>
          <Citations items={cites} />
        </div>
      )}
    </div>
  );
}

function BriefingTool() {
  const { q, setQ } = useSeededQuery('briefing');
  const { busy, out, cites, err, run } = useGenerator<BriefingOut>(briefingSchema);
  const [copied, setCopied] = useState(false);
  const copyMd = () => copyText(briefingToMarkdown(out!, cites)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  const briefingHtml = () => `<h1>${out!.title}</h1><blockquote>${out!.executive_summary}</blockquote>${out!.sections.map((s) => `<h2>${s.heading}</h2><p>${s.content}</p>`).join('')}${out!.key_takeaways?.length ? `<h2>Key takeaways</h2><ul>${out!.key_takeaways.map((k) => `<li>${k}</li>`).join('')}</ul>` : ''}${cites.length ? `<h2>Sources</h2><ol class="src">${cites.map((c) => `<li>${c.title}</li>`).join('')}</ol>` : ''}`;
  return (
    <div className="card p-5">
      <Composer value={q} onChange={setQ} onRun={(v) => run(v)} busy={busy} placeholder="Briefing topic…" />
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      {busy && !out && <GenSkeleton label="Writing briefing…" />}
      {out && (
        <article className="mt-5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold text-ink-900">{out.title}</h2>
            <SaveButton item={() => ({ type: 'artifact', title: out.title, content: `${out.executive_summary}\n\n${out.sections.map((s) => `### ${s.heading}\n${s.content}`).join('\n\n')}\n\n**Key takeaways**\n${out.key_takeaways.map((k) => `- ${k}`).join('\n')}`, citations: cites })} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <ExportBtn onClick={copyMd} icon={<Copy size={13} />} label="Copy" done={copied} />
            <ExportBtn onClick={() => printDocument(out.title, briefingHtml())} icon={<Printer size={13} />} label="Print / PDF" />
          </div>
          <p className="mt-3 rounded-lg bg-brand-50/60 p-3 text-sm text-ink-700">{out.executive_summary}</p>
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

function TimelineTool() {
  const { q, setQ } = useSeededQuery('timeline');
  const { busy, out, cites, err, run } = useGenerator<TimelineOut>(timelineSchema);
  const md = () => `# ${out!.title}\n\n${out!.events.map((e) => `**${e.date}** — ${e.title}\n\n${e.detail}`).join('\n\n')}`;
  return (
    <div className="card p-5">
      <Composer value={q} onChange={setQ} onRun={(v) => run(v)} busy={busy} placeholder="Timeline topic…" />
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      {busy && !out && <GenSkeleton label="Building timeline…" />}
      {out && (
        <div className="mt-5">
          <h2 className="text-xl font-bold text-ink-900">{out.title}</h2>
          <ol className="relative mt-4 border-l border-ink-200 pl-5">
            {out.events.map((e, i) => (
              <li key={i} className="relative pb-5">
                <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-brand-600 ring-4 ring-white" />
                <div className="text-xs font-bold uppercase tracking-wide text-brand-700">{e.date}</div>
                <div className="font-semibold text-ink-900">{e.title}</div>
                <p className="mt-0.5 text-sm text-ink-600">{e.detail}</p>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <ExportBtn onClick={() => copyText(md())} icon={<Copy size={13} />} label="Copy" />
            <ExportBtn onClick={() => printDocument(out.title, `<h1>${out.title}</h1>${out.events.map((e) => `<h3>${e.date} — ${e.title}</h3><p>${e.detail}</p>`).join('')}`)} icon={<Printer size={13} />} label="Print / PDF" />
            <SaveButton item={() => ({ type: 'artifact', title: out.title, content: md(), citations: cites })} />
          </div>
          <Citations items={cites} />
        </div>
      )}
    </div>
  );
}

function ProsConsTool() {
  const { q, setQ } = useSeededQuery('proscons');
  const { busy, out, cites, err, run } = useGenerator<ProsConsOut>(prosConsSchema);
  const md = () => `# ${out!.subject}\n\n> ${out!.verdict}\n\n## Pros\n${out!.pros.map((p) => `- **${p.point}** — ${p.evidence}`).join('\n')}\n\n## Cons\n${out!.cons.map((p) => `- **${p.point}** — ${p.evidence}`).join('\n')}`;
  return (
    <div className="card p-5">
      <Composer value={q} onChange={setQ} onRun={(v) => run(v)} busy={busy} placeholder="What to weigh up…" />
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      {busy && !out && <GenSkeleton label="Weighing the evidence…" />}
      {out && (
        <div className="mt-5">
          <h2 className="text-xl font-bold text-ink-900">{out.subject}</h2>
          <p className="mt-2 rounded-lg bg-brand-50/60 p-3 text-sm text-ink-700">{out.verdict}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><ThumbsUp size={14} /> Pros</div>
              <ul className="space-y-2">{out.pros.map((p, i) => <li key={i} className="rounded-lg border border-ink-200 p-2.5 text-sm"><span className="font-semibold text-ink-900">{p.point}</span><p className="mt-0.5 text-ink-600">{p.evidence}</p></li>)}</ul>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-data-clay"><ThumbsDown size={14} /> Cons</div>
              <ul className="space-y-2">{out.cons.map((p, i) => <li key={i} className="rounded-lg border border-ink-200 p-2.5 text-sm"><span className="font-semibold text-ink-900">{p.point}</span><p className="mt-0.5 text-ink-600">{p.evidence}</p></li>)}</ul>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <ExportBtn onClick={() => copyText(md())} icon={<Copy size={13} />} label="Copy" />
            <ExportBtn onClick={() => printDocument(out.subject, `<h1>${out.subject}</h1><blockquote>${out.verdict}</blockquote><h2>Pros</h2><ul>${out.pros.map((p) => `<li><b>${p.point}</b> — ${p.evidence}</li>`).join('')}</ul><h2>Cons</h2><ul>${out.cons.map((p) => `<li><b>${p.point}</b> — ${p.evidence}</li>`).join('')}</ul>`)} icon={<Printer size={13} />} label="Print / PDF" />
            <SaveButton item={() => ({ type: 'artifact', title: `Pros & cons: ${out.subject}`, content: md(), citations: cites })} />
          </div>
          <Citations items={cites} />
        </div>
      )}
    </div>
  );
}

function FaqTool() {
  const { q, setQ } = useSeededQuery('faq');
  const { busy, out, cites, err, run } = useGenerator<FaqOut>(faqSchema);
  const md = () => `# ${out!.title}\n\n${out!.items.map((it) => `**${it.question}**\n\n${it.answer}`).join('\n\n')}`;
  return (
    <div className="card p-5">
      <Composer value={q} onChange={setQ} onRun={(v) => run(v)} busy={busy} placeholder="FAQ topic…" />
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      {busy && !out && <GenSkeleton label="Drafting FAQ…" />}
      {out && (
        <div className="mt-5">
          <h2 className="text-xl font-bold text-ink-900">{out.title}</h2>
          <div className="mt-3 divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200">
            {out.items.map((it, i) => (
              <details key={i} className="group p-3">
                <summary className="cursor-pointer select-none text-sm font-semibold text-ink-900">{it.question}</summary>
                <p className="mt-2 text-sm text-ink-600">{it.answer}</p>
              </details>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <ExportBtn onClick={() => copyText(md())} icon={<Copy size={13} />} label="Copy" />
            <ExportBtn onClick={() => printDocument(out.title, `<h1>${out.title}</h1>${out.items.map((it) => `<h3>${it.question}</h3><p>${it.answer}</p>`).join('')}`)} icon={<Printer size={13} />} label="Print / PDF" />
            <SaveButton item={() => ({ type: 'artifact', title: out.title, content: md(), citations: cites })} />
          </div>
          <Citations items={cites} />
        </div>
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
      <Composer value={q} onChange={setQ} onRun={(v) => start(v)} busy={busy} placeholder="Assessment topic…" />
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      {busy && !out && <GenSkeleton label="Generating assessment…" />}
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
