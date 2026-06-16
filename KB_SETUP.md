# Research Portal — Knowledge Box Setup (CMS/DXP)

This documents the live Knowledge Box that backs the Research Portal demo. The KB was provisioned **blank** and configured + populated entirely via the Nuclia Writer API.

## Connection

| Field | Value |
|---|---|
| API endpoint | `https://aws-us-east-2-1.rag.progress.cloud/api/v1/kb/f4731f44-7b31-45e9-85d9-57cc452821d0` |
| Zone / base URL | `https://aws-us-east-2-1.rag.progress.cloud` |
| KB id | `f4731f44-7b31-45e9-85d9-57cc452821d0` |
| Region | AWS us-east-2 |
| Key | Manager service-account JWT (held in `.kbsetup/key.txt`, gitignored — **do not commit**) |

> For the React app, map these to `VITE_RAG_KB_*` (reader) and keep the **manager/writer key server-side** in a Supabase Edge Function. Only a reader-scoped key should ever reach the browser.

## Domain

**CMS / DXP research portal** for CMS/DXP vendors and analysts. Coverage concentrates on the **top 20 CMS/DXP offerings** plus a cross-cutting market/analyst set. Progress **Sitefinity** is intentionally the most deeply covered vendor.

## Configuration applied

### Labelsets (classification taxonomy)
| Labelset | Title | Multiple | Purpose |
|---|---|---|---|
| `vendor` | Vendor | no | Which CMS/DXP the resource is about |
| `resource-type` | Resource Type | no | Kind of page (product, docs, review, analyst…) |
| `topic` | Topic | yes | Cross-cutting themes (Headless, DXP, Personalization, AI…) |

`topic` vocabulary: Headless CMS · DXP · Web Content Management · Personalization · Composable · Commerce · Developer Experience · Pricing & Licensing · Analyst Evaluation · Migration · AI · Dotnet · Open Source · SaaS · Enterprise · Security

### Resources
**300 link resources** (web URLs crawled + indexed by Nuclia), every one tagged with a `vendor`, a `resource-type`, and 1–3 `topic` labels. All URLs were discovered and reachability-checked via live web research (21 parallel research agents); zero duplicate URLs.

#### By vendor
| Vendor | Resources |
|---|---|
| Progress Sitefinity | 20 |
| Acquia (Drupal) | 14 |
| Adobe Experience Manager | 14 |
| Bloomreach | 14 |
| Contentful | 14 |
| Contentstack | 14 |
| Crownpeak | 14 |
| HubSpot Content Hub | 14 |
| Ibexa | 14 |
| Kentico | 14 |
| Liferay | 14 |
| Magnolia | 14 |
| Optimizely | 14 |
| Salesforce Experience Cloud | 14 |
| Sanity | 14 |
| Sitecore | 14 |
| Storyblok | 14 |
| Strapi | 14 |
| Umbraco | 14 |
| WordPress VIP | 14 |
| Market & Analyst (cross-cutting) | 14 |

#### By resource type
| Resource type | Count |
|---|---|
| Review Site (G2, TrustRadius, PeerSpot, Capterra, Gartner Peer Insights) | 71 |
| Product Page | 33 |
| Documentation | 25 |
| Encyclopedia (Wikipedia) | 24 |
| Blog/Article | 22 |
| Analyst Report (Gartner MQ, Forrester Wave, IDC) | 22 |
| Pricing | 20 |
| News | 20 |
| Comparison | 19 |
| Case Study | 19 |
| Source Code (GitHub) | 12 |
| Community | 9 |
| Video | 4 |

## How it was built (reproducible)
1. Verified blank KB (`/counters` → 0 resources).
2. Created 3 labelsets via `POST {KB}/labelset/{id}`.
3. 21 research agents gathered + verified live URLs → `.kbsetup/urls/*.json`.
4. Deduped + balanced to exactly 300 → `.kbsetup/final_resources.json`.
5. Pushed each as a link resource via `POST {KB}/resources` (link + `usermetadata.classifications`), 6-way concurrency → 300/300 created, 0 failed (`.kbsetup/push_log.json`).
6. Nuclia crawls + extracts + vectorizes each link server-side (status `PENDING` → `PROCESSED`).

## Artifacts (in `.kbsetup/`)
- `final_resources.json` — the 300 resources (url, title, vendor, type, topics)
- `urls/*.json` — per-vendor raw research output
- `push_log.json` — created UUIDs + any failures
- `status.py` / `monitor.py` — processing-status checkers
