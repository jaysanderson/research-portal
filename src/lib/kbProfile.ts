// Dynamic, KB-tailored copy. The server generates each KB's self-profile once and
// caches it (shared across all users); the client also caches in localStorage for
// an instant per-user revisit. So the first visitor triggers one generation and
// everyone after — on any device — gets it immediately.
import { headersForKb } from './api';

export interface KbProfile {
  subject: string;       // short domain label
  tagline: string;       // hero subtitle
  description: string;   // one-sentence "what you can research here"
  exampleQuestions: string[];
  topics: string[];
}

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — aggressive (client side)
const VERSION = 4; // bumped to flush caches poisoned by the cross-KB HTTP-cache bug
const keyFor = (kbId: string) => `rp_kbprofile_${VERSION}_${kbId}`;
const mem = new Map<string, KbProfile>();

export function readProfileCache(kbId: string): KbProfile | null {
  if (mem.has(kbId)) return mem.get(kbId)!;
  try {
    const raw = localStorage.getItem(keyFor(kbId));
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (!data || Date.now() - ts > TTL_MS) return null;
    mem.set(kbId, data);
    return data;
  } catch { return null; }
}

function writeProfileCache(kbId: string, data: KbProfile) {
  mem.set(kbId, data);
  try { localStorage.setItem(keyFor(kbId), JSON.stringify({ data, ts: Date.now() })); } catch { /* */ }
}

/** Seed the client cache directly (used after the setup wizard writes a profile). */
export function setProfileCache(kbId: string, data: KbProfile) { writeProfileCache(kbId, data); }

export async function generateProfile(kbId: string, opts: { force?: boolean; revalidate?: boolean; signal?: AbortSignal } = {}): Promise<KbProfile> {
  // `revalidate` bypasses the (possibly stale/poisoned) client cache but still uses the
  // server's cached profile (no ?force) — cheap, and self-heals a wrong cache entry.
  if (!opts.force && !opts.revalidate) { const c = readProfileCache(kbId); if (c) return c; }
  // Fetch with headers for THIS specific KB (not the globally-selected one) so the
  // profile can never be for a different box than the one it's cached/displayed under.
  // `cache: 'no-store'` + a per-KB cache-buster defeat any HTTP cache keyed on the URL
  // alone (the KB is in the x-kb header) — otherwise one box's profile leaks to others.
  const qs = new URLSearchParams({ for: kbId });
  if (opts.force) qs.set('force', '1');
  const res = await fetch(`/api/profile?${qs.toString()}`, { headers: headersForKb({ id: kbId }), cache: 'no-store', signal: opts.signal });
  if (!res.ok) throw new Error(`profile -> ${res.status}`);
  const object = await res.json();
  const clean: KbProfile = {
    subject: object.subject || '',
    tagline: object.tagline || '',
    description: object.description || '',
    exampleQuestions: (object.exampleQuestions || []).slice(0, 5),
    topics: (object.topics || []).slice(0, 6),
  };
  writeProfileCache(kbId, clean);
  return clean;
}
