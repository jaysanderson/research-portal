// Dynamic, KB-tailored copy. We ask the Knowledge Box to describe itself once,
// then cache aggressively per-KB in localStorage so the app instantly reads as
// bespoke to whatever subject is loaded (CMS/DXP, agri R&D, anything).
import { askStructured } from './nuclia';

export interface KbProfile {
  subject: string;       // short domain label
  tagline: string;       // hero subtitle
  description: string;   // one-sentence "what you can research here"
  exampleQuestions: string[];
  topics: string[];
}

const PROFILE_SCHEMA = {
  name: 'kb_profile',
  description: 'A profile of this knowledge base used to tailor a research portal UI.',
  parameters: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: 'A 2–4 word domain label for this corpus, e.g. "CMS & Digital Experience".' },
      tagline: { type: 'string', description: 'One short sentence (max ~12 words) for a hero subtitle.' },
      description: { type: 'string', description: 'One sentence describing what a user can research here.' },
      exampleQuestions: { type: 'array', items: { type: 'string' }, description: 'Five specific, answerable questions grounded in this knowledge base.' },
      topics: { type: 'array', items: { type: 'string' }, description: 'Six short topic labels (1–3 words) a user might search.' },
    },
    required: ['subject', 'tagline', 'description', 'exampleQuestions', 'topics'],
  },
};

const PROFILE_QUERY =
  'Profile this knowledge base for a research portal. Identify its overall subject domain, ' +
  'a concise tagline, a one-sentence description of what can be researched here, five specific ' +
  'example questions it can answer, and six key topics users might explore.';

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — aggressive
const VERSION = 1;
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

export async function generateProfile(kbId: string, opts: { force?: boolean; signal?: AbortSignal } = {}): Promise<KbProfile> {
  if (!opts.force) { const c = readProfileCache(kbId); if (c) return c; }
  const { object } = await askStructured<KbProfile>(PROFILE_QUERY, PROFILE_SCHEMA, { signal: opts.signal });
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
