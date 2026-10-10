# ApexFetch — Phase 3 Plan

**Prepared:** 2026-10-10
**Inputs:** `AUDIT.md` (findings), `RESEARCH.md` (competitive patterns)
**Status:** ⏸️ Awaiting owner approval before any execution (per instructions — no large/risky change ships without sign-off).

---

## 0. Guiding principles

1. **Fix blockers before features.** The product cannot run today (C1–C4). No UI/feature work matters until the data pipeline reaches the dashboard reliably.
2. **One source of truth.** Kill the Prisma-vs-JSON split. PostgreSQL via Prisma is the only store for jobs.
3. **Ship the RemoteOK core.** Salary + tags + timezone/remote filters + latest-sort + saved-search alerts are the highest ROI (per `RESEARCH.md`).
4. **Test before done.** Every task requires evidence (test output, screenshot). No "it compiles = done".
5. **Small, reversible commits on a feature branch** off `audit-and-plan`.

---

## 1. Phase 0 — Unblock (BLOCKED ON OWNER)

| # | Task | Owner | Effort | Risk |
|---|---|---|---|---|
| 0.1 | Confirm Supabase project `reoclbbidpqcvpsfhggl` is active; get correct pooler + direct connection strings | **Owner** | — | Blocker |
| 0.2 | Fix local `.env.local`: `DATABASE_URL` = pooler URL, `DIRECT_URL` = direct URL | DevOps | S | None (local only) |
| 0.3 | Add missing prod secrets to Vercel (`CRON_SECRET`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PRO_PLAN_CODE`, `GOOGLE_PLACES_API_KEY`, `NEXT_PUBLIC_APP_URL`) | **Owner + DevOps** | S | Blocker (cron/billing dead) |
| 0.4 | Back up database before any migration (Supabase PITR or `pg_dump` to a file) | DevOps | S | Critical to skip |

**Exit criteria:** `SELECT 1` succeeds locally; cron endpoint returns 200 (not 401); billing init works.

---

## 2. Phase 1 — Data foundation (Backend/Data Engineer)

| # | Task | Owner | Effort | Risk | Depends |
|---|---|---|---|---|---|
| 1.1 | Extend `Lead` schema: add `company`, `location`, `salaryMin`, `salaryMax`, `currency`, `jobType`, `postedAt`, `remote`, `timezone` (nullable) + migration | Backend | M | **HIGH** — destructive migration; must back up (0.4) | 0.4 |
| 1.2 | Retire JSON stores (`lib/db.ts`, `leads_storage.json`, `settings.json`, `scraper_status.json`, etc.) and rewrite `/api/jobs` to read Prisma with per-user filtering | Backend | M | **HIGH** — data-leak bug (M1) fixed here | 1.1 |
| 1.3 | Add pagination + limit/offset to `/api/leads` and wire "load more"/infinite scroll | Backend + Frontend | M | Low | 1.2 |
| 1.4 | Replace naive `aiScore` with a deterministic, explainable relevance score (keyword-overlap + salary + recency) that is *stored*, not recomputed per request; add `matchReason` string | Backend | M | Low (keeps "AI" framing honest) | 1.1 |
| 1.5 | Remove auto-prune (H1): delete only explicit trash; never silently delete on scrape | Backend | S | Low | — |

**Exit criteria:** schema migrated + backed up; `/api/jobs` and `/api/leads` both return per-user, paginated data from one store; no auto-delete.

---

## 3. Phase 2 — Scraper hardening (Scraper Engineer)

| # | Task | Owner | Effort | Risk | Depends |
|---|---|---|---|---|---|
| 2.1 | Rewrite RSS parsing with a real XML parser (`fast-xml-parser`); drop regex `extractTag` | Scraper | M | Low | — |
| 2.2 | Add retry + exponential backoff + per-source timeout + 429/403 handling; log failures with reason | Scraper | M | Low | 2.1 |
| 2.3 | Parse **company, location, salary, posted date** per source where available (RemoteOK API has salary; RSS has pubDate) | Scraper | L | Medium (per-source variance) | 1.1 |
| 2.4 | Remove dead sources (StackOverflow, Indeed RSS); add/verify live replacements (Telegram via `lib/telegram.ts` is currently fake — implement or remove; consider LinkedIn via a compliant source) | Scraper | M | **HIGH** — ToS/legal on LinkedIn/Telegram; verify compliance | 2.1 |
| 2.5 | Robust dedupe: cross-source canonical URL + normalized title fingerprint; mark cross-posts | Scraper | M | Low | 1.2 |
| 2.6 | Fix "trend discovery" to target actual company career domains (from job URLs), not CDN hosts | Scraper | M | Low | 2.1 |
| 2.7 | Persist per-source success/fail + latency to `SourceHealth` and surface a health endpoint/dashboard | Scraper + Backend | M | Low | 1.2 |
| 2.8 | Kill localhost-hardcoded `playwrightWorker.js`; make `/api/run-scripts` serverless-safe or delete it | Scraper | S | Low | — |

**Exit criteria:** a manual scrape run returns live, deduped leads with company/location/salary/date populated for ≥60% of listings; source-health report shows success/fail per source.

---

## 4. Phase 3 — Backend/API performance & ops (Backend + DevOps)

| # | Task | Owner | Effort | Risk | Depends |
|---|---|---|---|---|---|
| 3.1 | Add query-level caching for the public feed (`/api/public/jobs`) and per-user list | Backend | S | Low | 1.2 |
| 3.2 | Move rate limiting to a shared store (Upstash Redis) so it works on Vercel | DevOps | M | Low | 0.3 |
| 3.3 | Stale-job cleanup job: mark listings older than N days (or with dead links) as expired | Backend | M | Low | 1.2 |
| 3.4 | Structured logging (JSON) + error tracking (Sentry) + a `/api/health` endpoint | DevOps | M | Low | 0.3 |
| 3.5 | DB + config backup automation (documented restore runbook) | DevOps | M | Low | 0.4 |

**Exit criteria:** p95 list latency < 300ms (cached); rate limits enforced across instances; health endpoint green; backups schedulable + restorable.

---

## 5. Phase 4 — UI/UX redesign (UI/UX Designer → Frontend Engineer)

Design system first, then implement. **Target: a job seeker finds + applies to a job in <30s.**

| # | Task | Owner | Effort | Risk | Depends |
|---|---|---|---|---|---|
| 4.1 | Design system: tokens (color/spacing/type), component library (JobCard, FilterPanel, SortMenu, EmptyState, Skeleton) | Designer | M | Low | — |
| 4.2 | Job card v2: **company + location + salary + posted date + tags** at a glance; prominent "Apply/View" CTA (not buried) | Designer | M | Low | 1.1 |
| 4.3 | Filters: salary min slider, remote-only toggle, timezone/country, job type, experience level, tech-stack chips, date-posted; "remove filter" chips | Designer | L | Low | 1.1 |
| 4.4 | Sort menu (latest / highest-paid / most-viewed) + default to latest; multi-sort | Designer | S | Low | 1.1 |
| 4.5 | Saved jobs + minimal application tracker (Saved → Applied → Interview + notes) | Designer + Frontend | L | Medium (new state) | 1.2 |
| 4.6 | Saved searches + email alerts (daily/instant), email-only (no account friction) | Frontend + Backend | L | Medium | 1.2 |
| 4.7 | Accessibility pass: aria-labels on all icon buttons, focus-visible rings, non-color status, skip link, AA contrast | Frontend | M | Low | 4.1 |
| 4.8 | Implement all of the above in Next.js/Tailwind (fast, clean, responsive) | Frontend | L | Low | 4.1–4.7 |
| 4.9 | "Why this matches" line (Otta differentiator) using stored `matchReason` | Frontend | S | Low | 1.4 |

**Exit criteria:** screenshot-verified redesign on mobile + desktop; a cold user finds and opens a job in <30s; Lighthouse a11y ≥ 90; no icon-only unlabeled buttons.

---

## 6. Phase 5 — QA (QA Tester)

| # | Task | Owner | Effort | Risk | Depends |
|---|---|---|---|---|---|
| 5.1 | Write unit tests for scrapers (parsers, dedupe, scoring) and API routes | QA | L | Low | 2.x, 3.x |
| 5.2 | E2E tests (Playwright) for sign-in → scrape → filter → apply → track flows | QA | L | Medium | 4.8 |
| 5.3 | Manual click-through of every page + flow; regression report with screenshots | QA | M | Low | 4.8 |
| 5.4 | Fix regressions found; re-test until green | QA + Frontend | M | Low | 5.3 |

**Exit criteria:** full suite green in CI; manual QA report shows 0 Critical/High regressions.

---

## 7. Sequencing & dependencies (visual)

```
Phase 0 (unblock) ──▶ Phase 1 (schema/data) ──▶ Phase 2 (scrapers) ──▶ Phase 3 (backend ops)
                                                        │                      │
                                                        └──────────▶ Phase 4 (UI) ◀────────┘
                                                                        │
                                                                        └──▶ Phase 5 (QA) ──▶ Phase 5: DEPLOY (owner approval)
```

- Phases 2, 3, 4 can partially parallelize after 1.1/1.2 land.
- **Hard stop before deploy** (Phase 5) for owner approval + rollback plan.

---

## 8. Sub-agent assignments

| Role | Owns |
|---|---|
| **Scraper Engineer** | Phase 2 (parsers, retries, dedupe, sources, field extraction) |
| **Backend/Data Engineer** | Phase 1 + Phase 3.1/3.3 (schema, API, perf, cleanup) |
| **UI/UX Designer** | Phase 4.1–4.7 (design system, cards, filters, a11y) |
| **Frontend Engineer** | Phase 4.8–4.9 (implementation) |
| **QA Tester** | Phase 5 (tests, click-through, regression) |
| **DevOps** | Phase 0.2/0.4 + Phase 3.2/3.4/3.5 (secrets, backups, logging, deploy) |

---

## 9. Top risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Destructive schema migration loses data | High | Back up first (0.4); run migration on a copy; verify row counts before/after |
| LinkedIn/Telegram scraping violates ToS | High | Verify legal posture; prefer public APIs/RSS; isolate + flag compliance in 2.4 |
| Auto-prune already deleted user data | High | 1.5 removes it; document restore path from trash/backup |
| "AI" claims mislead users | Medium | 1.4 makes scoring explainable and honestly labeled (drop fake "AI Score" or relabel) |
| Scope creep vs solo capacity | Medium | Ship Tier-1 features first (RESEARCH §3); defer Tier-2/3 |
| Serverless can't run Playwright | Medium | 2.8 removes it; move browser jobs to a scheduled VM/worker or drop |

---

## 10. What I need from you (owner) to proceed

1. ✅ Approve this plan (or tell me what to cut/reorder).
2. Supabase: is `reoclbbidpqcvpsfhggl` active? Correct pooler + direct connection strings for `.env.local`.
3. Vercel: confirm whether `CRON_SECRET`, `PAYSTACK_*`, `GOOGLE_PLACES_API_KEY`, `NEXT_PUBLIC_APP_URL` are (or will be) set.
4. Legal comfort level on LinkedIn/Telegram scraping (affects 2.4).
