# Research Portal — Agentic RAG

An agentic-RAG research portal built on **Progress Agentic RAG (Nuclia)**. It starts from a blank
Knowledge Box, lets you **add content in-app** (upload, paste, crawl), then **search, chat, and reason**
across it with a fully transparent multi-step agent. Demo corpus: the **CMS/DXP vendor & analyst** market
(top 20 vendors, ~300 resources).

> Built sprint-by-sprint. See [RESEARCH_PORTAL_PLAN.md](RESEARCH_PORTAL_PLAN.md) for the full plan and
> [KB_SETUP.md](KB_SETUP.md) for how the demo Knowledge Box was provisioned.

## Architecture

- **Frontend** — React 18 + TypeScript + Vite + Tailwind, React Router.
- **Backend** — a small Express server (`server/index.mjs`) that serves the SPA **and proxies all
  Knowledge Box traffic**, so the Nuclia service-account key is **never exposed to the browser**.
- **Deploy** — single container on Fly.io; the Nuclia key is a Fly secret.

```
browser ──/api/kb/*──► Express proxy ──(X-NUCLIA-SERVICEACCOUNT)──► Nuclia Knowledge Box
        ──/api/agent/*─►                                          ──► ARAG Retrieval Agent (optional)
```

## Local development

```bash
npm install
cp .env.example .env      # fill in NUCLIA_KB_URL + NUCLIA_API_KEY
npm run dev               # Vite (:5173) + API (:8787) together
```

Open http://localhost:5173 — Vite proxies `/api` to the Express server.

## Production / Docker

```bash
npm run build && npm start        # serves dist/ + /api on :8787
# or
docker build -t research-portal . && docker run -p 8787:8787 --env-file .env research-portal
```

## Environment

| Var | Scope | Purpose |
|---|---|---|
| `NUCLIA_KB_URL` | server | Full KB base URL (`.../api/v1/kb/<id>`) |
| `NUCLIA_API_KEY` | server | Service-account key (manager = ingestion) |
| `NUCLIA_READER_KEY` | server | Optional reader-scoped key for read paths |
| `NUCLIA_ARAG_*` | server | Optional Retrieval Agent (base URL / id / key) |
| `NUCLIA_GENERATIVE_MODEL` | server | Optional model id for `/ask` |

## Sprint status

- [x] **S0** — Scaffold, proxy server, KB-aware dashboard, Fly deploy
- [x] **S1** — Ingestion core: file upload, paste-text, link ingestion, live status
- [x] **S2** — Website/sitemap crawl ingestion + taxonomy (labelset) manager with facet counts
- [x] **S3** — Hybrid/semantic/keyword search, streaming AI answer + citations, facet filters, library
- [x] **S4** — Streaming assistant, global floating chat, resource viewer with resource-scoped chat
- [x] **S5** — Agentic pipeline inspector, context chunks, token/timing telemetry, trace history + feedback
- [x] **S6** — ARAG agent client (multi-driver streamAgent), driver catalog, REMi gauge, pipeline steps (auto-activates with a connected agent)
- [x] **S7** — D3 knowledge graph from corpus co-occurrence (vendor↔topic / ↔type) with node drill-down
- [x] **S8** — Schema-enforced structured outputs (comparison matrix, briefing, interactive assessment) via answer_json_schema
- [x] **S9** — Research workspace: save answers/resources/artifacts/notes, export Markdown report + BibTeX + CSV
- [x] **S10** — Analytics dashboard (KB health, distributions, usage), governance/RBAC posture, embeddable iframe widget

**All sprints complete.** Live: https://research-portal-arag.fly.dev
