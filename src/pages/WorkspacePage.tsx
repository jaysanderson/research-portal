import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Plus, Download, FileDown, Table, Quote, StickyNote, MessageSquare, FileText, Library as LibIcon } from 'lucide-react';
import { loadWorkspace, addItem, removeItem, clearWorkspace, toMarkdown, toBibtex, toCsv, download, type WorkspaceItem } from '../lib/workspace';
import { renderMarkdown } from '../lib/markdown';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/States';

const ICON: Record<string, React.ReactNode> = {
  note: <StickyNote size={15} />, answer: <MessageSquare size={15} />, resource: <LibIcon size={15} />, artifact: <FileText size={15} />,
};

export default function WorkspacePage() {
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');

  const refresh = () => setItems(loadWorkspace());
  useEffect(() => { refresh(); window.addEventListener('workspace-change', refresh); return () => window.removeEventListener('workspace-change', refresh); }, []);

  const addNote = () => { if (!noteBody.trim()) return; addItem({ type: 'note', title: noteTitle || 'Note', content: noteBody }); setNoteTitle(''); setNoteBody(''); };

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8">
      <PageHeader title="Workspace" description="Saved findings, answers, resources and notes — compile and export a cited report."
        actions={items.length > 0 ? (
          <>
            <button onClick={() => download('research-report.md', toMarkdown(items), 'text/markdown')} className="btn-outline btn-sm"><FileDown size={14} /> Markdown</button>
            <button onClick={() => download('citations.bib', toBibtex(items), 'text/plain')} className="btn-outline btn-sm"><Quote size={14} /> BibTeX</button>
            <button onClick={() => download('workspace.csv', toCsv(items), 'text/csv')} className="btn-outline btn-sm"><Table size={14} /> CSV</button>
            <button onClick={() => { if (confirm('Clear the workspace?')) { clearWorkspace(); } }} className="btn-ghost btn-sm text-data-clay"><Trash2 size={14} /> Clear</button>
          </>
        ) : undefined} />

      <div className="card mt-6 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-800"><Plus size={15} /> Add a note</div>
        <input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Note title (optional)"
          className="mb-2 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
        <textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={3} placeholder="Your note (Markdown supported)…"
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
        <button onClick={addNote} className="btn-primary mt-2 text-sm"><Plus size={15} /> Add note</button>
      </div>

      {items.length === 0 ? (
        <div className="card mt-6">
          <EmptyState icon={<Download size={24} strokeWidth={1.75} />} title="Nothing saved yet"
            description="Use “Save to workspace” on answers, resources, and generated artifacts to collect them here." />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((it) => (
            <div key={it.id} className="card p-4">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-ink-400">{ICON[it.type]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="chip">{it.type}</span>
                    <span className="font-semibold text-ink-900">{it.title}</span>
                  </div>
                  {it.question && <p className="mt-1 text-xs italic text-ink-400">{it.question}</p>}
                  <div className="prose-answer mt-2 text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(it.content.slice(0, 1200)) }} />
                  {it.resourceId && <Link to={`/knowledge/${it.resourceId}`} className="mt-1 inline-block text-xs text-brand-600 hover:underline">Open resource →</Link>}
                  {it.citations && it.citations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">{it.citations.map((c, i) => <span key={i} className="chip text-[11px]">{c.title}</span>)}</div>
                  )}
                </div>
                <button onClick={() => removeItem(it.id)} className="text-ink-400 hover:text-rose-600"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
