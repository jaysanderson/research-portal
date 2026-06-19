// KB setup wizard: from a plain-language description, design the taxonomy
// (labelsets) and the tailored generator copy (KB profile). The knowledge graph
// is derived from the taxonomy, so creating labelsets sets the graph up too.
import { streamNdjson, headersForKb } from './api';
import { setProfileCache } from './kbProfile';

export interface SetupLabelset { id: string; title: string; multiple: boolean; labels: string[] }
export interface KbSetupPlan {
  subject: string;
  tagline: string;
  description: string;
  exampleQuestions: string[];
  topics: string[];
  labelsets: SetupLabelset[];
  graphPrimary?: string;
  graphSecondary?: string;
}

const SETUP_SCHEMA = {
  name: 'kb_setup',
  description: 'A setup plan for a new research knowledge base, derived from a subject description.',
  parameters: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: '2-4 word domain label.' },
      tagline: { type: 'string', description: 'One short hero subtitle (max ~12 words).' },
      description: { type: 'string', description: 'One sentence describing what can be researched here.' },
      exampleQuestions: { type: 'array', items: { type: 'string' }, description: 'Five specific, answerable example questions.' },
      topics: { type: 'array', items: { type: 'string' }, description: 'Six short topic labels (1-3 words).' },
      labelsets: {
        type: 'array',
        description: '2-3 classification labelsets to organise resources in this domain.',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Human label name, e.g. "Vendor" or "Topic".' },
            multiple: { type: 'boolean', description: 'Whether a resource can have several values from this set.' },
            labels: { type: 'array', items: { type: 'string' }, description: '4-8 example values for this labelset.' },
          },
          required: ['title', 'labels'],
        },
      },
      graphPrimary: { type: 'string', description: 'Title of the labelset that makes the best primary graph axis.' },
      graphSecondary: { type: 'string', description: 'Title of the labelset that makes the best secondary graph axis.' },
    },
    required: ['subject', 'tagline', 'description', 'topics', 'labelsets'],
  },
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'label';

export async function planKbSetup(description: string, kbId: string, opts: { signal?: AbortSignal } = {}): Promise<KbSetupPlan> {
  const query =
    `Design the setup for a research Knowledge Box about: "${description}". Propose a clear subject, a tagline, a ` +
    `one-sentence description, 5 example questions, 6 topics, and 2-3 classification labelsets (each with a title, ` +
    `whether multiple values are allowed, and 4-8 example label values) well suited to organising resources in this ` +
    `domain. Also pick which two labelsets make the best knowledge-graph axes.`;
  const body: any = { query, features: ['keyword', 'semantic'], answer_json_schema: SETUP_SCHEMA, show: ['basic'], max_tokens: 4096 };
  let object: any = null;
  for await (const o of streamNdjson('/api/kb/ask', { method: 'POST', body: JSON.stringify(body), signal: opts.signal }, headersForKb({ id: kbId }))) {
    const item: any = (o as any).item || o;
    if (item.type === 'answer_json' && item.object) object = item.object;
  }
  object = object || {};
  const labelsets: SetupLabelset[] = (object.labelsets || []).slice(0, 4).map((l: any) => ({
    id: slug(l.title || ''), title: (l.title || '').trim() || 'Label',
    multiple: l.multiple !== false, labels: (l.labels || []).map((x: any) => String(x).trim()).filter(Boolean).slice(0, 10),
  })).filter((l: SetupLabelset) => l.title);
  return {
    subject: (object.subject || description).trim().slice(0, 80),
    tagline: (object.tagline || '').trim(),
    description: (object.description || '').trim(),
    exampleQuestions: (object.exampleQuestions || []).map((s: any) => String(s).trim()).filter(Boolean).slice(0, 5),
    topics: (object.topics || []).map((s: any) => String(s).trim()).filter(Boolean).slice(0, 6),
    labelsets,
    graphPrimary: object.graphPrimary, graphSecondary: object.graphSecondary,
  };
}

const COLORS = ['#6b4cff', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];

export interface SetupProgress { stage: 'labels' | 'profile' | 'done' | 'error'; message: string }

export async function applyKbSetup(plan: KbSetupPlan, kbId: string, onProgress?: (p: SetupProgress) => void): Promise<void> {
  const hdrs = headersForKb({ id: kbId });
  // 1. Taxonomy (labelsets) — seed example values so the graph + filters work at once.
  for (let i = 0; i < plan.labelsets.length; i++) {
    const ls = plan.labelsets[i];
    onProgress?.({ stage: 'labels', message: `Creating taxonomy: ${ls.title}…` });
    const res = await fetch(`/api/kb/labelset/${encodeURIComponent(ls.id)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...hdrs },
      body: JSON.stringify({ title: ls.title, color: COLORS[i % COLORS.length], multiple: ls.multiple, kind: ['RESOURCES'], labels: ls.labels.map((t) => ({ title: t })) }),
    });
    if (!res.ok) throw new Error(`Could not create taxonomy "${ls.title}" (${res.status}).`);
  }
  // 2. Generator / tailored copy (KB profile) — stored server-side + client cache.
  onProgress?.({ stage: 'profile', message: 'Tailoring copy and generator…' });
  const profile = { subject: plan.subject, tagline: plan.tagline, description: plan.description, exampleQuestions: plan.exampleQuestions, topics: plan.topics };
  const pr = await fetch('/api/profile/set', { method: 'POST', headers: { 'Content-Type': 'application/json', ...hdrs }, body: JSON.stringify(profile) });
  if (!pr.ok) throw new Error(`Could not save the profile (${pr.status}).`);
  setProfileCache(kbId, profile);
  onProgress?.({ stage: 'done', message: 'Knowledge Box set up.' });
}
