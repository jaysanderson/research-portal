// Research workspace — saved findings, notes, and citation export.
// localStorage-backed for the demo; swap for Supabase (RLS, per-user) in production.
import type { Citation } from './nuclia';
import { getSelectedKbId } from './api';

export type ItemType = 'note' | 'answer' | 'resource' | 'artifact';

export interface WorkspaceItem {
  id: string;
  type: ItemType;
  title: string;
  content: string;        // markdown / text
  question?: string;
  url?: string;
  resourceId?: string;
  citations?: Citation[];
  createdAt: number;
  kbId?: string;          // which Knowledge Box this was saved from
}

const KEY = 'rp_workspace';

export function loadWorkspace(): WorkspaceItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function persist(items: WorkspaceItem[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* quota/full — still notify so the UI reflects in-memory intent */ }
  window.dispatchEvent(new Event('workspace-change'));
}

export function addItem(item: Omit<WorkspaceItem, 'id' | 'createdAt'>): WorkspaceItem {
  const full: WorkspaceItem = { ...item, kbId: item.kbId || getSelectedKbId() || undefined, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, createdAt: Date.now() };
  const all = loadWorkspace(); all.unshift(full); persist(all); return full;
}
/** Items saved from a specific KB (legacy items with no kbId are treated as unscoped). */
export function loadWorkspaceFor(kbId: string | undefined): WorkspaceItem[] {
  return loadWorkspace().filter((i) => i.kbId === kbId);
}
export function removeItem(id: string) { persist(loadWorkspace().filter((i) => i.id !== id)); }
export function clearWorkspace() { persist([]); }
export function workspaceCount() { return loadWorkspace().length; }

// ---- exports ----
export function toMarkdown(items: WorkspaceItem[], title = 'Research Report'): string {
  const lines = [`# ${title}`, '', `_Generated ${new Date().toISOString().slice(0, 10)} · ${items.length} items_`, ''];
  const allCites: Citation[] = [];
  items.slice().reverse().forEach((it, i) => {
    lines.push(`## ${i + 1}. ${it.title}`);
    if (it.question) lines.push(`> ${it.question}`, '');
    lines.push(it.content, '');
    if (it.url) lines.push(`Source: ${it.url}`, '');
    (it.citations || []).forEach((c) => { if (!allCites.find((x) => x.resourceId === c.resourceId)) allCites.push(c); });
  });
  if (allCites.length) {
    lines.push('## References', '');
    allCites.forEach((c, i) => lines.push(`${i + 1}. ${c.title}${c.url ? ` — ${c.url}` : ''}`));
  }
  return lines.join('\n');
}

export function toBibtex(items: WorkspaceItem[]): string {
  const cites: Citation[] = [];
  items.forEach((it) => (it.citations || []).forEach((c) => { if (c.url && !cites.find((x) => x.url === c.url)) cites.push(c); }));
  if (!cites.length) return '% No cited sources with URLs in the workspace.';
  return cites.map((c, i) => {
    const key = `source${i + 1}`;
    const year = new Date().getFullYear();
    return `@misc{${key},\n  title = {${c.title.replace(/[{}]/g, '')}},\n  howpublished = {\\url{${c.url}}},\n  year = {${year}}\n}`;
  }).join('\n\n');
}

export function toCsv(items: WorkspaceItem[]): string {
  const rows = [['type', 'title', 'question', 'url', 'created']];
  items.forEach((it) => rows.push([it.type, it.title, it.question || '', it.url || '', new Date(it.createdAt).toISOString()]));
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function download(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
