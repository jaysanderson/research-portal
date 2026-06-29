import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X, Play, Pause, ChevronLeft, ChevronRight, Sparkles, ExternalLink, Quote, CheckCircle2, Compass, Loader2 } from 'lucide-react';
import { buildStops, relate, type JourneyStop } from '../../lib/journey';
import { ConfidenceRing } from './ConfidenceRing';
import { useCurrentKb, useKbImage } from '../../lib/hooks';
import { cleanTitle, gradientFor } from '../../lib/util';
import { renderMarkdown } from '../../lib/markdown';

const DWELL_MS = 5600; // auto-advance dwell after the relation finishes (covers the slow read-scroll)
const safeHost = (u?: string) => { if (!u) return ''; try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const dotColor = (s: number) => (s >= 0.7 ? 'bg-brand-400' : s >= 0.4 ? 'bg-accent-400' : 'bg-data-clay');

interface Rel { text: string; done: boolean }

export function AnswerJourney({ open, query, filters = [], citedIds = [], presetStops, onClose }: {
  open: boolean; query: string; filters?: string[]; citedIds?: string[]; presetStops?: JourneyStop[]; onClose: () => void;
}) {
  const kb = useCurrentKb();
  const [stops, setStops] = useState<JourneyStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(-1);          // -1 intro · 0..n-1 stops · n outro
  const [rel, setRel] = useState<Record<number, Rel>>({});
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Build the stops on open.
  useEffect(() => {
    if (!open) return;
    setLoading(true); setStops([]); setIdx(-1); setRel({}); setPlaying(true); setProgress(0);
    let active = true;
    (async () => {
      try {
        const s = presetStops?.length ? presetStops : await buildStops(query, filters, citedIds);
        if (active) { setStops(s); setLoading(false); }
      } catch { if (active) { setStops([]); setLoading(false); } }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Scroll-lock while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const n = stops.length;
  const atStop = idx >= 0 && idx < n;
  const stop = atStop ? stops[idx] : undefined;
  const heroImg = useKbImage(stop?.thumbnail, kb?.id);

  const goTo = (i: number) => { setIdx(Math.max(-1, Math.min(i, n))); setProgress(0); };
  const next = () => goTo(idx + 1);
  const prev = () => goTo(idx - 1);

  // Stream the "how this relates" answer for the current stop (cached).
  useEffect(() => {
    if (!open || !atStop || rel[idx]) return;
    const s = stops[idx]; const ctrl = new AbortController();
    setRel((r) => ({ ...r, [idx]: { text: '', done: false } }));
    (async () => {
      try { for await (const acc of relate(s.resourceId, query, ctrl.signal)) setRel((r) => ({ ...r, [idx]: { text: acc, done: false } })); }
      catch { /* ignore */ }
      finally { if (!ctrl.signal.aborted) setRel((r) => ({ ...r, [idx]: { text: r[idx]?.text || '', done: true } })); }
    })();
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, open, atStop]);

  const curDone = atStop && rel[idx]?.done;

  // Reset scroll to the top whenever we land on a new stop.
  useEffect(() => { if (contentRef.current) contentRef.current.scrollTop = 0; }, [idx]);

  // Once a stop's relation has streamed in, slowly scroll through the text to the
  // bottom (cinematic reveal). Cancels if the viewer scrolls manually.
  useEffect(() => {
    if (!atStop || !curDone) return;
    const el = contentRef.current; if (!el) return;
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = el.scrollHeight - el.clientHeight;
    if (reduce || target <= el.scrollTop + 8) return;
    const start = el.scrollTop; const t0 = performance.now(); const dur = 3800;
    let raf = 0; let cancelled = false;
    const cancel = () => { cancelled = true; };
    el.addEventListener('wheel', cancel, { passive: true });
    el.addEventListener('pointerdown', cancel, { passive: true });
    const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
    const step = (t: number) => { if (cancelled) return; const k = Math.min((t - t0) / dur, 1); el.scrollTop = start + (target - start) * ease(k); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); el.removeEventListener('wheel', cancel); el.removeEventListener('pointerdown', cancel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, curDone, atStop]);

  // Auto-advance: intro → first stop; each stop dwells after its relation finishes.
  useEffect(() => {
    if (!open || !playing) return;
    if (idx === -1) { const t = setTimeout(() => goTo(0), 2400); return () => clearTimeout(t); }
    if (!atStop || !curDone) { setProgress(0); return; }
    let elapsed = 0; const STEP = 60;
    const t = setInterval(() => { elapsed += STEP; setProgress(Math.min(elapsed / DWELL_MS, 1)); if (elapsed >= DWELL_MS) { clearInterval(t); next(); } }, STEP);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, open, playing, curDone]);

  // Keyboard controls.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true } as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idx, n]);

  if (!open) return null;

  const relText = atStop ? rel[idx]?.text : '';

  return createPortal((
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-950/85 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-ink-900 text-white shadow-lg ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}>

        {/* top bar */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">
            <Compass size={13} className="text-brand-300" /> {atStop ? `Source ${idx + 1} of ${n}` : 'Answer journey'}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'} className="rounded-full bg-black/40 p-1.5 text-white/80 backdrop-blur-sm hover:text-white">{playing ? <Pause size={15} /> : <Play size={15} />}</button>
            <button onClick={onClose} aria-label="Close" className="rounded-full bg-black/40 p-1.5 text-white/80 backdrop-blur-sm hover:text-white"><X size={15} /></button>
          </div>
        </div>

        <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-80 flex-col items-center justify-center gap-3 text-white/70"><Loader2 size={26} className="animate-spin text-brand-300" /><p className="text-sm">Tracing the grounding…</p></div>
          ) : n === 0 ? (
            <div className="flex h-80 flex-col items-center justify-center gap-3 px-8 text-center text-white/70">
              <Compass size={28} className="text-white/40" />
              <p className="text-sm">There's no grounded context to walk through for this answer.</p>
              <button onClick={onClose} className="btn-primary btn-sm">Close</button>
            </div>
          ) : idx === -1 ? (
            /* INTRO */
            <div className="flex min-h-[26rem] flex-col items-center justify-center gap-4 px-8 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-300 animate-rise"><Sparkles size={26} /></span>
              <h2 className="t-display animate-rise text-white" style={{ animationDelay: '60ms' }}>How this answer was built</h2>
              <p className="max-w-md animate-rise text-sm text-white/70" style={{ animationDelay: '120ms' }}>
                We grounded your answer in <span className="font-semibold text-white">{n}</span> source{n === 1 ? '' : 's'}. Let's walk them — strongest match first — and ask each one how it relates.
              </p>
              <p className="max-w-md animate-rise rounded-lg bg-white/5 px-4 py-2 text-sm italic text-white/80" style={{ animationDelay: '180ms' }}>“{query}”</p>
              <button onClick={() => goTo(0)} className="btn-primary mt-1 animate-rise" style={{ animationDelay: '240ms' }}><Play size={15} /> Begin the journey</button>
            </div>
          ) : idx >= n ? (
            /* OUTRO */
            <div className="flex min-h-[26rem] flex-col items-center justify-center gap-4 px-8 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-300 animate-rise"><CheckCircle2 size={26} /></span>
              <h2 className="t-display animate-rise text-white">That's the trail</h2>
              <p className="max-w-md animate-rise text-sm text-white/70" style={{ animationDelay: '80ms' }}>Your answer was synthesized from these {n} sources, strongest first:</p>
              <div className="w-full max-w-md animate-rise space-y-1.5" style={{ animationDelay: '140ms' }}>
                {stops.map((s, i) => (
                  <button key={s.resourceId} onClick={() => goTo(i)} className="flex w-full items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-left hover:bg-white/10">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor(s.score)}`} />
                    <span className="min-w-0 flex-1 truncate text-sm text-white/85">{cleanTitle(s.title)}</span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-white/50">{Math.round(Math.min(s.score, 1) * 100)}%</span>
                  </button>
                ))}
              </div>
              <div className="mt-1 flex animate-rise gap-2" style={{ animationDelay: '200ms' }}>
                <button onClick={() => { setRel({}); goTo(-1); }} className="btn-outline btn-sm !border-white/20 !text-white hover:!bg-white/10"><Play size={14} /> Replay</button>
                <button onClick={onClose} className="btn-primary btn-sm">Done</button>
              </div>
            </div>
          ) : stop ? (
            /* STOP */
            <div>
              {/* hero */}
              <div className="relative h-56 w-full overflow-hidden" style={{ background: gradientFor(stop.title) }}>
                {heroImg && <img key={heroImg} src={heroImg} alt="" className="h-full w-full object-cover object-top animate-kenburns" />}
                <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/50 to-transparent" />
                {stop.cited && (
                  <span className="absolute right-4 top-14 inline-flex items-center gap-1 rounded-full bg-brand-500/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm"><CheckCircle2 size={12} /> Cited in the answer</span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4">
                  <div className="min-w-0 animate-rise">
                    <h3 className="line-clamp-2 text-xl font-bold leading-tight text-white">{cleanTitle(stop.title)}</h3>
                    {stop.url && <div className="mt-1 truncate text-xs text-white/60">{safeHost(stop.url)}</div>}
                    {stop.labels.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">{stop.labels.map((l) => <span key={l} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/80">{l}</span>)}</div>
                    )}
                  </div>
                  <div className="shrink-0"><ConfidenceRing score={stop.score} size={104} /></div>
                </div>
              </div>

              {/* body */}
              <div className="space-y-4 p-6">
                <div className="animate-rise">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white/40"><Quote size={12} /> What we found here</div>
                  <p className="line-clamp-4 text-sm leading-relaxed text-white/75">{stop.quote || 'This source contributed supporting context.'}</p>
                </div>
                <div className="animate-rise" style={{ animationDelay: '80ms' }}>
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-300"><Sparkles size={12} /> How this relates to your question</div>
                  {relText ? (
                    <div className="prose-answer prose-invert text-sm text-white/90 [&_*]:text-white/90" dangerouslySetInnerHTML={{ __html: renderMarkdown(relText) }} />
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-white/50"><Loader2 size={14} className="animate-spin" /> Asking this source…</div>
                  )}
                </div>
                {stop.url && (
                  <a href={stop.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-300 hover:text-brand-200">Open original <ExternalLink size={13} /></a>
                )}
                <Link to={`/knowledge/${stop.resourceId}`} onClick={onClose} className="ml-3 inline-flex items-center gap-1 text-sm font-medium text-white/60 hover:text-white">View in library →</Link>
              </div>
            </div>
          ) : null}
        </div>

        {/* footer: per-stop progress + confidence track + nav */}
        {!loading && n > 0 && (
          <div className="border-t border-white/10 bg-ink-900/95 px-4 py-3">
            <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-brand-400" style={{ width: idx < 0 ? '0%' : idx >= n ? '100%' : `${Math.round(progress * 100)}%`, transition: 'width 0.1s linear' }} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <button onClick={prev} disabled={idx <= -1} className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"><ChevronLeft size={18} /></button>
              <div className="flex flex-1 items-center justify-center gap-1.5">
                {stops.map((s, i) => (
                  <button key={s.resourceId} onClick={() => goTo(i)} aria-label={`Source ${i + 1}`}
                    className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 ' + dotColor(s.score) : 'w-2 bg-white/25 hover:bg-white/50'}`} />
                ))}
              </div>
              <button onClick={next} disabled={idx >= n} className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"><ChevronRight size={18} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  ), document.body);
}
