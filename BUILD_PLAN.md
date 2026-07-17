# Research Portal — Build Plan: Leverage Everything Agentic RAG Can Do

**Goal:** turn the portal from "a very good RAG app" into a showcase that exercises the *full* Progress Agentic RAG surface — rich search, media intelligence (video/audio/OCR/visual), voice (TTS), and self-enriching ingestion via data-augmentation agents.

## The three theses this plan is built on

1. **Render what we already retrieve.** `getResource` pulls `extracted.metadata` (entities, paragraph positions/timestamps) and `find()` pulls `thumbnail` — and the UI throws almost all of it away. The single highest-leverage move is surfacing data already coming down the wire. (Verified: `KnowledgeDetailPage` renders only `extracted.text.text`; `ResultCard` ignores `FindResult.thumbnail`.)
2. **Turn on the augmentation agents.** Labeler / Graph-Extractor / Data-Augmentation ingestion agents make the corpus tag, summarize, and *build its own relation edges* automatically. Today all tagging is manual and the entity graph's edges are sparse because no Graph-Extractor has ever run.
3. **Media + voice are the untapped wow.** Transcripts-with-timestamps, OCR overlays, image galleries, search-by-image, and read-aloud/narration are all supported by the platform (or trivially app-side) and completely absent today.

## What's verified live on the KB (feasibility grounding)

| Capability | Status on the CMS/DXP KB | Implication |
|---|---|---|
| `reranker` + `rag_strategies` | ✅ live (shipped) | done |
| `/suggest` typeahead | ✅ live (shipped) | done |
| REMi scoring | ✅ live (shipped, KB-scoped `/predict/remi`) | done |
| **`/predict/chat` — 50+ LLMs over one key** | ✅ **works** (200) | model picker + per-task model routing, no per-vendor keys |
| **`/predict/rephrase`** (query rewrite) | ✅ endpoint live | powers did-you-mean + query enrichment |
| **`/predict/run-agents-text`** (run augmentation agents on text) | ✅ endpoint live | on-the-fly labeling/summaries without full ingestion setup |
| **Retrieval Agents** (workflow + drivers) | available; account-level setup + agent key | flagship: real multi-driver pipeline (client already parses it) |
| Entity-relation graph (`features:['relations']`) | ✅ live (shipped) | edges sparse until a Graph-Extractor runs |
| `filter_expression` (boolean/date/entity/kind) | ✅ **works, unused** | powers advanced search now |
| **OCR** paragraphs | ✅ **210 resources** | surface + filter now |
| **INCEPTION** (AI image descriptions) | ✅ **295 resources** | image intelligence now |
| `/predict/summarize` | ✅ **works, unused** | on-demand summaries now |
| Multimodal **`query_image`** (search by image) | ✅ **works, unused** | needs a vision generative model for *answers*, retrieval works now |
| **TRANSCRIPT** / **TABLE** paragraphs | ⚠️ **0 in corpus** | upload a sample video/PDF-with-tables to demo |
| Native **TTS** | ❌ not a NUA endpoint (422) | do app-side: Web Speech API (free) / ElevenLabs (premium) |
| Ingestion agents, extract/split strategies, security groups, activity logs | available, need **MANAGER** role + setup | Wave 4–5 |

**Prerequisites to unlock the media waves:** (a) upload 1–2 sample videos/podcasts + a scanned/table PDF so TRANSCRIPT/TABLE content exists; (b) confirm/point the KB at a **vision-capable generative model** (GPT-4o / Gemini) for multimodal *answers*; (c) a **MANAGER**-role key (server-side) to create ingestion agents & strategies.

---

# The ordered build list

Ordered by build sequence — front-loaded for demo lift, then depth. Each item: **capability leveraged · effort · demo-wow · where it lands.**

## WAVE 0 — Surface what we already retrieve (start here; ~days, huge lift)

1. **Rich, media-aware search result cards.** Thumbnail (already in `FindResult.thumbnail`, unused), media-type badge (reuse Library's `kindOf`), date-added, and **matched-term highlighting** (request `highlight`/`split` in `find()`, render `<mark>`). — *find() + existing data · Low · ⭐⭐⭐⭐⭐ · `ResultCard.tsx`, `nuclia.ts find()`.*
2. **Entities + "Related resources" on the detail page.** Render `extracted.metadata` entities as chips that deep-link into Graph & Search; add "more like this" via a `find()` seeded from this doc's top passages/entities. Kills the dead-end detail page, makes every doc a hub. — *extracted.metadata + find · Med · ⭐⭐⭐⭐ · `KnowledgeDetailPage.tsx`, `getResource`.*
3. **On-demand summary + suggested questions on detail.** Wire `/predict/summarize` (works live) as a "Summarize" action; generate 3 starter questions for the scoped chat. — *predict/summarize · Low · ⭐⭐⭐ · `KnowledgeDetailPage.tsx`.*
4. **Library: media-type facet + grid/list toggle + density.** `kindOf` already computes Video/Audio/PDF/Image/Link — make it a filter; add a compact list view for scanning 300+ resources. — *client + filter_expression(kind/mime) · Low · ⭐⭐⭐⭐ · `LibraryPage.tsx`, `FacetFilters.tsx`.*
5. **Search sort + pagination.** Remove the hard `pageSize: 25` ceiling; add relevance/date/title sort + infinite scroll. — *find() paging · Low · ⭐⭐⭐ · `SearchPage.tsx`.*

## WAVE 1 — An awesome search experience

6. **Advanced filtering via `filter_expression`** (verified live): boolean facets (vendor AND topic, exclude X), **date range**, **by media type**, **by paragraph kind** ("only OCR'd", "only tables/transcripts"), **by entity**. Replaces the legacy single-labelset path. — *filter_expression · Med · ⭐⭐⭐⭐ · `SearchPage.tsx`, `nuclia.ts`.*
7. **Zero-result & ranking transparency.** "Did you mean" (via `/predict/rephrase` or `/suggest`), auto-relax filters, nearest entities, web-fallback CTA; expandable score chip ("semantic 0.72 · keyword 'headless' · reranked ↑3"). — *rephrase/suggest + reranker metadata · Med · ⭐⭐⭐⭐ · `SearchPage.tsx`, `ResultCard.tsx`.*
8. **Multi-select → Compare / Ask-across.** Check 2–3 results → feed the Generate comparison matrix or an "ask across these" grounded answer. — *ask with resource_filters · Med · ⭐⭐⭐ · `SearchPage.tsx`, `GeneratePage.tsx`.*
9. **Synonyms + saved Search Configurations.** `/custom-synonyms` admin (Sitefinity↔Progress CMS); persist reranker/RAG-strategy/filter presets server-side via `/search_configurations`. — *custom-synonyms, search_configurations (MANAGER) · Low–Med · ⭐⭐⭐ · Governance + `nuclia.ts`.*

## WAVE A ★ — Retrieval Agents & the multi-model gateway (the flagship agentic story)

*This is the headline "Agentic" in Agentic RAG. The app already has the client plumbing (`aragAgent.ts` parses planner steps, driver fan-out, context chunks, answer citations) — it just has no agent attached, so the Agentic page currently **simulates** a pipeline. A retrieval agent is set up account-side (drivers + a 4-step workflow: Preprocess→Retrieval→Generation→Postprocess); it's setup-heavy, so start it in parallel with Wave 0.*

A1. **Stand up a real Retrieval Agent + workflow and attach it.** Create the agent in the Progress console — **Preprocess** (Rephrase) → **Retrieval** (Ask over multiple KBs + Perplexity + Google/Gemini + MCP) → **Generation** (Summarize) → **Postprocess** (REMi Validation + External Call). Point the app's existing `x-kb-arag-*` route at it. The Agentic page's DriverPanel + pipeline **stop being simulated and become a real multi-driver trace**. — *retrieval agent · Med (setup) · ⭐⭐⭐⭐⭐ · `aragAgent.ts` (already built), Governance to attach.*
A2. **Multi-model gateway — a model picker on every answer surface.** GPT‑4o, Claude, Gemini, Llama, Mistral… **50+ models over the single Nuclia key** via `/predict/chat` (no per-vendor API keys). Add a "compare two models side-by-side" mode (same question → two answers → REMi-scored). — *predict/chat · Med · ⭐⭐⭐⭐⭐ · Search/Assistant/Agentic/Generate + `nuclia.ts`.*
A3. **Per-task model routing ("speed ↔ quality").** Fast/cheap model for rephrase, labeling, suggestions; strong model for generation — mirrors the Smart Agent's planning-vs-execution model split. — *predict/chat + generative_model · Low–Med · ⭐⭐⭐.*
A4. **Talk to your data — SQL / Snowflake / Pandas agents.** Natural language over a relational DB (SQL/Snowflake driver) or an uploaded **CSV** (Pandas agent): "ask your database." A killer enterprise demo beyond documents. — *SQL/Snowflake/Pandas agents · Med–High · ⭐⭐⭐⭐.*
A5. **Take actions — MCP driver + External Call.** Connect any **MCP server** as a driver (tools), and use the **External Call** postprocess to fire a webhook/email/CRM update from an answer — closes the loop from *answer* to *action*. — *MCP + external call · Med · ⭐⭐⭐⭐.*
A6. **Smart Agent orchestration, surfaced.** Planning vs reactive mode, registered sub-agents, and human-in-the-loop validation of intermediate results — render the plan-then-execute trace in the reasoning panel. — *smart agent · Med · ⭐⭐⭐⭐.*
A7. **Blended KB + live-web answers.** One workflow that answers from your KB and augments with Perplexity/Google when the KB is thin, clearly attributed per source. — *multi-driver retrieval · Low once agent exists · ⭐⭐⭐⭐.*
A8. **`/predict/rephrase` + `/predict/run-agents-text` (both live).** Rephrase powers did-you-mean/query-enrichment (also see #7); run-agents-text runs labeling/summary agents on arbitrary text on the fly (preview before ingest). — *predict endpoints · Low · ⭐⭐⭐.*
A9. **KB model config toggles.** Enable `visual_labeling` (richer image/INCEPTION intelligence — currently disabled) and consider upgrading `relation_model` (currently `base`) for denser graph edges; optional `anonymization` for a PII-redaction demo. — *KB configuration · Low · ⭐⭐⭐.*

## WAVE 2 — Media intelligence (video / audio / OCR / visual)

10. **Synced transcript with clickable timestamps + jump-to-moment.** Read `extracted.metadata` paragraph timings (already fetched); render a transcript beside the player; click a line → `video.currentTime = t`. *The single most impressive media upgrade.* (Upload a sample video first.) — *TRANSCRIPT paragraphs + positions · Med · ⭐⭐⭐⭐⭐ · `KnowledgeDetailPage.tsx`.*
11. **Jump-to-moment from search.** Thread paragraph position through `find()` so a video result deep-links to the matched timestamp, not just the resource. — *find() positions · Med · ⭐⭐⭐⭐ · `find()`, `ResultCard.tsx`.*
12. **OCR surfacing.** Badge OCR-sourced results ("scanned"), a "scanned/OCR'd only" filter (`kind:OCR`), and an OCR text overlay/selectable layer on images. (210 live resources.) — *paragraph kind OCR · Low–Med · ⭐⭐⭐ · Search + `KnowledgeDetailPage.tsx`.*
13. **Image galleries + lightbox + INCEPTION descriptions.** Render all image fields (not just the first), zoomable lightbox, and show the AI image caption. (295 live.) — *INCEPTION + multi-file · Med · ⭐⭐⭐ · `KnowledgeDetailPage.tsx`.*
14. **Search by image (multimodal `query_image`).** Drag/drop an image → visually relevant results; verified live for retrieval. — *query_image · Med · ⭐⭐⭐⭐ · `SearchPage.tsx`, `find()`.*
15. **Visual answers (`page_image` / `paragraph_image` RAG strategies).** Feed page/paragraph images to a vision LLM for answers grounded in diagrams/screenshots. (Needs vision model.) — *rag_strategies image · Med · ⭐⭐⭐ · `ask()`.*
16. **PDF: page thumbnails + jump-to-cited-page + text layer.** Navigate to the page an answer cites; side-by-side extracted-text ↔ page. — *positions + PDF.js · Med–High · ⭐⭐⭐ · `KnowledgeDetailPage.tsx`.*

## WAVE 3 — Voice (TTS + speech input)

17. **"Read aloud" on every AI answer** (Web Speech API — free, instant) with word-highlight read-along; play/pause/scrub. — *app-side Web Speech · Low · ⭐⭐⭐⭐ · Search/Assistant/Agentic answer components.*
18. **Answer Journey narration.** Per-stop voiceover ("here's the strongest source, it says…") — turns the cinematic journey into a narrated walkthrough. — *app-side TTS · Low–Med · ⭐⭐⭐⭐ · `AnswerJourney.tsx`.*
19. **Voice input / dictation.** Speak a query (Web Speech recognition) on Search & Assistant. — *app-side · Low · ⭐⭐⭐ · Search/chat inputs.*
20. **Premium narrated summary (ElevenLabs).** Server-proxied ElevenLabs key (you already use it) → a "podcast summary" of a topic/answer for a premium voice. — *external, server-proxied · Med · ⭐⭐⭐ · new `/api/tts` proxy + Generate/Detail.*

## WAVE 4 — Data-augmentation & ingestion agents (the corpus enriches itself)

21. **Graph-Extractor ingestion agent.** Extract real entities+relations at ingest → **populates the relation-graph edges that are currently sparse**, and enables graph-boosted retrieval. Strategically the biggest multiplier. — *ingestion agent (MANAGER) · Med–High · ⭐⭐⭐⭐⭐ · agent config + reprocess.*
22. **Labeler ingestion agent.** Auto-classify new content by taxonomy → "Add a theme" self-labels; retires manual PATCH tagging. — *ingestion agent · Med · ⭐⭐⭐⭐ · agent config + Ingest UI.*
23. **Data-Augmentation agent.** Auto-summaries + auto Q&A per resource → powers detail summaries and a generated **FAQ** surface; filter `generated:{by:data-augmentation}`. — *ingestion agent · Med · ⭐⭐⭐ · agent config + Detail/Generate.*
24. **Live ingest processing status + post-ingest intelligence.** Poll/stream processing→processed; after upload show extracted entities, language, page count/duration, and AI-suggested tags (autocompleted against existing labelsets). — *notifications/status + extracted.metadata · Med · ⭐⭐⭐ · `IngestPage.tsx`.*
25. **Reprocess/reindex + Extract/Split strategies.** One-click "retry" on the 31 ERROR resources; configure table/OCR extraction + LLM chunking. — *reprocess, extract/split strategies (MANAGER) · Low–Med · ⭐⭐ · Analytics + Governance.*

## WAVE 5 — Enterprise intelligence & governance

26. **Search & query analytics.** Top queries, **zero-result queries** (content-gap gold), click-through, and a **REMi quality trend** from the scores already captured per trace. — *activity logs + local traces · Med–High · ⭐⭐⭐ · `AnalyticsPage.tsx` + server agg.*
27. **Security groups / per-user filtering + auth.** Map roles → Nuclia security groups; gate the currently-unauthenticated admin/integration endpoints. — *security.groups · Med–High · ⭐⭐⭐ · server + Governance.*
28. **Notifications/webhooks & Export/Import/Sync.** Live "resource processed" push (replace polling); KB backup/migration; auto-sync from S3/Drive/SharePoint. — *notifications, export/import, sync agents · High · ⭐⭐ · server.*

## WAVE 6 — Generate & workspace payoff

29. **Export from Generate** (PDF / DOCX / CSV / clipboard) + **citation-drill in matrix cells** (click a cell → the evidence). The "send this to a prospect" moment. — *client export + citations · Med · ⭐⭐⭐⭐ · `GeneratePage.tsx`.*
30. **Custom artifact schemas** (timeline, pro/con, FAQ, one-pager) beyond the fixed three. — *answer_json_schema · Med · ⭐⭐⭐ · `GeneratePage.tsx`.*
31. **Persist Assistant conversations + answer actions** (history/sessions, copy/regenerate/save/feedback→server). — *client + server · Med · ⭐⭐⭐ · `AssistantPage.tsx`, `useChat.ts`.*
32. **Wire the Graph into Search/Detail/Chat** + drill relations→resources ("show the documents that assert Adobe→developer→AEM"). — *find + relations · Med · ⭐⭐⭐ · `GraphPage.tsx` + entry points.*

---

## Recommended first sprint (highest lift, lowest risk)

**App-side, no backend/corpus changes — ship in days:** Wave 0 in full (#1–#5) + **multi-model picker (A2)** + **"Read aloud" (#17)**. These render data already fetched or wrap `/predict/chat` and Web Speech — and the model picker across 50+ LLMs is an instant, high-wow differentiator with the key you already hold.

**Two parallel setup-heavy tracks to start now (they take time to provision/process):**
- **Flagship: stand up the Retrieval Agent + workflow (A1)** — turns the Agentic page from simulation into a real multi-driver pipeline; the client already parses it.
- **Graph-Extractor ingestion agent (#21)** — enriches the whole corpus (real relation edges) and needs a reprocessing pass.
- Also: **upload a sample video/podcast + scanned/table PDF** so the media waves (#10–#12) and TABLE/OCR demos have real content.

## Dependencies at a glance
- **Retrieval agents (A1, A4–A7), agents/strategies (#21–#25), search configs (#9), security (#27)** → account-level setup + a **MANAGER**-role agent/key held server-side.
- **A4 (SQL/Snowflake/Pandas)** → a database connection or an uploaded CSV; **A5** → an MCP server / external endpoint.
- **#10–#11, TABLE demos** → sample media/PDF uploaded (corpus has 0 transcripts/tables today).
- **#14–#15 visual answers, A9 visual_labeling** → a vision generative model on the KB (via the `/predict/chat` model catalog).
- Buildable **today with current keys**: all of **Wave 0**, **A2/A3/A8 (predict/chat, rephrase, run-agents-text)**, **Wave 3 (voice)**, and **OCR/image #12–#13**.
