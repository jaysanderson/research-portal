import { useEffect, useState, useCallback } from 'react';
import { Trash2, ExternalLink, RotateCw, FileText, Link2, File } from 'lucide-react';
import { listCatalog, deleteResource, type ResourceCard } from '../../lib/nuclia';
import { StatusChip } from '../StatusChip';

function iconFor(r: ResourceCard) {
  if (r.url) return <Link2 size={15} className="text-ink-400" />;
  if (r.icon?.startsWith('text')) return <FileText size={15} className="text-ink-400" />;
  return <File size={15} className="text-ink-400" />;
}

export function RecentResources({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<ResourceCard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { resources } = await listCatalog({ size: 12, page: 0 });
      resources.sort((a, b) => (b.created || '').localeCompare(a.created || ''));
      setItems(resources);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Poll while anything is still processing.
  useEffect(() => {
    const anyPending = items.some((i) => i.status === 'PENDING');
    if (!anyPending) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [items, load]);

  const remove = async (id: string) => {
    if (!confirm('Delete this resource from the Knowledge Box?')) return;
    setItems((x) => x.filter((i) => i.id !== id));
    try { await deleteResource(id); } catch { load(); }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-ink-800">Recent additions</h3>
        <button onClick={load} className="btn-ghost px-2 py-1 text-xs"><RotateCw size={13} /> Refresh</button>
      </div>
      {loading ? (
        <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
      ) : items.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-400">Nothing added yet.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {items.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              {iconFor(r)}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink-800">{r.title}</div>
                {r.url && <div className="truncate text-xs text-ink-400">{r.url}</div>}
              </div>
              <StatusChip status={r.status} />
              {r.url && (
                <a href={r.url} target="_blank" rel="noreferrer" className="text-ink-400 hover:text-brand-600"><ExternalLink size={15} /></a>
              )}
              <button onClick={() => remove(r.id)} className="text-ink-400 hover:text-rose-600"><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
