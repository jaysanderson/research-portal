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
