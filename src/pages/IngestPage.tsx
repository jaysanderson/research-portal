import { useCallback, useRef, useState } from 'react';
import { Upload, Link2, FileText, CheckCircle2, AlertCircle, Loader2, Globe, Search, Sparkles, ChevronRight } from 'lucide-react';
import { createLinkResource, createTextResource, uploadFile, crawlSite, type Classification } from '../lib/nuclia';
import { RecentResources } from '../components/ingest/RecentResources';
import { AddThemeModal } from '../components/AddThemeModal';
import { PageHeader } from '../components/PageHeader';

type Tab = 'upload' | 'link' | 'text' | 'crawl';

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
  const [themeOpen, setThemeOpen] = useState(false);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
      <PageHeader title="Add content" description="Upload files, paste text, or add links. Everything is indexed and searchable once processed." />

      <button onClick={() => setThemeOpen(true)}
        className="group mb-5 flex w-full items-center gap-3 rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50/80 to-white p-4 text-left transition-colors hover:border-brand-300">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700"><Sparkles size={18} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink-900">Add a theme</span>
          <span className="block text-sm text-ink-500">Describe a topic to cover — the portal restates it, then retrieves fresh resources to seed it.</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5" />
      </button>

      <AddThemeModal open={themeOpen} onClose={() => setThemeOpen(false)} onAdded={bump} />

      <div className="flex gap-1 rounded-lg border border-ink-200 bg-white p-1">
        <TabBtn active={tab === 'upload'} onClick={() => setTab('upload')} icon={<Upload size={16} />} label="Upload files" />
        <TabBtn active={tab === 'link'} onClick={() => setTab('link')} icon={<Link2 size={16} />} label="Add links" />
        <TabBtn active={tab === 'text'} onClick={() => setTab('text')} icon={<FileText size={16} />} label="Paste text" />
        <TabBtn active={tab === 'crawl'} onClick={() => setTab('crawl')} icon={<Globe size={16} />} label="Crawl site" />
      </div>

      <div className="mt-4">
        {tab === 'upload' && <UploadPanel onChange={bump} />}
        {tab === 'link' && <LinkPanel onChange={bump} />}
        {tab === 'text' && <TextPanel onChange={bump} />}
        {tab === 'crawl' && <CrawlPanel onChange={bump} />}
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
        <span className="text-xs font-semibold text-ink-500">Primary label (optional)</span>
        <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. a source, author, or category"
          className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-ink-500">Topics (comma-separated)</span>
        <input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="comma-separated topics"
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

function CrawlPanel({ onChange }: { onChange: () => void }) {
  const [url, setUrl] = useState('');
  const [vendor, setVendor] = useState('');
  const [topics, setTopics] = useState('');
  const [links, setLinks] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const discover = async () => {
    if (!/^https?:\/\//.test(url.trim())) { setMsg('Enter a valid http(s) URL or sitemap.'); return; }
    setBusy(true); setMsg(null); setLinks([]);
    try {
      const { links } = await crawlSite(url.trim(), 60);
      setLinks(links);
      setSelected(new Set(links));
      setMsg(links.length ? `Found ${links.length} link(s). Review and ingest.` : 'No links found.');
    } catch (err) { setMsg(`Crawl failed: ${String(err).slice(0, 120)}`); }
    setBusy(false);
  };

  const toggle = (l: string) => setSelected((s) => { const n = new Set(s); n.has(l) ? n.delete(l) : n.add(l); return n; });

  const ingest = async () => {
    const list = links.filter((l) => selected.has(l));
    if (!list.length) return;
    setAdding(true); setMsg(null);
    const labels = buildLabels(vendor, topics);
    let ok = 0;
    for (const u of list) { try { await createLinkResource({ url: u, labels }); ok++; } catch { /* */ } }
    setAdding(false); setLinks([]); setSelected(new Set()); setMsg(`Ingested ${ok} of ${list.length} link(s). Indexing now…`); onChange();
  };

  return (
    <div className="card p-5">
      <label className="block">
        <span className="text-sm font-semibold text-ink-700">Website or sitemap URL</span>
        <div className="mt-1 flex gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.example.com/sitemap.xml"
            className="flex-1 rounded-lg border border-ink-200 px-3 py-2 font-mono text-sm outline-none focus:border-brand-400" />
          <button onClick={discover} disabled={busy} className="btn-primary whitespace-nowrap">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Discover
          </button>
        </div>
      </label>
      <p className="mt-1 text-xs text-ink-400">Discovers same-domain pages (or sitemap entries). Review the list, then ingest the ones you want.</p>

      {links.length > 0 && (
        <>
          <div className="mt-4 flex items-center justify-between text-xs text-ink-500">
            <span>{selected.size} of {links.length} selected</span>
            <div className="flex gap-2">
              <button className="hover:text-brand-600" onClick={() => setSelected(new Set(links))}>All</button>
              <button className="hover:text-brand-600" onClick={() => setSelected(new Set())}>None</button>
            </div>
          </div>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-ink-100 p-2">
            {links.map((l) => (
              <li key={l} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.has(l)} onChange={() => toggle(l)} className="accent-brand-600" />
                <span className="truncate text-ink-600">{l}</span>
              </li>
            ))}
          </ul>
          <LabelInputs vendor={vendor} setVendor={setVendor} topics={topics} setTopics={setTopics} />
          <button onClick={ingest} disabled={adding || selected.size === 0} className="btn-primary mt-4">
            {adding ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />} Ingest {selected.size} link(s)
          </button>
        </>
      )}
      {msg && <p className="mt-3 text-sm text-ink-500">{msg}</p>}
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
