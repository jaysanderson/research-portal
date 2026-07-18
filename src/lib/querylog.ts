import { getSelectedKbId } from './api';

// Lightweight, per-KB query log (this device) — powers Search insights in Analytics:
// top queries and, most valuably, zero-result queries (content-gap signal).
export interface QLogEntry { q: string; results: number; ts: number }
const key = () => `rp_qlog_${getSelectedKbId() || 'default'}`;

export function logQuery(q: string, results: number) {
  const query = q.trim();
  if (!query) return;
  try {
    const all: QLogEntry[] = JSON.parse(localStorage.getItem(key()) || '[]');
    all.unshift({ q: query, results, ts: Date.now() });
    localStorage.setItem(key(), JSON.stringify(all.slice(0, 250)));
  } catch { /* */ }
}

export function loadQueries(): QLogEntry[] {
  try { return JSON.parse(localStorage.getItem(key()) || '[]'); } catch { return []; }
}

/** Aggregate a term → {count, results} rollup, most-frequent first. */
export function topQueries(entries: QLogEntry[]): { q: string; count: number; results: number }[] {
  const m = new Map<string, { count: number; results: number }>();
  for (const e of entries) {
    const k = e.q.toLowerCase();
    const cur = m.get(k) || { count: 0, results: e.results };
    cur.count += 1; cur.results = e.results;
    m.set(k, cur);
  }
  return [...m.entries()].map(([q, v]) => ({ q, ...v })).sort((a, b) => b.count - a.count);
}
