import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Save } from 'lucide-react';
import { getSynonyms, putSynonyms, type SynonymMap } from '../lib/nuclia';
import { toast } from '../lib/toast';

/** Custom synonyms — map a term to its equivalents so keyword retrieval catches
 *  variants (e.g. "Sitefinity" ↔ "Progress CMS"). Applies to the whole KB. */
export function SynonymsPanel() {
  const [rows, setRows] = useState<{ term: string; alts: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getSynonyms()
      .then((m) => { if (active) setRows(Object.entries(m).map(([term, alts]) => ({ term, alts: (alts || []).join(', ') }))); })
      .catch(() => { if (active) setRows([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const update = (i: number, patch: Partial<{ term: string; alts: string }>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const save = async () => {
    const map: SynonymMap = {};
    for (const r of rows) {
      const term = r.term.trim();
      const alts = r.alts.split(',').map((s) => s.trim()).filter(Boolean);
      if (term && alts.length) map[term] = alts;
    }
    setSaving(true);
    try { await putSynonyms(map); toast(`Saved ${Object.keys(map).length} synonym set${Object.keys(map).length === 1 ? '' : 's'}.`, 'success'); }
    catch { toast('Could not save synonyms.', 'error'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="skeleton h-24 rounded-lg" />;

  return (
    <div>
      <p className="mb-3 text-sm text-ink-600">
        Teach the Knowledge Box that different words mean the same thing — keyword search will match any of them.
      </p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input value={r.term} onChange={(e) => update(i, { term: e.target.value })} placeholder="Term (e.g. Sitefinity)"
              className="input w-48 py-1.5 text-sm" aria-label="Synonym term" />
            <span className="text-ink-400">↔</span>
            <input value={r.alts} onChange={(e) => update(i, { alts: e.target.value })} placeholder="Equivalents, comma separated"
              className="input min-w-[200px] flex-1 py-1.5 text-sm" aria-label="Equivalent terms" />
            <button onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} aria-label="Remove synonym row"
              className="btn-ghost px-2 text-ink-400 hover:text-data-clay"><Trash2 size={15} /></button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-ink-400">No synonyms yet.</p>}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={() => setRows((r) => [...r, { term: '', alts: '' }])} className="btn-outline btn-sm"><Plus size={14} /> Add pair</button>
        <button onClick={save} disabled={saving} className="btn-primary btn-sm">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save synonyms
        </button>
      </div>
    </div>
  );
}
