import { useEffect, useState, useCallback } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { getLabelsets, getFacets, createLabelset, type LabelsetMap } from '../lib/nuclia';
import { PageHeader } from '../components/PageHeader';

export default function TaxonomyPage() {
  const [labelsets, setLabelsets] = useState<LabelsetMap>({});
  const [facets, setFacets] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ls = await getLabelsets();
      setLabelsets(ls);
      const entries = await Promise.all(Object.keys(ls).map(async (k) => [k, await getFacets(k).catch(() => ({}))] as const));
      setFacets(Object.fromEntries(entries));
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const title = newName.trim();
    // Derive a stable id from the name — the user never sees or types it.
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!id || !title) return;
    setCreating(true);
    try { await createLabelset(id, title, { multiple: true }); setNewName(''); await load(); }
    catch { /* */ } finally { setCreating(false); }
  };

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
      <PageHeader title="Taxonomy" description="Categories used to classify your resources. Counts reflect indexed content." />

      <div className="card mt-6 p-5">
        <h3 className="text-sm font-semibold text-ink-800">Add a category</h3>
        <p className="mt-1 text-xs text-ink-500">A way to classify resources — e.g. Region, Topic, Author, or Document type.</p>
        <form onSubmit={(e) => { e.preventDefault(); create(); }} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block flex-1 min-w-[220px]"><span className="text-xs font-semibold text-ink-500">Category name</span>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Region"
              className="mt-1 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500" /></label>
          <button type="submit" disabled={creating || !newName.trim()} className="btn-primary">
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add category
          </button>
        </form>
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-24 w-full rounded-xl" />)}</div>
      ) : (
        <div className="mt-6 space-y-4">
          {Object.entries(labelsets).map(([id, ls]) => {
            const counts = facets[id] || {};
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            return (
              <div key={id} className="card p-5">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: ls.color || '#3366ff' }} />
                  <h3 className="font-semibold text-ink-900">{ls.title}</h3>
                  <span className="ml-auto text-xs text-ink-400">{sorted.length} {sorted.length === 1 ? 'value' : 'values'}</span>
                </div>
                {sorted.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-400">No labels applied yet.</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sorted.map(([label, count]) => (
                      <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-xs">
                        <span className="font-medium text-ink-700">{label}</span>
                        <span className="rounded-full bg-brand-100 px-1.5 text-[10px] font-bold text-brand-700">{count}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
