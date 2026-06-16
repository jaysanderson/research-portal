// Research Portal API server.
//   1. Serve the built SPA (dist/) in production.
//   2. Proxy ALL Nuclia traffic so service-account keys NEVER reach the browser.
//      Supports MULTIPLE Knowledge Boxes; the browser selects one per request via
//      an `x-kb` header (or `?kb=`). Each KB may carry its own ARAG agent.
//   3. /api/config returns the KB registry (no secrets) + live connectivity, so the
//      UI can show a switcher and disable boxes that aren't actually reachable.
//
// Env: NUCLIA_KB_URL, NUCLIA_API_KEY[, NUCLIA_READER_KEY, NUCLIA_KB_ID, NUCLIA_KB_NAME,
//      NUCLIA_ARAG_BASE_URL, NUCLIA_ARAG_AGENT_ID, NUCLIA_ARAG_API_KEY]
//      …and the same with a NUCLIA_KB2_* prefix for a second box.

import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load .env in development (no dotenv dependency).
try {
  const envPath = join(ROOT, '.env');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch { /* ignore */ }

const PORT = process.env.PORT || 8787;
const GEN_MODEL = process.env.NUCLIA_GENERATIVE_MODEL || '';
const trimUrl = (u) => (u || '').replace(/\/+$/, '');

// ---- Build the Knowledge Box registry from env (prefix '' and 'KB2') ----
function kbFromPrefix(p, fallbackId, fallbackName) {
  const base = trimUrl(process.env[`NUCLIA_${p}URL`]);
  const writerKey = process.env[`NUCLIA_${p}API_KEY`] || '';
  if (!base || !writerKey) return null;
  const aragBase = trimUrl(process.env[`NUCLIA_${p}ARAG_BASE_URL`]);
  const aragId = process.env[`NUCLIA_${p}ARAG_AGENT_ID`] || '';
  const aragKey = process.env[`NUCLIA_${p}ARAG_API_KEY`] || '';
  return {
    id: process.env[`NUCLIA_${p}ID`] || fallbackId,
    name: process.env[`NUCLIA_${p}NAME`] || fallbackName,
    base,
    readerKey: process.env[`NUCLIA_${p}READER_KEY`] || writerKey,
    writerKey,
    arag: aragBase && aragId && aragKey ? { base: aragBase, agentId: aragId, apiKey: aragKey } : null,
  };
}

const KBS = [
  kbFromPrefix('KB_', 'cms-dxp', 'CMS / DXP Market'),       // NUCLIA_KB_URL etc.
  kbFromPrefix('KB2_', 'member', 'Member Knowledge'),        // NUCLIA_KB2_URL etc.
].filter(Boolean);

const getKb = (req) => {
  const id = req.headers['x-kb'] || req.query.kb;
  return KBS.find((k) => k.id === id) || KBS[0] || null;
};

// ---- Live connectivity (so the UI can disable unreachable boxes) ----
const reach = {}; // id -> { ok, ts }
async function ensureProbed() {
  await Promise.all(KBS.map(async (kb) => {
    const cur = reach[kb.id];
    if (cur && Date.now() - cur.ts < 60000) return;
    try {
      const r = await fetch(`${kb.base}/counters`, {
        headers: { 'X-NUCLIA-SERVICEACCOUNT': `Bearer ${kb.readerKey}` },
        signal: AbortSignal.timeout(8000),
      });
      reach[kb.id] = { ok: r.ok, ts: Date.now() };
    } catch { reach[kb.id] = { ok: false, ts: Date.now() }; }
  }));
}

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const READ_POST_PATHS = [/^find$/, /^ask$/, /^search$/, /^catalog$/, /^suggest$/, /^feedback$/, /\/ask$/, /\/search$/];
const pickKbKey = (method, subpath, kb) => {
  const isWrite = WRITE_METHODS.has(method) && !READ_POST_PATHS.some((re) => re.test(subpath));
  return isWrite ? kb.writerKey : kb.readerKey;
};

const app = express();
app.disable('x-powered-by');

app.get('/api/health', (_req, res) => res.json({ ok: true, kbs: KBS.length }));

app.get('/api/config', async (_req, res) => {
  await ensureProbed();
  res.json({
    generativeModel: GEN_MODEL || null,
    kbs: KBS.map((kb) => ({
      id: kb.id,
      name: kb.name,
      kbId: kb.base.split('/').pop(),
      zone: (() => { try { return new URL(kb.base).host; } catch { return null; } })(),
      connected: !!reach[kb.id]?.ok,
      aragConfigured: !!kb.arag,
    })),
  });
});

// Generic streaming proxy.
async function proxy(targetUrl, key, req, res, { injectModel = false } = {}) {
  const headers = {
    'X-NUCLIA-SERVICEACCOUNT': `Bearer ${key}`,
    Accept: req.headers['accept'] || 'application/json',
  };
  let body;
  if (WRITE_METHODS.has(req.method)) {
    headers['Content-Type'] = 'application/json';
    if (req.rawBody && req.rawBody.length) {
      if (injectModel && GEN_MODEL) {
        try {
          const parsed = JSON.parse(req.rawBody.toString('utf8'));
          if (!parsed.generative_model) parsed.generative_model = GEN_MODEL;
          body = JSON.stringify(parsed);
        } catch { body = req.rawBody; }
      } else { body = req.rawBody; }
    }
  }
  if ((headers.Accept || '').includes('x-ndjson')) headers['X-SHOW-CONSUMPTION'] = 'true';

  const upstream = await fetch(targetUrl, { method: req.method, headers, body });
  res.status(upstream.status);
  const ct = upstream.headers.get('content-type');
  if (ct) res.setHeader('Content-Type', ct);
  if (!upstream.body) { res.end(); return; }
  const reader = upstream.body.getReader();
  res.setHeader('Cache-Control', 'no-cache');
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
      if (typeof res.flush === 'function') res.flush();
    }
  } catch { if (!res.headersSent) res.status(502); } finally { res.end(); }
}

function rawBody(req, _res, next) {
  if (!WRITE_METHODS.has(req.method)) return next();
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => { req.rawBody = Buffer.concat(chunks); next(); });
  req.on('error', next);
}

// KB proxy: /api/kb/<subpath> -> {kb.base}/<subpath>
app.use('/api/kb', rawBody, async (req, res) => {
  const kb = getKb(req);
  if (!kb) return res.status(503).json({ detail: 'No Knowledge Box configured on server.' });
  const subpath = req.path.replace(/^\/+/, '');
  const target = `${kb.base}/${subpath}${req._parsedUrl?.search || ''}`;
  try {
    await proxy(target, pickKbKey(req.method, subpath, kb), req, res, { injectModel: /(^|\/)ask$/.test(subpath) });
  } catch (err) {
    if (!res.headersSent) res.status(502).json({ detail: 'Upstream KB request failed', error: String(err) });
  }
});

// Agent proxy: /api/agent/session/<id> -> {kb.arag.base}/agent/{agentId}/session/{id}
app.use('/api/agent', rawBody, async (req, res) => {
  const kb = getKb(req);
  if (!kb || !kb.arag) return res.status(503).json({ detail: 'ARAG agent not configured for this Knowledge Box.' });
  const subpath = req.path.replace(/^\/+/, '');
  const target = `${kb.arag.base}/agent/${kb.arag.agentId}/${subpath}${req._parsedUrl?.search || ''}`;
  try {
    await proxy(target, kb.arag.apiKey, req, res);
  } catch (err) {
    if (!res.headersSent) res.status(502).json({ detail: 'Upstream agent request failed', error: String(err) });
  }
});

// Binary file upload -> {kb.base}/upload
app.post('/api/upload', express.raw({ type: '*/*', limit: '300mb' }), async (req, res) => {
  const kb = getKb(req);
  if (!kb) return res.status(503).json({ detail: 'No Knowledge Box configured on server.' });
  const filename = String(req.headers['x-filename'] || 'upload');
  try {
    const upstream = await fetch(`${kb.base}/upload`, {
      method: 'POST',
      headers: {
        'X-NUCLIA-SERVICEACCOUNT': `Bearer ${kb.writerKey}`,
        'Content-Type': req.headers['content-type'] || 'application/octet-stream',
        'X-FILENAME': Buffer.from(filename, 'utf8').toString('base64'),
      },
      body: req.body,
    });
    const text = await upstream.text();
    res.status(upstream.status).type(upstream.headers.get('content-type') || 'application/json').send(text);
  } catch (err) {
    res.status(502).json({ detail: 'Upload failed', error: String(err) });
  }
});

// Crawl helper (KB-agnostic): discover URLs from a sitemap or page links.
app.get('/api/crawl', async (req, res) => {
  const target = String(req.query.url || '');
  if (!/^https?:\/\//.test(target)) return res.status(400).json({ detail: 'Provide a valid http(s) url.' });
  const cap = Math.min(Number(req.query.limit) || 40, 100);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(target, { signal: ctrl.signal, headers: { 'User-Agent': 'ResearchPortalCrawler/1.0' } });
    clearTimeout(timer);
    const ct = r.headers.get('content-type') || '';
    const text = await r.text();
    const origin = new URL(target).origin;
    const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#38;/g, '&').replace(/&quot;/g, '"');
    const isSitemap = ct.includes('xml') || target.endsWith('.xml') || /<urlset|<sitemapindex/.test(text);
    let links = [];
    if (isSitemap) {
      links = [...text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decode(m[1]));
    } else {
      const hrefs = [...text.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)].map((m) => decode(m[1]));
      links = hrefs
        .map((h) => { try { return new URL(h, target).href; } catch { return null; } })
        .filter((h) => h && h.startsWith('http'))
        .filter((h) => new URL(h).origin === origin)
        .filter((h) => !/[?]/.test(h))
        .filter((h) => !/\/(w|wp-json|cdn-cgi|load\.php|api\.php|rest\.php|static|assets)\//i.test(h))
        .filter((h) => !/\/(Special:|Talk:|Help:|Category:|File:|Template:|Portal:)/i.test(h));
    }
    const seen = new Set();
    const out = [];
    for (const l of links) {
      const clean = l.split('#')[0];
      if (seen.has(clean)) continue;
      if (/\.(png|jpe?g|gif|svg|css|js|ico|woff2?|ttf|mp4|zip)(\?|$)/i.test(clean)) continue;
      seen.add(clean);
      out.push(clean);
      if (out.length >= cap) break;
    }
    res.json({ source: target, count: out.length, links: out });
  } catch (err) {
    res.status(502).json({ detail: 'Crawl failed', error: String(err).slice(0, 200) });
  }
});

// Knowledge graph from corpus classification co-occurrence (per selected KB).
async function kbCatalogFacet(kb, facetKey, filters) {
  const url = new URL(`${kb.base}/catalog`);
  url.searchParams.set('faceted', facetKey);
  url.searchParams.set('page_size', '0');
  (filters || []).forEach((f) => url.searchParams.append('filters', f));
  const r = await fetch(url, { headers: { 'X-NUCLIA-SERVICEACCOUNT': `Bearer ${kb.readerKey}` } });
  const d = await r.json();
  const node = (d.fulltext?.facets || d.facets || {})[facetKey] || {};
  const out = {};
  for (const [tag, count] of Object.entries(node)) out[tag.split('/').pop()] = count;
  return out;
}

app.get('/api/graph', async (req, res) => {
  const kb = getKb(req);
  if (!kb) return res.status(503).json({ detail: 'No Knowledge Box configured on server.' });
  const primary = String(req.query.primary || 'vendor');
  const secondary = String(req.query.secondary || 'topic');
  try {
    const primaryCounts = await kbCatalogFacet(kb, `/classification.labels/${primary}`);
    const primaryLabels = Object.keys(primaryCounts);
    const cooc = await Promise.all(primaryLabels.map(async (label) => {
      const sec = await kbCatalogFacet(kb, `/classification.labels/${secondary}`, [`/classification.labels/${primary}/${label}`]);
      return { label, sec };
    }));
    const nodes = [];
    const edges = [];
    const secTotals = {};
    for (const [label, count] of Object.entries(primaryCounts)) nodes.push({ id: `p:${label}`, label, group: primary, weight: count });
    for (const { label, sec } of cooc) {
      for (const [s, c] of Object.entries(sec)) {
        secTotals[s] = (secTotals[s] || 0) + c;
        edges.push({ source: `p:${label}`, target: `s:${s}`, weight: c });
      }
    }
    for (const [s, total] of Object.entries(secTotals)) nodes.push({ id: `s:${s}`, label: s, group: secondary, weight: total });
    res.json({ primary, secondary, nodes, edges });
  } catch (err) {
    res.status(502).json({ detail: 'Graph build failed', error: String(err).slice(0, 200) });
  }
});

// Static SPA (production)
const DIST = join(ROOT, 'dist');
if (existsSync(DIST)) {
  app.use('/assets', express.static(join(DIST, 'assets'), { immutable: true, maxAge: '365d' }));
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(join(DIST, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[research-portal] listening on :${PORT}  kbs=${KBS.map((k) => k.id).join(',') || '(none)'}`);
});
