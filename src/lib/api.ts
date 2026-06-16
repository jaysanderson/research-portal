// Thin wrappers around the server proxy. The browser never sees a Nuclia key.

export interface KbInfo {
  id: string;
  name: string;
  kbId: string;
  zone: string | null;
  connected: boolean;
  aragConfigured: boolean;
}

export interface PortalConfig {
  generativeModel: string | null;
  kbs: KbInfo[];
}

let _config: PortalConfig | null = null;

// ---- Selected Knowledge Box (persisted) ----
const KB_KEY = 'rp_kb';
let _selectedKbId: string = (typeof localStorage !== 'undefined' && localStorage.getItem(KB_KEY)) || '';

export function getSelectedKbId(): string { return _selectedKbId; }
export function setSelectedKbId(id: string) {
  _selectedKbId = id;
  try { localStorage.setItem(KB_KEY, id); } catch { /* */ }
  window.dispatchEvent(new Event('rp-kb-change'));
}
/** Header that tells the proxy which KB to route to. */
export function kbHeaders(): Record<string, string> {
  return _selectedKbId ? { 'x-kb': _selectedKbId } : {};
}

export async function getConfig(force = false): Promise<PortalConfig> {
  if (_config && !force) return _config;
  const res = await fetch('/api/config');
  _config = await res.json();
  // If nothing selected yet (or selection no longer exists), default to first connected.
  const ids = new Set((_config!.kbs || []).map((k) => k.id));
  if (!_selectedKbId || !ids.has(_selectedKbId)) {
    const first = (_config!.kbs || []).find((k) => k.connected) || _config!.kbs?.[0];
    if (first) _selectedKbId = first.id;
  }
  return _config!;
}

export function currentKb(config: PortalConfig | null): KbInfo | null {
  if (!config?.kbs?.length) return null;
  return config.kbs.find((k) => k.id === _selectedKbId) || config.kbs.find((k) => k.connected) || config.kbs[0];
}

/** KB JSON request through the proxy. */
export async function kb<T = unknown>(
  path: string,
  init: RequestInit & { query?: Record<string, string | number | (string | number)[]> } = {}
): Promise<T> {
  const { query, ...rest } = init;
  let url = `/api/kb/${path.replace(/^\/+/, '')}`;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (Array.isArray(v)) v.forEach((x) => qs.append(k, String(x)));
      else qs.append(k, String(v));
    }
    url += `?${qs.toString()}`;
  }
  const res = await fetch(url, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...kbHeaders(), ...(rest.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`KB ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  const ct = res.headers.get('content-type') || '';
  return (ct.includes('application/json') ? res.json() : res.text()) as Promise<T>;
}

/** Streaming NDJSON request (used by /ask and /agent). Yields parsed objects. */
export async function* streamNdjson(
  url: string,
  init: RequestInit
): AsyncGenerator<Record<string, unknown>> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson', ...kbHeaders(), ...(init.headers || {}) },
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`stream ${url} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      let line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      if (line.startsWith('data:')) line = line.slice(5).trim();
      try { yield JSON.parse(line); } catch { /* skip malformed */ }
    }
  }
  const tail = buffer.trim();
  if (tail) { try { yield JSON.parse(tail.startsWith('data:') ? tail.slice(5) : tail); } catch { /* */ } }
}
