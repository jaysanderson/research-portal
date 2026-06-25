# Research Portal — Demo Script (new features)

**App:** https://research-portal-arag.fly.dev
**Runtime:** ~12–15 min full, ~5 min "highlights" path.
**What this shows:** an Agentic-RAG research portal that starts from a blank Knowledge Box, lets anyone connect/seed/curate KBs in-app, and tailors itself to whatever subject the box is about. Three live boxes: **CMS / DXP Market** (300+), **Agentic RAG Competitors** (571), **3D Printers** (≈696).

> Tip: the portal is **dynamic** — every placeholder, suggestion chip, hero line, Generate prompt and embed widget is driven by the *active* Knowledge Box's auto-generated profile. Switching boxes re-themes the whole app.

---

## 0. Setup (before the room)
- Open the app; in the sidebar **Knowledge Box switcher**, select **3D Printers**.
- Have a second tab on **Knowledge Boxes** (`/knowledge-boxes`) for the management demo.
- (Optional) Confirm **Governance → Integrations** shows *Perplexity: live web search on*.

---

## 1. The portal re-themes to the active KB (90s)
1. Land on **Dashboard**. Note the hero subtitle, the subject chip ("3D Printing"), the stat tiles (≈696 resources), and the **Explore** topic chips — all generated from the KB, not hardcoded.
2. Open the **switcher** → select **Agentic RAG Competitors**. The whole app re-themes: hero, example prompts, topics now about enterprise AI search.
3. Switch back to **3D Printers**.
   - **Talking point:** "Connect any blank box and the portal describes itself — no per-customer hardcoding."

## 2. Search — grounded, cited, honest (2 min)
1. Go to **Search**. Run **"best 3D printer for beginners"** (Hybrid mode).
2. Watch the streaming **AI Answer**, then the **inline `[1] [2]` citations** — click one; it scrolls to the numbered source. Each result card shows a **relevance %** and a clean snippet.
3. Toggle a **facet** (e.g. Manufacturer → Bambu Lab) — results filter; the AI answer re-grounds (debounced, not on every click).
4. **Honesty demo:** search **`asdfqwerzxcv12345`** → AI returns *"no grounded answer"* **and the result list is empty** ("No results"), not 18 random docs. (Relevance floor at work.)
   - **Talking point:** "It won't fake a match — critical for a research tool."
5. Flip to **Keyword** and **Semantic** modes on a real query to show the retrieval modes.

## 3. Assistant + Agentic (2 min)
1. **Assistant**: ask **"How does resin printing compare to FDM?"** — streaming cited answer with inline citations. Ask an off-domain question (e.g. "What's the capital of France?") → graceful *"couldn't find a grounded answer… try Search"* instead of a blank bubble.
2. **Agentic**: ask **"Which printers suit dental or medical use, and why?"**
   - Expand **Show reasoning**: pipeline stages (Preprocess → Retrieve → Generate → Validate), the **Context** chunks (cleaned of cookie/nav chrome), token/latency **telemetry**, and the answer-quality (REMi) section. Thumbs-up to show trace feedback + history.

## 4. Generate — schema-enforced artifacts (90s)
1. **Generate → Comparison matrix**: run the seeded prompt → a real table (printers × criteria) with sources.
2. **Briefing** and **Assessment** tabs each produce structured output. (All three are strict-schema enforced, so they work on any KB's model.)
   - **Talking point:** "One click from a question to a cited matrix/briefing you can save & export."

## 5. Library, media & detail (90s)
1. **Library**: thumbnails are live page screenshots (even for browser-connected boxes). Use the **Sort** control → *Newest added / Oldest / Title* — note **"Added <date>"** on each card.
2. Open a resource. Extracted content renders as **formatted Markdown** (not raw). For file resources, PDFs render inline and video/audio stream in a player. Right-side **"Ask about this resource"** scoped chat.

## 6. Knowledge graph & taxonomy (90s)
1. **Knowledge graph**: change **both axes** — e.g. **Manufacturer ↔ Model**, then **Technology ↔ Material**. Hover a node to reveal its label + neighbours; use the **zoom controls**; click a node to list its resources.
2. **Taxonomy**: 8–9 labelsets (Manufacturer, Model, Technology, Material, Application, Market Segment, Price Band, Resource Type, Topic) with live counts.

## 7. ⭐ Self-service: stand up & curate a KB (3–4 min) — the differentiator
1. **Knowledge Boxes** (`/knowledge-boxes`):
   - **Test** a box → a **toast** confirms "connected — N resources · agent OK".
   - Show **Add agent**, **Set active**, **Remove** (built-in = disconnect for everyone, restorable; local = delete), and the **Disconnected → Reconnect** section.
2. **Set up** (wizard) on a box: type a subject ("A hub on enterprise cybersecurity — vendors, threats, compliance, incidents") → the app **proposes a taxonomy + tailored copy + graph axes**; review/edit → **Apply**. (Works on a *blank* box.)
3. **Add a theme** (Add content → "Add a theme"): type **"common pain points for CMS/DXP customers"** →
   - The portal **restates the task** and proposes **sources via live Perplexity web search** ("Sources found via live web search" badge) — note it picks **independent** sources (Reddit, G2, forums) for a *pain-points* query, not vendor marketing.
   - Pick the **target KB** and a **count (10/25/50)** → **Go** → live progress (discover → verify → ingest), then the new theme is labeled, searchable and on the graph.
4. **Governance → Integrations**: show the **Perplexity** key is managed in-app (set/test/remove, model), stored server-side, never in the browser.

## 8. Analytics & governance (60s)
1. **Analytics**: **Source health** — % indexed reconciles with the total; a **drillable list** of any non-PROCESSED resources; content distribution charts by taxonomy.
2. **Governance**: server-side credential posture; RBAC honestly marked "not enforced in this build"; **embeddable widget** snippet (the embed re-themes to the active KB too).

## 9. Workflow polish (30s)
- **⌘K** command palette — type to route to Assistant/Search/Agentic or jump to any page.
- **Workspace** is **scoped to the active KB**; save answers/resources/notes, then **export** Markdown / BibTeX / CSV.

---

## Quick "highlights" path (5 min)
KB re-theme (switcher) → Search "best beginner 3D printer" (inline citations + relevance) → gibberish (honest empty) → **Add a theme** with live Perplexity sources → Knowledge graph Manufacturer ↔ Model → Generate comparison matrix.

## One-liners
- *"Blank box in, themed research portal out."*
- *"Live-web source discovery that knows pain-points come from forums, not vendor decks."*
- *"Transparent agentic pipeline — every answer shows its retrieval, tokens, and grounding."*
- *"It says 'I don't know' instead of making something up."*

## Newly-added features checklist (all live)
- [x] Multi-KB switch + management (add/test/remove/disconnect/reconnect, per-KB agent)
- [x] Self-service BYO KB (endpoint + key) with SSRF-guarded proxy
- [x] KB **Setup wizard** (taxonomy + profile + graph from a description)
- [x] **Add a theme** with **Perplexity** live-web, intent-aware source discovery
- [x] In-app **Perplexity integration** management (volume-persisted, env fallback)
- [x] Dynamic per-KB tailored copy (auto profile, 4-layer cache)
- [x] Media: inline **PDF**, **video/audio** streaming, **Markdown** render (+ sanitizer), **BYO thumbnails**
- [x] **Inline citations** (answer-range anchored)
- [x] **Relevance floor** + near-duplicate suppression + "no results" honesty
- [x] **Date added** display + sort
- [x] Knowledge graph **dual-axis** (brands/models/etc.) + zoom + hover
- [x] **Source health** analytics (reconciled, drillable)
- [x] **KB-scoped Workspace** + export
- [x] Toast confirmations, ⌘K, responsive fixes
