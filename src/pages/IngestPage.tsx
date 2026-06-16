import { useCallback, useRef, useState } from 'react';
import { Upload, Link2, FileText, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { createLinkResource, createTextResource, uploadFile, type Classification } from '../lib/nuclia';
import { RecentResources } from '../components/ingest/RecentResources';

type Tab = 'upload' | 'link' | 'text';

interface UploadItem { id: string; name: string; state: 'uploading' | 'done' | 'error'; msg?: string }

function buildLabels(vendor: string, topics: string): Classification[] {
  const out: Classification[] = [];
  if (vendor.trim()) out.push({ labelset: 'vendor', label: vendor.trim() });
  topics.split(',').map((t) => t.trim()).filter(Boolean).forEach((t) => out.push({ labelset: 'topic', label: t }));
  return out;
}

export default function IngestPage() {
  const [tab, setTab] = useState<Tab>('upload');
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Add content</h1>
      <p className="mt-1 text-ink-500">Upload files, paste text, or add links. Everything is indexed and searchable once processed.</p>

      <div className="mt-6 flex gap-1 rounded-lg border border-ink-200 bg-white p-1">
        <TabBtn active={tab === 'upload'} onClick={() => setTab('upload')} icon={<Upload size={16} />} label="Upload files" />
        <TabBtn active={tab === 'link'} onClick={() => setTab('link')} icon={<Link2 size={16} />} label="Add links" />
        <TabBtn active={tab === 'text'} onClick={() => setTab('text')} icon={<FileText size={16} />} label="Paste text" />
      </div>

      <div className="mt-4">
        {tab === 'upload' && <UploadPanel onChange={bump} />}
        {tab === 'link' && <LinkPanel onChange={bump} />}
        {tab === 'text' && <TextPanel onChange={bump} />}
      </div>

      <div className="mt-8">
        <RecentResources refreshKey={refreshKey} />
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-100'}`}>
      {icon}{label}
    </button>
  );
}

function LabelInputs({ vendor, setVendor, topics, setTopics }: {
  vendor: string; setVendor: (s: string) => void; topics: string; setTopics: (s: string) => void;
}) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="text-xs font-semibold text-ink-500">Vendor (optional)</span>
        <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Progress Sitefinity"
          className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-ink-500">Topics (comma-separated)</span>
        <input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="DXP, Headless CMS"
          className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
      </label>
    </div>
  );
}

function UploadPanel({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [drag, setDrag] = useState(false);
  const [vendor, setVendor] = useState('');
  const [topics, setTopics] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const labels = buildLabels(vendor, topics);
    for (const file of Array.from(files)) {
      const id = `${file.name}-${Math.random().toString(36).slice(2)}`;
      setItems((x) => [{ id, name: file.name, state: 'uploading' }, ...x]);
      try {
        await uploadFile(file, { labels });
        setItems((x) => x.map((i) => (i.id === id ? { ...i, state: 'done' } : i)));
        onChange();
      } catch (err) {
        setItems((x) => x.map((i) => (i.id === id ? { ...i, state: 'error', msg: String(err).slice(0, 80) } : i)));
      }
    }
  }, [vendor, topics, onChange]);

  return (
    <div className="card p-5">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          drag ? 'border-brand-400 bg-brand-50' : 'border-ink-200 hover:border-brand-300 hover:bg-ink-50'}`}>
        <Upload size={28} className="text-brand-500" />
        <p className="mt-3 font-semibold text-ink-800">Drop files here or click to browse</p>
        <p className="mt-1 text-sm text-ink-400">PDF, Word, PowerPoint, text, images, audio, video</p>
        <input ref={inputRef} type="file" multiple className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      </div>
      <LabelInputs vendor={vendor} setVendor={setVendor} topics={topics} setTopics={setTopics} />
      {items.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-sm">
              {i.state === 'uploading' && <Loader2 size={15} className="animate-spin text-brand-500" />}
              {i.state === 'done' && <CheckCircle2 size={15} className="text-emerald-500" />}
              {i.state === 'error' && <AlertCircle size={15} className="text-rose-500" />}
              <span className="truncate text-ink-700">{i.name}</span>
              {i.msg && <span className="ml-auto truncate text-xs text-rose-500">{i.msg}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LinkPanel({ onChange }: { onChange: () => void }) {
  const [urls, setUrls] = useState('');
  const [vendor, setVendor] = useState('');
  const [topics, setTopics] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const submit = async () => {
    const list = urls.split('\n').map((u) => u.trim()).filter((u) => /^https?:\/\//.test(u));
    if (!list.length) { setResult('Enter at least one valid http(s) URL.'); return; }
    setBusy(true); setResult(null);
    const labels = buildLabels(vendor, topics);
    let ok = 0;
    for (const url of list) {
      try { await createLinkResource({ url, labels }); ok++; } catch { /* count */ }
    }
    setBusy(false); setUrls(''); setResult(`Added ${ok} of ${list.length} link(s). Indexing now…`); onChange();
  };

  return (
    <div className="card p-5">
      <label className="block">
        <span className="text-sm font-semibold text-ink-700">URLs (one per line)</span>
        <textarea value={urls} onChange={(e) => setUrls(e.target.value)} rows={5}
          placeholder={'https://www.progress.com/sitefinity-cms\nhttps://en.wikipedia.org/wiki/Sitecore'}
          className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 font-mono text-sm outline-none focus:border-brand-400" />
      </label>
      <LabelInputs vendor={vendor} setVendor={setVendor} topics={topics} setTopics={setTopics} />
      <div className="mt-4 flex items-center gap-3">
        <button onClick={submit} disabled={busy} className="btn-primary">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />} Add links
        </button>
        {result && <span className="text-sm text-ink-500">{result}</span>}
      </div>
    </div>
  );
}

function TextPanel({ onChange }: { onChange: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [vendor, setVendor] = useState('');
  const [topics, setTopics] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const submit = async () => {
    if (!body.trim()) { setResult('Enter some text.'); return; }
    setBusy(true); setResult(null);
    try {
      await createTextResource({ title: title || 'Untitled note', body, format: 'MARKDOWN', labels: buildLabels(vendor, topics) });
      setTitle(''); setBody(''); setResult('Added. Indexing now…'); onChange();
    } catch (err) { setResult(`Failed: ${String(err).slice(0, 100)}`); }
    setBusy(false);
  };

  return (
    <div className="card p-5">
      <label className="block">
        <span className="text-sm font-semibold text-ink-700">Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title"
          className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
      </label>
      <label className="mt-3 block">
        <span className="text-sm font-semibold text-ink-700">Content (Markdown supported)</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8}
          placeholder="Paste or write content to add to the Knowledge Box…"
          className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
      </label>
      <LabelInputs vendor={vendor} setVendor={setVendor} topics={topics} setTopics={setTopics} />
      <div className="mt-4 flex items-center gap-3">
        <button onClick={submit} disabled={busy} className="btn-primary">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} Add text
        </button>
        {result && <span className="text-sm text-ink-500">{result}</span>}
      </div>
    </div>
  );
}
