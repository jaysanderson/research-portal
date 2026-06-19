// Integration management (Perplexity live-web source discovery for Add-a-theme).
// The key is stored server-side (Fly volume) and never returned to the browser.
export interface PerplexityStatus {
  configured: boolean;
  source: 'app' | 'env' | null;
  model: string;
}

export async function getIntegrations(): Promise<{ perplexity: PerplexityStatus }> {
  const r = await fetch('/api/integrations');
  if (!r.ok) throw new Error(`integrations -> ${r.status}`);
  return r.json();
}

export async function savePerplexity(key: string, model?: string): Promise<PerplexityStatus> {
  const r = await fetch('/api/integrations/perplexity', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, model }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || `Could not save the key (${r.status}).`);
  return d.perplexity;
}

export async function testPerplexity(): Promise<{ ok: boolean; detail?: string }> {
  const r = await fetch('/api/integrations/perplexity/test', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  return r.json();
}

export async function removePerplexity(): Promise<PerplexityStatus> {
  const r = await fetch('/api/integrations/perplexity', { method: 'DELETE' });
  const d = await r.json().catch(() => ({}));
  return d.perplexity;
}
