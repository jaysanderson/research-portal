export function BarList({ data, color = '#1A6A4F', max }: { data: [string, number][]; color?: string; max?: number }) {
  const top = Math.max(max ?? 0, ...data.map((d) => d[1]), 1);
  return (
    <div className="space-y-1.5">
      {data.map(([label, value]) => (
        <div key={label} className="flex items-center gap-2 text-sm">
          <div className="w-40 shrink-0 truncate text-ink-600" title={label}>{label}</div>
          <div className="h-4 flex-1 overflow-hidden rounded bg-ink-100">
            <div className="h-full rounded" style={{ width: `${(value / top) * 100}%`, background: color }} />
          </div>
          <div className="w-10 shrink-0 text-right font-semibold text-ink-700">{value}</div>
        </div>
      ))}
    </div>
  );
}
