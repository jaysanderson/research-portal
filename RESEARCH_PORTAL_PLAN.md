# Research Portal — Build Plan (Agentic-RAG-Native)

> **Author:** Jay (jay@vestedtechnology.com.au)
> **Built on:** Progress Agentic RAG (ARAG / Nuclia) + Supabase + React/TS/Vite/Tailwind
> **Inspiration app:** ARAKS (`InspirationApplication/`) — we match everything it does and go well beyond.
> **Date:** 2026-06-16

---

## 1. The North Star

A **Research Portal that starts from a single blank Knowledge Box.** A user signs in, connects (or provisions) an empty KB, and immediately begins **uploading resources** — files, links, pasted text, whole websites, connected drives — *directly from the app*. The moment content is indexed, the full agentic experience lights up: search, streaming chat, multi-step agentic retrieval, knowledge-graph exploration, structured research outputs, assessments, and a collaborative research workspace.

**Two hard rules that define this product:**

1. **Zero-content cold start.** Nothing is hard-coded. The inspiration app bundles 60 markdown files at build time; we bundle *none*. Every feature must degrade gracefully to an empty KB and grow as content is added.
2. **Exploit every ARAG capability.** If Nuclia/ARAG can do it, the portal surfaces it: every retrieval driver, structured output, the knowledge graph, REMi scoring, token telemetry, MCP tools, security groups, PII anonymization, and recurring sync.

---

## 2. Parity + Delta — what we keep, what we add

### Parity (everything the inspiration app does)
Public + member AI assistants · streaming citations + source panel · floating chat widget · multi-source search w/ "People Also Ask" · Knowledge Explorer library · rich media viewer (video/PDF/audio/transcript + `?t=` deep-link) · resource-scoped chat · certification program (AI-generated domains, quiz builder, exam player, AI grading, study assistant) · learning modules + progress · three-tier access gating · Agentic Retrieval page (pipeline inspector, REMi gauge, token readout, traces, feedback) · knowledge graph explorer · demo/mock fallback mode.

### Delta (the "must do more")
| New capability | Why it matters |
|---|---|
| **In-app ingestion** (files, links, paste, crawl, connectors) | The product *is* the KB-builder. Inspiration app has none of this. |
| **Live processing visibility** | Watch resources go queued → extracting → vectorizing → graph-extracted → indexed. |
| **Recurring sync & freshness** | Scheduled re-crawl/connector sync; "last refreshed" per source. |
| **Full multi-driver agent** | KB + SQL + Cypher/graph + internet (Perplexity/Google/Tavily/Brave) + **MCP tools** in one fan-out. |
| **Auto knowledge-graph extraction** | Generate the entity/relation schema from the corpus (uses the `arag-graph-agent` skill), then graph-augment retrieval. |
| **Structured research outputs** | Schema-enforced literature reviews, comparison matrices, timelines, briefings — not just chat. |
| **Research workspace** | Save sessions, annotate, build cited reports, export (BibTeX/CSV/MD/PDF). |
| **Collections / spaces** | Scope content + access per project; multiple KBs or label-scoped views. |
| **Real auth + RBAC → Nuclia security groups** | Replace the demo toggle with genuine Manager/Writer/Reader + resource-level gating. |
| **Analytics & cost telemetry** | Query volume, REMi quality trend, token/$ spend, ingestion health. |
| **Embeddable widget** | Ship the portal's search/chat to any external site. |

---

## 3. ARAG Feature Exploitation Matrix

Every row is a Nuclia/ARAG capability and the sprint that lands it. Goal: nothing left on the table.

| ARAG capability | Surfaced as | Sprint |
|---|---|---|
| Writer API — file upload (incl. **TUS** large files) | Drag-drop ingestion | S1 |
| Writer API — **link/URL** resources + crawl | URL & site ingestion | S1–S2 |
| Writer API — text/conversation resources | Paste-text, chat-as-source | S1 |
| Processing — extraction, chunking, vectorization | Live processing tracker | S1 |
| Processing — **PII anonymization (GDPR)** | Anonymize toggle per source | S2 |
| Labels / **labelsets / classifiers** | Label manager + faceted filters | S2–S3 |
| **Connectors / sync** (Drive, S3, Notion, web) | Connectors gallery + recurring sync | S2 |
| Reader — `/find`, `/search`, `/catalog` | Search + Explorer | S3 |
| Reader — `/ask` w/ **citations + confidence**, streaming NDJSON | AI answer card + chat | S3–S4 |
| Hybrid / semantic / keyword retrieval modes | Retrieval-mode toggle | S3 |
| **Retrieval Agents** `streamAgent` pipeline | Agentic Retrieval engine | S5 |
| Pipeline stages: rephrase, historical, condition, restrict, restart | Pipeline inspector | S5 |
| **REMi** relevance + groundedness | REMi gauge + quality trend | S5, S10 |
| **Consumption** (token/model) | Token/cost readout + analytics | S5, S10 |
| Possible answers / structured intermediate | Inspector "possible answer" panel | S5 |
| Drivers: **nucliadb, SQL, cypher, MCP http/sse/stdio, perplexity, google, tavily, brave, basic_ask** | Agent driver config + fan-out | S6 |
| **MCP tools** (agent calls external tools) | MCP tool registry in agent | S6 |
| **Knowledge graph** (entities/relations, Cypher) | D3 explorer + graph-RAG | S7 |
| **Structured output** (JSON-schema enforced) | Exams, reviews, matrices, timelines | S8 |
| Multi-step reasoning chains | Exam admin + report builder | S8 |
| Security — **RBAC, security groups, resource-level** | Auth + collections gating | S10 |
| Service-account JWT, **edge-function credentials** | Server-side key broker | S0, S10 |
| Activity log / audit | Audit trail + analytics | S10 |
| Embeddable search widget | External embed | S10 |

---

## 4. Architecture (at a glance)

- **Frontend:** React 18 + TS + Vite + Tailwind (reuse inspiration patterns: `ragApi`, `agenticApi`, streaming NDJSON parser, markdown pipeline, component kit).
- **Auth + persistence:** Supabase (Postgres, RLS, Edge Functions). All new tables RLS-on, ownership-scoped.
- **Credential broker:** Nuclia service-account keys live **only** in Supabase Edge Functions — never `VITE_`-exposed in prod. Writer key (ingestion) is especially sensitive and stays server-side from S1.
- **Two API planes:**
  - *Reader/Agent plane* — `/find`, `/ask`, `/agent/.../session`, graph, catalog.
  - *Writer plane* — `/kb/{id}/resources`, TUS upload, labelsets, sync. Always proxied through an edge function.
- **Config model:** a user/workspace stores `{ kbId, zone/baseUrl, region }`; the blank-KB onboarding writes this. No build-time content imports.
- **Demo mode:** every feature keeps a mock path (mirrors inspiration app) so the portal demos with no live KB.

---

## 5. The Sprint Plan

> Cadence: ~2-week sprints. Each sprint ends with a **demoable vertical slice** and explicit acceptance criteria. Sprints 0–4 are the usable MVP; 5–8 are the agentic differentiators; 9–10 productionize.

---

### Sprint 0 — Foundation & Blank-KB Bootstrap
**Goal:** A signed-in user can connect/provision an empty Knowledge Box and land on an "empty but alive" portal.

- Scaffold app (routing, layout, Tailwind theme, component kit ported from inspiration).
- Supabase auth (email + SSO-ready); `users`, `workspaces`, `kb_connections` tables (RLS).
- Edge-function credential broker; reader + writer client libs (`ragApi`, `writerApi`, `agenticApi`) reading config from workspace, not `.env`.
- **Onboarding wizard:** "Connect a Knowledge Box" (paste zone + KB id + key) or "Create a blank KB" → validates, stores, shows empty-state dashboard.
- Global demo/mock toggle.

**ARAG used:** service-account auth, KB connection validation.
**Acceptance:** Sign in → connect a *blank* KB → see empty dashboard prompting "Add your first resource." No hard-coded content anywhere.

---

### Sprint 1 — Ingestion Core (the defining capability) ⭐
**Goal:** Turn a blank KB into a searchable corpus entirely from the UI.

- **Drag-and-drop upload:** PDF, docx, pptx, xlsx, txt, md, images, audio, video. Large files via **TUS** resumable upload through the edge proxy.
- **Paste-text** resource and **single-URL/link** resource.
- **Resource list** with **live processing status** (queued → extracting → vectorizing → indexed) via activity polling; error + retry states.
- Per-resource metadata edit; delete/replace.
- Empty-state → first-upload celebration; "now searchable" signal when first resource indexes.

**ARAG used:** Writer `/resources`, TUS upload, link resources, processing pipeline status.
**Acceptance:** From a blank KB, upload a PDF + paste text + add a link → all reach `indexed` → appear in resource list. Searchable in S3.

---

### Sprint 2 — Ingestion at Scale: Crawl, Connectors & Hygiene
**Goal:** Fill a KB fast, keep it fresh, keep it compliant.

- **Bulk/folder upload** and **batch link import**; **website crawl** (sitemap / depth-limited).
- **Connectors gallery:** Google Drive, S3, Notion, web — via Nuclia sync (or app-side fetch → push).
- **Recurring sync / freshness:** scheduled re-crawl + connector refresh (scheduled tasks / cron); "last refreshed" + drift indicators per source.
- **PII anonymization (GDPR)** toggle per source.
- **Labelset manager:** create labelsets/classifiers, auto- and manual-apply; language detection surfaced.

**ARAG used:** crawl ingestion, connectors/sync, PII anonymization, labelsets/classifiers, scheduled processing.
**Acceptance:** Crawl a site + connect a Drive folder; a scheduled sync runs and shows updated "last refreshed"; PII-anonymized source verified.

---

### Sprint 3 — Search & Discovery (parity+)
**Goal:** Best-in-class search over *user-uploaded* content.

- **Unified search:** `/find` results + `/ask` **AI answer card** (citations + confidence), real streaming.
- **Retrieval-mode toggle:** keyword / semantic / hybrid.
- Filters & **facets** (type, label, date, source); **"People Also Ask"** follow-ups.
- **Knowledge Explorer** library: infinite scroll, sort, type/label filters, counts.
- Progressive access gating hooks (wired fully in S10).

**ARAG used:** `/find`, `/ask` w/ citations+confidence, hybrid/semantic/keyword, catalog, labels as facets.
**Acceptance:** Search the corpus built in S1–S2; AI answer cites real uploaded resources; facets reflect applied labels.

---

### Sprint 4 — Conversational Assistant + Rich Resource Viewer
**Goal:** Chat with the corpus; open any resource and interrogate it.

- **Streaming chat assistant** with source panel, citation chips, example questions.
- **Floating chat widget** persistent across pages (context-aware).
- **Knowledge Detail viewer:** PDF inline, video (YouTube/Vimeo/DASH-HLS + native), audio, transcript w/ speaker+timestamp; **`?t=` deep-link** + tab deep-link.
- **Resource-scoped chat** (answers confined to one resource).

**ARAG used:** `/ask` streaming + citations, resource metadata (videoInfo, utterances, dashMpdUri, originUrl), scoped retrieval.
**Acceptance:** Chat returns cited streaming answers; open an uploaded video/PDF, ask a scoped question, click a timestamp to seek.

---

### Sprint 5 — Agentic Retrieval Engine (the showcase) ⭐⭐
**Goal:** Make the agent pipeline a first-class, fully transparent surface.

- `streamAgent` integration with **full pipeline inspector**: per-step module/title/reason/duration/tokens/chunk-count, mapped to stages (preprocessing → searching → generating → validating → complete).
- **Context-chunks panel**, **REMi gauge** (relevance + groundedness), **token/consumption readout**, **rephrase** + **historical-context** + **possible-answer** panels.
- **Session management:** persistent vs ephemeral, conversation rail, multi-turn `user_context`, Stop/abort.
- **TurnTrace** archive + thumbs up/down feedback (Supabase, RLS).

**ARAG used:** Retrieval Agents `streamAgent`, all pipeline events, REMi, consumption, possible answers, sessions, feedback.
**Acceptance:** A multi-step agent run shows every pipeline step live, REMi score, token cost; trace is archived and re-openable; feedback persists.

---

### Sprint 6 — Agentic Power: Multi-Driver Fan-Out & MCP Tools ⭐⭐⭐
**Goal:** Use *all* the drivers — the thing basic RAG can't do.

- **Driver config UI:** enable/disable per agent — KB (`nucliadb`), **SQL**, **Cypher/graph**, internet (**Perplexity/Google/Tavily/Brave**), **MCP (http/sse/stdio)**, `basic_ask`.
- **MCP tool registry:** register external tools the agent can call mid-pipeline; show tool invocations in the inspector.
- Preprocess controls: **conditions, restrictions, fallbacks, restart**.
- Visualize a single query **fanning out** to KB + web + graph + MCP and merging, with per-driver provenance on each chunk.

**ARAG used:** every retrieval driver, MCP tools, condition/restriction/restart modules, multi-source merge.
**Acceptance:** One question retrieves from KB + a web driver + graph + an MCP tool in a single turn; inspector shows each driver's contribution and provenance.

---

### Sprint 7 — Knowledge Graph & Graph-RAG
**Goal:** Auto-build a graph from uploaded content and let the agent reason over it.

- **Auto graph-extraction agent:** generate entity + relation schema from the corpus (leverages the `arag-graph-agent` skill), run NER/relation extraction, populate the graph.
- **D3 force-directed explorer:** entity sidebar (discovery), entity detail (expansion), Cypher-backed paths, filter bar; progressive expansion on click.
- **Graph-augmented retrieval:** feed Cypher/graph paths into the agent (driver from S6) for relationship-aware answers.

**ARAG used:** knowledge graph entities/relations, Cypher driver, graph-augmented retrieval, NER/relation extraction.
**Acceptance:** Graph builds from uploaded corpus; user explores entities; an agent answer demonstrably uses graph paths.

---

### Sprint 8 — Structured Output Suite: Research Outputs & Assessments
**Goal:** Generate *typed artifacts*, not just prose — the core ARAG differentiator.

- **Schema-enforced research outputs:** auto literature review, **comparison matrix**, **timeline**, executive briefing, gap analysis — generated from the corpus on demand.
- **Assessment engine (parity+):** AI-discovered knowledge domains, custom quiz builder (domain/sub-topic/count/difficulty), exam player, **AI grading** (incl. free-text vs rubric), personalized analysis, study assistant.
- **Learning modules** auto-generated from corpus + topic-level progress.
- Multi-step reasoning chain (generate → administer → grade → analyze) demonstrated end-to-end.

**ARAG used:** structured/JSON-schema output, multi-step reasoning chains, dynamic content synthesis.
**Acceptance:** From the uploaded corpus, generate a cited literature-review object *and* a graded exam with personalized feedback — both schema-valid.

---

### Sprint 9 — Research Workspace & Collaboration
**Goal:** Turn answers into durable, shareable, exportable research.

- **Saved research sessions**, notebooks, **highlights/annotations** on resources and answers.
- **Citation manager** + **export**: BibTeX, CSV, Markdown, and a composed **PDF report** with inline citations.
- **Collections / spaces:** scope content + retrieval per project (label-scoped views or separate KBs); switchable context.
- **Shared workspaces:** multi-user, comments, role-based collaboration.

**ARAG used:** label/collection scoping, catalog, per-resource retrieval, multi-KB config.
**Acceptance:** Build a cited report from saved findings and export it; share a collection with a teammate who sees scoped content only.

---

### Sprint 10 — Governance, Analytics, Embed & Hardening
**Goal:** Production-ready security, insight, and reach.

- **Real RBAC → Nuclia security groups:** Manager/Writer/Reader; resource-level + collection-level gating replaces the demo toggle; non-member graduated previews.
- **Analytics dashboard:** query volume, **REMi quality trend**, **token/$ spend**, ingestion health, top questions, dead-end queries; **audit log**.
- **Embeddable widget:** ship portal search/chat to external sites (Level-1 widget parity, configured by attributes).
- **Hardening:** all credentials server-side (edge functions), rate limiting, monitoring, error budgets; accessibility (WCAG) + performance pass; abort/timeout handling.

**ARAG used:** security groups/RBAC, activity/audit, REMi + consumption analytics, embeddable widget, edge-function security.
**Acceptance:** Penetration-sane credential posture (no keys in bundle); analytics reflect real usage incl. REMi + cost; widget embeds on an external page; RBAC enforced at page/content/API levels.

---

## 6. Cross-Cutting Concerns (every sprint)

- **Empty-state discipline:** every page must look intentional with zero content and improve as the KB grows.
- **Demo/mock parity:** keep the inspiration app's mock-fallback pattern so the whole portal demos offline.
- **Streaming everywhere:** NDJSON parsing reused across `/ask` and `/agent`.
- **Security-first ingestion:** the *writer* key never touches the client; proxied from S1.
- **Telemetry from day one:** capture REMi + consumption from S5 so S10 analytics has history.
- **Accessibility & responsive** baked in, not bolted on.

---

## 7. Sequencing Logic & Risk

- **MVP = S0–S4** (connect blank KB → ingest → search → chat). Shippable, already beyond a static demo.
- **Differentiators = S5–S8** (agentic transparency, multi-driver, graph, structured output). This is where "more than the inspiration app" becomes undeniable.
- **Productionization = S9–S10** (workspace, governance, analytics, embed).
- **Top risks:** (1) writer-key exposure → mitigated by edge proxy from S1; (2) large-file/long-job processing UX → TUS + status polling in S1–S2; (3) agent latency/120s aborts → Stop affordance + retry in S5; (4) graph-extraction quality → schema review step in S7; (5) cost control → consumption telemetry from S5, budgets in S10.

---

## 8. Definition of Done (product-level)

A new user can, with **no pre-loaded content**: connect a blank KB → upload/crawl/connect sources → watch them index → search, chat, and run a transparent multi-driver agentic query → explore an auto-built knowledge graph → generate a schema-valid cited research report and a graded assessment → save, share, and export it — all governed by real RBAC, observable via analytics, and embeddable elsewhere. **Every ARAG capability in the matrix (§3) is exercised by at least one shipped feature.**
