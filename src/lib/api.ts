// Thin wrappers around the server proxy. Pre-configured (env) KB keys stay
// server-side. User-added KBs are "bring your own key": stored in this browser
// and sent per-request to the proxy (which only forwards to Progress/Nuclia hosts).

export interface KbInfo {
  id: string;
  name: string;
  kbId: string;
  zone: string | null;
  connected: boolean;
  aragConfigured: boolean;
  source: 'env' | 'local';
  disconnected?: boolean; // built-in box removed from the portal (server-side), restorable
}

export interface PortalConfig {
  generativeModel: string | null;
  themePlanner?: 'perplexity' | 'kb'; // source of Add-a-theme source discovery
  kbs: KbInfo[]; // env-configured only
}

export interface LocalKb {
  id: string;
  name: string;
  url: string;
  key: string;
  aragBase?: string;
  aragAgent?: string;
  aragKey?: string;
}

let _config: PortalConfig | null = null;

// ---- User-added KBs (localStorage) ----
const LOCAL_KEY = 'rp_local_kbs';
export function getLocalKbs(): LocalKb[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
}
function persistLocal(list: LocalKb[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('rp-kb-change'));
}
export function addLocalKb(kb: Omit<LocalKb, 'id'>): LocalKb {
  const full: LocalKb = { ...kb, id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` };
  persistLocal([...getLocalKbs(), full]);
  return full;
}
export function updateLocalKb(id: string, patch: Partial<Omit<LocalKb, 'id'>>) {
  persistLocal(getLocalKbs().map((k) => (k.id === id ? { ...k, ...patch } : k)));
}
export function removeLocalKb(id: string) {
  persistLocal(getLocalKbs().filter((k) => k.id !== id));
  if (_selectedKbId === id) setSelectedKbId('');
}
/** Headers that route a request to a specific KB (built-in id, or local BYO-key). */
export function headersForKb(kb: { id: string } | LocalKb): Record<string, string> {
  const local = getLocalKbs().find((k) => k.id === kb.id);
  if (local) {
    return { 'x-kb-url': local.url, 'x-kb-key': local.key, ...agentHeaders({ aragBase: local.aragBase || '', aragAgent: local.aragAgent || '', aragKey: local.aragKey || '' }) };
  }
  return { 'x-kb': kb.id, ...agentHeaders(getAgentOverride(kb.id)) };
}
// ---- Retrieval Agent overrides: attach/override an agent on any KB (esp. built-in) ----
export interface AgentCfg { aragBase: string; aragAgent: string; aragKey: string }
const AGENT_KEY = 'rp_agent_overrides';
function getAgentOverrides(): Record<string, AgentCfg> {
  try { return JSON.parse(localStorage.getItem(AGENT_KEY) || '{}'); } catch { return {}; }
}
export function getAgentOverride(kbId: string): AgentCfg | undefined { return getAgentOverrides()[kbId]; }
export function setAgentOverride(kbId: string, cfg: AgentCfg) {
  const all = getAgentOverrides(); all[kbId] = cfg;
  localStorage.setItem(AGENT_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event('rp-kb-change'));
}
export function removeAgentOverride(kbId: string) {
  const all = getAgentOverrides(); delete all[kbId];
  localStorage.setItem(AGENT_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event('rp-kb-change'));
}
function agentHeaders(cfg?: AgentCfg): Record<string, string> {
  if (!cfg?.aragBase || !cfg.aragAgent || !cfg.aragKey) return {};
  return { 'x-kb-arag-url': cfg.aragBase, 'x-kb-arag-agent': cfg.aragAgent, 'x-kb-arag-key': cfg.aragKey };
}

function localToInfo(k: LocalKb): KbInfo {
  let zone: string | null = null;
  let kbId = k.id;
  try { zone = new URL(k.url).host; kbId = k.url.split('/').pop() || k.id; } catch { /* */ }
  return { id: k.id, name: k.name, kbId, zone, connected: true, aragConfigured: !!(k.aragBase && k.aragAgent && k.aragKey), source: 'local' };
}

// ---- Selected Knowledge Box ----
const KB_KEY = 'rp_kb';
let _selectedKbId: string = (typeof localStorage !== 'undefined' && localStorage.getItem(KB_KEY)) || '';

export function getSelectedKbId(): string { return _selectedKbId; }
export function setSelectedKbId(id: string) {
  _selectedKbId = id;
  try { localStorage.setItem(KB_KEY, id); } catch { /* */ }
  window.dispatchEvent(new Event('rp-kb-change'));
}

function allKbs(config: PortalConfig | null): KbInfo[] {
  const env = (config?.kbs || []).map((k) => ({ ...k, source: 'env' as const, aragConfigured: k.aragConfigured || !!getAgentOverride(k.id) }));
  return [...env, ...getLocalKbs().map(localToInfo)];
}

/** Active KBs: env (from server) + local (this browser), minus disconnected built-ins. */
export function mergedKbs(config: PortalConfig | null): KbInfo[] {
  return allKbs(config).filter((k) => !k.disconnected);
}

/** Built-in boxes disconnected from the portal — surfaced so they can be reconnected. */
export function disconnectedKbs(config: PortalConfig | null): KbInfo[] {
  return allKbs(config).filter((k) => k.disconnected);
}

/** Remove a built-in box from the portal for everyone (server-side, reversible). */
export async function disconnectKb(id: string): Promise<void> {
  const res = await fetch(`/api/admin/kb/${encodeURIComponent(id)}/disconnect`, { method: 'POST' });
  if (!res.ok) throw new Error(`disconnect ${id} -> ${res.status}`);
  if (_selectedKbId === id) setSelectedKbId('');
  await getConfig(true);
  window.dispatchEvent(new Event('rp-kb-change'));
}
/** Restore a previously disconnected built-in box. */
export async function reconnectKb(id: string): Promise<void> {
  const res = await fetch(`/api/admin/kb/${encodeURIComponent(id)}/reconnect`, { method: 'POST' });
  if (!res.ok) throw new Error(`reconnect ${id} -> ${res.status}`);
  await getConfig(true);
  window.dispatchEvent(new Event('rp-kb-change'));
}

/** Headers telling the proxy which KB to use. Local KBs send their own url+key. */
export function kbHeaders(): Record<string, string> {
  const local = getLocalKbs().find((k) => k.id === _selectedKbId);
  if (local) {
    return { 'x-kb-url': local.url, 'x-kb-key': local.key, ...agentHeaders({ aragBase: local.aragBase || '', aragAgent: local.aragAgent || '', aragKey: local.aragKey || '' }) };
  }
  if (!_selectedKbId) return {};
  // Built-in KB: include a client agent override if one was attached in the UI.
  return { 'x-kb': _selectedKbId, ...agentHeaders(getAgentOverride(_selectedKbId)) };
}

let _configInflight: Promise<PortalConfig> | null = null;
export async function getConfig(force = false): Promise<PortalConfig> {
  if (_config && !force) return _config;
  // Dedupe concurrent first-load calls (several components mount at once) into one fetch.
  if (_configInflight && !force) return _configInflight;
  _configInflight = (async () => {
    const res = await fetch('/api/config');
    _config = await res.json();
    const ids = new Set(mergedKbs(_config).map((k) => k.id));
    if (!_selectedKbId || !ids.has(_selectedKbId)) {
      const all = mergedKbs(_config);
      const first = all.find((k) => k.connected) || all[0];
      if (first) _selectedKbId = first.id;
    }
    return _config!;
  })().finally(() => { _configInflight = null; });
  return _configInflight;
}

export function currentKb(config: PortalConfig | null): KbInfo | null {
  const all = mergedKbs(config);
  if (!all.length) return null;
  return all.find((k) => k.id === _selectedKbId) || all.find((k) => k.connected) || all[0];
}

/** Probe a KB's reachability. Pass either {url,key} (ad-hoc) or a routing header set. */
export async function probeKb(arg: string | Record<string, string>, key?: string): Promise<{ ok: boolean; resources?: number; error?: string }> {
  const headers = typeof arg === 'string' ? { 'x-kb-url': arg, 'x-kb-key': key || '' } : arg;
  try {
    const res = await fetch('/api/kb/counters', { headers });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      if (res.status === 401 || res.status === 403 || /jwt|decod|signature|token|unauthor|forbidden/i.test(body)) {
        return { ok: false, error: 'The API key was not accepted for this endpoint. Check it’s the full service-account key (no “Bearer” prefix or quotes), and that the endpoint region matches the key.' };
      }
      if (res.status === 404) return { ok: false, error: 'Endpoint not found — check the URL ends with /api/v1/kb/<kb-id>.' };
      return { ok: false, error: `Could not reach this Knowledge Box (${res.status}).` };
    }
    const d = await res.json();
    return { ok: true, resources: d.resources };
  } catch (e) { return { ok: false, error: String(e).slice(0, 160) }; }
}

/** Probe a Retrieval Agent: confirm it streams (reads the first event, then aborts). */
export async function probeAgent(headers: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  let gotData = false;
  try {
    const res = await fetch('/api/agent/session/ephemeral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson', ...headers },
      body: JSON.stringify({ question: 'ping' }),
      signal: ctrl.signal,
    });
    if (!res.ok) { clearTimeout(timer); return { ok: false, error: `${res.status}: ${(await res.text()).slice(0, 140)}` }; }
    const reader = res.body?.getReader();
    if (reader) { await reader.read(); gotData = true; }
    clearTimeout(timer); ctrl.abort();
    return { ok: true };
  } catch (e) { clearTimeout(timer); return gotData ? { ok: true } : { ok: false, error: String(e).slice(0, 140) }; }
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

/** Streaming NDJSON request (used by /ask and /agent). Pass kbHdrs to route to a
 *  specific KB instead of the currently-selected one. */
export async function* streamNdjson(url: string, init: RequestInit, kbHdrs?: Record<string, string>): AsyncGenerator<Record<string, unknown>> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson', ...(kbHdrs ?? kbHeaders()), ...(init.headers || {}) },
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
      try { yield JSON.parse(line); } catch { /* skip */ }
    }
  }
  const tail = buffer.trim();
  if (tail) { try { yield JSON.parse(tail.startsWith('data:') ? tail.slice(5) : tail); } catch { /* */ } }
}
