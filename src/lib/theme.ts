// Add-a-theme: turn a free-text request into a plan (AI redescription + sources),
// then discover/verify/ingest resources for it via the streaming server endpoint.
import { askStructured } from './nuclia';
import { streamNdjson, headersForKb } from './api';

export interface ThemePlan {
  theme: string;        // concise label
  summary: string;      // the task, restated back to the user
  scope: string;        // what's in / out of scope
  sources: string[];    // authoritative domains/URLs to retrieve from
  suggestedTopics: string[];
}

const PLAN_SCHEMA = {
  name: 'theme_plan',
  description: 'A plan for adding a new research theme/topic to a knowledge base.',
  parameters: {
    type: 'object',
    properties: {
      theme: { type: 'string', description: 'A concise theme/topic name (2-5 words) to use as the taxonomy label.' },
      summary: { type: 'string', description: 'One or two sentences restating clearly what the user wants to add and what will be retrieved.' },
      scope: { type: 'string', description: 'A short note on what is in scope and what is out of scope.' },
      sources: { type: 'array', items: { type: 'string' }, description: '5-8 authoritative website domains or URLs (homepages or sitemaps) to retrieve real resources from, e.g. https://example.com.' },
      suggestedTopics: { type: 'array', items: { type: 'string' }, description: '2-4 short related topic labels.' },
    },
    required: ['theme', 'summary', 'sources'],
  },
};

export async function planTheme(request: string, opts: { signal?: AbortSignal } = {}): Promise<ThemePlan> {
  const query =
    `A user wants to add a new theme/topic to this research portal so it can retrieve fresh resources about it. ` +
    `Their request: "${request}". Restate the task back clearly, define its scope, and propose authoritative, ` +
    `real websites (domains or sitemap URLs) to retrieve resources from. Prefer official sites, documentation, ` +
    `reputable publications and analysts relevant to the subject.`;
  const { object } = await askStructured<ThemePlan>(query, PLAN_SCHEMA, opts);
  return {
    theme: (object?.theme || request).trim().slice(0, 80),
    summary: (object?.summary || '').trim(),
    scope: (object?.scope || '').trim(),
    sources: (object?.sources || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 8),
    suggestedTopics: (object?.suggestedTopics || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 4),
  };
}

export interface ThemeProgress {
  stage: 'prepare' | 'discover' | 'verify' | 'ingest' | 'done' | 'error';
  message?: string;
  found?: number;
  created?: number;
  total?: number;
  label?: string;
}

export async function* ingestTheme(input: {
  label: string; sources: string[]; count: number; labelset?: string; topics?: string[]; kbId?: string;
}): AsyncGenerator<ThemeProgress> {
  const { kbId, ...body } = input;
  const kbHdrs = kbId ? headersForKb({ id: kbId }) : undefined;
  for await (const o of streamNdjson('/api/theme/ingest', { method: 'POST', body: JSON.stringify(body) }, kbHdrs)) {
    yield o as unknown as ThemeProgress;
  }
}
