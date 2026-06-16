// Research Portal API server.
// Responsibilities:
//   1. Serve the built SPA (dist/) in production.
//   2. Proxy all Nuclia Knowledge Box traffic so the service-account key
//      NEVER reaches the browser. The browser talks to /api/kb/* and /api/agent/*.
//   3. Expose /api/config with non-secret runtime flags the SPA needs.
//
// Env (see .env.example): NUCLIA_KB_URL, NUCLIA_API_KEY, NUCLIA_READER_KEY,
// NUCLIA_ARAG_BASE_URL, NUCLIA_ARAG_AGENT_ID, NUCLIA_ARAG_API_KEY, NUCLIA_GENERATIVE_MODEL, PORT

import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load .env in development (no dependency on dotenv).
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
const KB_URL = (process.env.NUCLIA_KB_URL || '').replace(/\/+$/, '');
const WRITER_KEY = process.env.NUCLIA_API_KEY || '';
const READER_KEY = process.env.NUCLIA_READER_KEY || WRITER_KEY;
const GEN_MODEL = process.env.NUCLIA_GENERATIVE_MODEL || '';

const ARAG_BASE = (process.env.NUCLIA_ARAG_BASE_URL || '').replace(/\/+$/, '');
const ARAG_AGENT = process.env.NUCLIA_ARAG_AGENT_ID || '';
const ARAG_KEY = process.env.NUCLIA_ARAG_API_KEY || '';

const KB_CONFIGURED = Boolean(KB_URL && WRITER_KEY);
const ARAG_CONFIGURED = Boolean(ARAG_BASE && ARAG_AGENT && ARAG_KEY);

// Write operations require the writer key; everything else can use the reader key.
const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
// These KB subpaths are reads even though they use POST.
const READ_POST_PATHS = [/^find$/, /^ask$/, /^search$/, /^catalog$/, /^suggest$/, /^feedback$/, /\/ask$/, /\/search$/];

const app = express();
app.disable('x-powered-by');

app.get('/api/health', (_req, res) => res.json({ ok: true, kb: KB_CONFIGURED, arag: ARAG_CONFIGURED }));

app.get('/api/config', (_req, res) => {
  res.json({
    kbConfigured: KB_CONFIGURED,
    aragConfigured: ARAG_CONFIGURED,
    generativeModel: GEN_MODEL || null,
    // The KB id is not a secret; expose for display/graph endpoints.
    kbId: KB_URL ? KB_URL.split('/').pop() : null,
    zone: KB_URL ? new URL(KB_URL).host : null,
  });
});

function pickKbKey(method, subpath) {
  const isReadPost = READ_POST_PATHS.some((re) => re.test(subpath));
  const isWrite = WRITE_METHODS.has(method) && !isReadPost;
  return isWrite ? WRITER_KEY : READER_KEY;
}

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
      } else {
        body = req.rawBody;
      }
    }
  }
  // Streaming answers ask for ndjson — pass consumption header through.
  if ((headers.Accept || '').includes('x-ndjson')) headers['X-SHOW-CONSUMPTION'] = 'true';

  const upstream = await fetch(targetUrl, { method: req.method, headers, body });
  res.status(upstream.status);
  const ct = upstream.headers.get('content-type');
  if (ct) res.setHeader('Content-Type', ct);

  if (!upstream.body) { res.end(); return; }
  // Stream the upstream response straight through to the client.
  const reader = upstream.body.getReader();
  res.setHeader('Cache-Control', 'no-cache');
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
      if (typeof res.flush === 'function') res.flush();
    }
  } catch (err) {
    if (!res.headersSent) res.status(502);
  } finally {
    res.end();
  }
}

// Capture raw body for write requests (so we can forward verbatim / inject model).
function rawBody(req, _res, next) {
  if (!WRITE_METHODS.has(req.method)) return next();
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => { req.rawBody = Buffer.concat(chunks); next(); });
  req.on('error', next);
}

// KB proxy: /api/kb/<subpath> -> {KB_URL}/<subpath>
app.use('/api/kb', rawBody, async (req, res) => {
  if (!KB_CONFIGURED) return res.status(503).json({ detail: 'Knowledge Box not configured on server.' });
  const subpath = req.path.replace(/^\/+/, '');
  const target = `${KB_URL}/${subpath}${req._parsedUrl?.search || ''}`;
  const injectModel = /(^|\/)ask$/.test(subpath);
  try {
    await proxy(target, pickKbKey(req.method, subpath), req, res, { injectModel });
  } catch (err) {
    if (!res.headersSent) res.status(502).json({ detail: 'Upstream KB request failed', error: String(err) });
  }
});

// Agent proxy: /api/agent/session/<sessionId> -> {ARAG_BASE}/agent/{agentId}/session/{sessionId}
app.use('/api/agent', rawBody, async (req, res) => {
  if (!ARAG_CONFIGURED) return res.status(503).json({ detail: 'ARAG agent not configured on server.' });
  const subpath = req.path.replace(/^\/+/, '');
  const target = `${ARAG_BASE}/agent/${ARAG_AGENT}/${subpath}${req._parsedUrl?.search || ''}`;
  try {
    await proxy(target, ARAG_KEY, req, res);
  } catch (err) {
    if (!res.headersSent) res.status(502).json({ detail: 'Upstream agent request failed', error: String(err) });
  }
});

// Binary file upload -> Nuclia /upload (creates a resource from a file).
// The browser POSTs raw bytes with x-filename; we add auth + base64 filename.
app.post('/api/upload', express.raw({ type: '*/*', limit: '300mb' }), async (req, res) => {
  if (!KB_CONFIGURED) return res.status(503).json({ detail: 'Knowledge Box not configured on server.' });
  const filename = String(req.headers['x-filename'] || 'upload');
  try {
    const upstream = await fetch(`${KB_URL}/upload`, {
      method: 'POST',
      headers: {
        'X-NUCLIA-SERVICEACCOUNT': `Bearer ${WRITER_KEY}`,
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

// Crawl helper: discover URLs from a sitemap.xml or a page's same-origin links.
// Returns candidate links for the user to review before ingesting.
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
        // drop infra / non-article paths and query-string URLs in HTML mode
        .filter((h) => !/[?]/.test(h))
        .filter((h) => !/\/(w|wp-json|cdn-cgi|load\.php|api\.php|rest\.php|static|assets)\//i.test(h))
        .filter((h) => !/\/(Special:|Talk:|Help:|Category:|File:|Template:|Portal:)/i.test(h));
    }
    // dedupe, drop assets, cap
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

// Knowledge graph derived from real corpus classification co-occurrence.
// Nodes = vendors + topics; edges = how many resources link a vendor to a topic.
async function kbCatalogFacet(facetKey, filters) {
  const url = new URL(`${KB_URL}/catalog`);
  url.searchParams.set('faceted', facetKey);
  url.searchParams.set('page_size', '0');
  (filters || []).forEach((f) => url.searchParams.append('filters', f));
  const r = await fetch(url, { headers: { 'X-NUCLIA-SERVICEACCOUNT': `Bearer ${READER_KEY}` } });
  const d = await r.json();
  const node = (d.fulltext?.facets || d.facets || {})[facetKey] || {};
  const out = {};
  for (const [tag, count] of Object.entries(node)) out[tag.split('/').pop()] = count;
  return out;
}

app.get('/api/graph', async (req, res) => {
  if (!KB_CONFIGURED) return res.status(503).json({ detail: 'Knowledge Box not configured on server.' });
  const primary = String(req.query.primary || 'vendor');
  const secondary = String(req.query.secondary || 'topic');
  try {
    const primaryCounts = await kbCatalogFacet(`/classification.labels/${primary}`);
    const primaryLabels = Object.keys(primaryCounts);
    // co-occurrence: for each primary label, topic facet filtered to it
    const cooc = await Promise.all(primaryLabels.map(async (label) => {
      const sec = await kbCatalogFacet(`/classification.labels/${secondary}`, [`/classification.labels/${primary}/${label}`]);
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
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(join(DIST, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[research-portal] listening on :${PORT}  kb=${KB_CONFIGURED} arag=${ARAG_CONFIGURED}`);
});
