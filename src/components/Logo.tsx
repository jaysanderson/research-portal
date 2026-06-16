export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="7" className="fill-brand-600" />
        <circle cx="14" cy="14" r="6.5" className="fill-none stroke-accent-300" strokeWidth="2.5" />
        <line x1="18.8" y1="18.8" x2="25" y2="25" className="stroke-accent-300" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="14" cy="14" r="1.8" className="fill-white" />
      </svg>
      <div className="leading-tight">
        <div className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink-900">Research Portal</div>
        <div className="t-overline text-ink-400">Agentic RAG</div>
      </div>
    </div>
  );
}
