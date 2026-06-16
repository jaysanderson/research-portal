const MAP: Record<string, { label: string; cls: string; dot: string }> = {
  PENDING: { label: 'Processing', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500 animate-pulse' },
  PROCESSED: { label: 'Indexed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  ERROR: { label: 'Error', cls: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  UPLOADING: { label: 'Uploading', cls: 'bg-brand-50 text-brand-700 border-brand-200', dot: 'bg-brand-500 animate-pulse' },
};

export function StatusChip({ status }: { status?: string }) {
  const s = MAP[status || ''] || { label: status || 'Queued', cls: 'bg-ink-50 text-ink-500 border-ink-200', dot: 'bg-ink-300' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
