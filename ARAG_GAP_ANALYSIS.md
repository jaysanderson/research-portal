# Research Portal — Gap Analysis: What Progress Agentic RAG Could Fill

**Method:** full audit of the codebase (`src/`, `server/index.mjs`) plus a live walkthrough of the deployed app (https://research-portal-arag.fly.dev) across every page, checked against the ARAG/Nuclia API doc (`The Vault/04_Product/API_Docs/AgenticRAG-API-Doc.MD`).

**Headline finding.** This is a genuinely functional demo — the AI surfaces call *real* ARAG endpoints, and the telemetry (scores, tokens, timings) is real, not faked. But the app currently exercises roughly **a third of the ARAG platform surface**. Almost everything the app hand-rolls in the client (a relevance floor, a fake "knowledge graph," a 4-stage pipeline animation, a manual tagging flow) is something the platform already does better server-side. **The single biggest opportunity is to lean harder on ARAG itself** — it turns "a nice RAG app" into "a showcase of what the platform does that DIY RAG can't."

The gaps below are grouped by theme, each with: what's missing today → the ARAG capability that solves it → effort → demo value.

---

## Part 1 — The "looks finished but isn't" shortlist (fix first)

These are visible today and undercut the demo if a prospect pokes at them.

| # | Issue | Where | Impact |
|---|---|---|---|
| 1 | **REMi answer-quality gauge never populates.** The `remi` event, `RemiScore` type, `RemiGauge` component and trace persistence all exist — but **no code path ever emits it** and there's no `/predict/remi` call. The headline "answer quality" promise on the Agentic page is dead UI. | `src/lib/agentic.ts:29,48`; `src/components/agentic/RemiGauge.tsx`; `AgenticPage.tsx:99` | High — it's the marquee "trustworthy AI" feature, and it's already 90% built |
| 2 | **Source Health shows "0% indexed · 0 resources"** on the live app while the same KB shows 1,114 resources and Add-content lists them as "Indexed." The status reconciliation query is broken for this KB. | `src/lib/nuclia.ts:172-194`; live `/analytics` | High — it reads as "the product can't even count its own index" |
| 3 | **Thumbs up/down feedback goes nowhere.** It writes to localStorage only and is never sent to Nuclia's feedback API (the server even has the path, unused). | `src/lib/agentic.ts:167`; `server/index.mjs:~189` | Medium — feedback loop is a common eval question |
| 4 | **"Knowledge graph" is not a knowledge graph.** It's built from classification-label *co-occurrence* via repeated `/catalog` calls — no entities, no relations. Fine as a visual, but it must not be represented as GraphRAG. (Live: green "Vendor" nodes render unlabeled.) | `server/index.mjs:610-637`; live `/graph` | High — GraphRAG is a top ARAG differentiator and this misrepresents it |
| 5 | **Library retry drops the sort order** (missing 5th arg on the retry call). Real bug. | `src/pages/LibraryPage.tsx:84` | Low |
| 6 | **Dashboard counters are slow** (skeletons still showing after 3s on load). | live `/` | Low — first-impression polish |
| 7 | **Dead code / static claims:** unused `Row` component; hardcoded "SOC 2 / ISO 27001 / GDPR" bullets not wired to anything. | `src/pages/SettingsPage.tsx:65-67,108` | Low |

---

## Part 2 — Retrieval quality (the cheapest, highest-leverage wins)

The app currently sends only `features` (keyword/semantic/hybrid) and then does its own **client-side** relevance floor (`MIN_SCORE=0.1`) and near-duplicate suppression. ARAG can do all of this better, server-side.

| Gap | ARAG capability | What it unlocks here | Effort |
|---|---|---|---|
| **No reranking** — ranking is raw fusion + a crude hand-rolled floor | `reranker: {name:"predict", window:50}` (§16.3) | Model-quality top-K ordering across Search, Assistant, Agentic **and** the Answer Journey (which sorts stops by score). Retire the hand-rolled floor. | **Low** — add one field to two request bodies |
| **No RAG strategies** — zero `rag_strategies` anywhere; the system prompt is brute-forcing thin context ("never say there isn't enough data") | `neighbouring_paragraphs`, `hierarchy`, `full_resource`, `field_extension`, `prequeries`, `metadata` (§9.3) | Real surrounding context for answers (fixes the "partial context" problem the prompt is patching); `full_resource` for the ask-a-resource Journey; `prequeries` for multi-vendor comparison questions — the app's *core* CMS/DXP use case | **Low–Med** |
| **Only legacy path-string filters** — no boolean logic, no date/entity/language filters | `filter_expression` (full AND/OR/NOT; §14) | Compound faceting in Library (vendor AND topic, exclude a competitor), date ranges, filter-by-entity or language | **Med** — needs a filter-builder UI |
| **No typeahead / suggestions** — `/suggest` is even allowlisted in the proxy but never called | `/suggest` (entities + text blocks; §8.5) | Search-as-you-type on the Search/Library bars | **Low** — plumbing already permitted |
| **No synonyms** — "Sitefinity" ≠ "Progress CMS" to keyword search | `/custom-synonyms` (§4.6) | Product-alias mapping so keyword retrieval catches variants — directly useful for a vendor-comparison corpus | **Low** |
| **Every request rebuilds its body inline** | Saved **Search Configurations** (§15) | Centralize reranker/RAG-strategy/filter tuning server-side, referenced by name per KB/tenant | **Low–Med** |

---

## Part 3 — Reasoning, agents & answer quality

| Gap | ARAG capability | What it unlocks here | Effort |
|---|---|---|---|
| **No ARAG agent is attached to any KB** (Governance shows "No agent" for all three). The "Agentic" page therefore runs a **fallback**: a single `/ask` stream re-dressed as a 4-stage pipeline, with the multi-driver panel shown as a greyed-out brochure. | **Retrieval Agents** — real planner + multi-driver fan-out (KB/Perplexity/Google/Tavily/Brave/SQL/Cypher/MCP) with `answer_citations` (§13). The client already parses all of this (`aragAgent.ts`). | Turns the Agentic page from a *simulation* into a *real* multi-step agent trace — the single most impressive demo moment, and the client is already wired for it | **Med** — provision + attach an agent per KB |
| **REMi quality metrics never computed** (see Part 1 #1) | `/predict/remi` — relevance / context-relevance / groundedness (§24) | Real per-answer groundedness scoring + trend history (traces already persist) | **Med** — needs a NUA key; client UI is done |
| **Usage analytics are device-local** (localStorage traces; the page even captions "Production aggregates server-side across users") | **Activity logs** `/manage/.../activity` (§5.6) + "questions without answers" review (§24.3) | Real cross-user usage analytics, audit trail, and an eval/improvement loop | **Med** — Manage API, different auth surface |

---

## Part 4 — Knowledge graph / GraphRAG (a flagship differentiator, currently faked)

| Gap | ARAG capability | What it unlocks here | Effort |
|---|---|---|---|
| **The graph is label co-occurrence, not entities/relations** (Part 1 #4) | Real **Graph API** — nodes/relations/paths (§10), `features:["graph"]` retrieval (§8.3), `graph_beta` RAG strategy (§9.3), plus the bundled `arag-graph-agent` skill to build the extractor | Genuine entity-relationship exploration (vendor → feature → competitor), exhaustive entity answers, and graph-boosted `/find` via rank fusion — the strongest story vs. plain vector RAG for a competitive-intelligence corpus | **High** (but the graph-agent skill lowers it a lot) |

---

## Part 5 — Ingestion intelligence (make the corpus build & maintain itself)

Today ingestion is link-crawl + manual upload, and classification is applied **manually** (PATCH per resource, or in the theme flow). The app *reads* `computedmetadata.field_classifications`, so it would display auto-labels — it just never creates the agents that produce them.

| Gap | ARAG capability | What it unlocks here | Effort |
|---|---|---|---|
| **No ingestion agents** — all tagging is manual | **Labeler / Graph Extractor / Data Augmentation** ingestion agents (§13, §4.10) | Auto vendor/topic tagging at ingest, auto-summaries, auto graph extraction — makes "Add a theme" self-classifying | **Med–High** |
| **No summaries/FAQ generated** — app only uses `summary` when it happens to exist | `/predict/summarize`, data-augmentation Q&A (§6.3, §13.1) | On-demand resource summaries in Library/Detail; generated FAQ per resource | **Med** |
| **ERROR-status resources are only listed, never retried** | `/reprocess`, `/reindex` (§4.1, §4.9) | A one-click "Retry" on the Source-Health problem list | **Low** |
| **Default extraction only** — no strategy for complex tables/scans | **Extract Strategies** + **Split Strategies** (§11.5, §4.11) — OCR, AI-tables, LLM chunking; paragraph `kind` = OCR/TABLE/TRANSCRIPT | Better answers over PDFs/tables/media; filter results by paragraph kind | **Med** |
| **No backup/migration/sync** — crawl + manual upload only | `/export`, `/import`, **Sync Agents** (§4.6, §5.8) | KB backup/migration; auto-sync from S3/Drive/SharePoint to keep the corpus fresh | **High** |
| **No live processing updates** — the app polls the catalog after ingest | **Notifications / webhooks** stream (§4.6) | Live "resource processed" updates instead of polling | **Med** |

---

## Part 6 — Enterprise, security & governance (biggest enterprise-readiness gap)

The Governance page is honest that RBAC is **"Not enforced in this build"** — but this is also where ARAG has strong, unused capabilities.

| Gap | ARAG capability | What it unlocks here | Effort |
|---|---|---|---|
| **No auth, no per-user filtering** — single open workspace | **Security groups** `security.groups` / `access_groups`, `hidden`/`show_hidden` (§22) | Per-user/tenant result filtering (relevant given multi-KB + a "Member Knowledge" KB); stage resources with `hidden:true` | **Med** — needs an identity model the app lacks |
| **Unauthenticated admin & integration write endpoints** — anyone reaching the origin can disconnect KBs for everyone, replace the server-side Perplexity key, or ingest/overwrite content (all persisted to the volume). Mitigated only by a network boundary; the SSRF host-allowlist *is* done well. | (App-layer auth + ARAG security groups; catalog only — not an ARAG gap per se, but the thing to gate before any customer exposure) | Safe public exposure | **Med–High** |
| **RBAC roles are static cards** (Manager/Writer/Reader, cosmetic) | Map app roles → Nuclia security groups so retrieval is filtered per user | Real role-based access, on-brand with the platform | **Med** |

---

## Part 7 — Multimodal (untapped, and the corpus suits it)

| Gap | ARAG capability | What it unlocks here | Effort |
|---|---|---|---|
| **No image/visual retrieval** — the corpus is heavily web-page/PDF based and the app already extracts page thumbnails | `query_image`, `page_image`, `paragraph_image` RAG strategies (§8.4, §9.3) | "Search by screenshot" and visual-context answers | **Med** — vision model + upload UI |

---

## Part 8 — State & persistence (product-readiness, not ARAG per se)

Everything user-generated is **localStorage-only** and lost on device/browser change: the Workspace (saved answers, notes, artifacts — the core "compile a cited report" feature), agentic trace history, answer feedback, chat threads (in-memory — gone on reload), and BYO KB/agent keys (plaintext in the browser). None sync across users or devices. This is the gap between "demo" and "product," and it's what the RBAC/activity-log/security-group work above depends on.

---

## Prioritized roadmap

**Quick wins (days, high demo value)**
1. Fix the dead REMi gauge — wire `/predict/remi` (Part 1 #1 / Part 3).
2. Fix Source Health "0%" (Part 1 #2).
3. Add `reranker` + `rag_strategies` to `find()`/`ask()` — better answers everywhere for a few lines (Part 2).
4. Attach a real ARAG **retrieval agent** to each KB so the Agentic page stops simulating (Part 3) — client is already built for it.
5. Wire `/suggest` typeahead and `/custom-synonyms` (Part 2).
6. Fix the Library retry-sort bug; retry button on Source Health via `/reprocess` (Parts 1, 5).

**Strategic bets (weeks, differentiation)**
7. Real **GraphRAG** via a graph-extractor ingestion agent + `features:["graph"]` (Part 4) — use the bundled `arag-graph-agent` skill.
8. **Ingestion agents** (labeler/graph/augmentation) so the corpus self-classifies and summarizes (Part 5).
9. **Security groups + auth + activity logs** for a real enterprise/governance story (Parts 3, 6, 8).
10. **Multimodal** visual search (Part 7).

**The one-line story for the demo:** *"Everything this portal does by hand — ranking, tagging, the knowledge graph, the pipeline — Agentic RAG does natively and better. Here's what it looks like when you let the platform do the work."*
