# ApexFetch — Phase 1 Audit

**Audited:** 2026-10-10
**Branch:** `main` (clean working tree, no uncommitted changes)
**Verdict:** The codebase compiles (`tsc --noEmit` is clean), but the app **cannot run end-to-end today** — the database is unreachable, production secrets are missing, and the data layer is split across two incompatible stores.

---

## 1. What this project actually is

A Next.js 14 (App Router) single-tenant "job lead discovery" platform. Despite the README's "14+ sources / AI-powered" framing, the current implementation is closer to an MVP with several dead branches:

| Layer | Stack | Reality |
|---|---|---|
| Framework | Next.js 14 App Router, React 18, TypeScript 5 | ✅ Compiles clean |
| DB | PostgreSQL (Supabase) via Prisma 5 | ❌ Unreachable locally; schema is thin |
| Auth | Clerk (passwordless + Google) | ✅ Wired via middleware + webhook |
| AI | Gemini + OpenAI | ⚠️ Only used in onboarding resume parse & local leads — **not** job scoring |
| Scraping | Native fetch (RSS/JSON) + Playwright | ⚠️ Fragile, no retry/proxy, split across 4 files |
| UI | Tailwind (dark only), custom CSS | ⚠️ No design system, poor a11y |
| Billing | Paystack (Stripe remnants remain) | ❌ Keys missing in prod env |
| Deploy | Vercel + GitHub Actions cron | ⚠️ Cron unsecured (missing secret) |

---

## 2. Verification results (what I actually ran)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ **Pass** — no type errors |
| Prisma client generated | ✅ Present (`@prisma/client` 5.22.0) |
| `git status` | ✅ Clean, on `main`, remote `takon157-rgb/apex-fetch.git` |
| Playwright browsers | ✅ Installed (chromium-1243 + headless shell) |
| **DB connectivity (Prisma)** | ❌ **FAIL** — `FATAL: (ENOTFOUND) tenant/user postgres.reoclbbidpqcvpsfhggl not found` |
| Live scraper run | ⛔ Could not run — requires a valid DB + Clerk session (both unavailable) |

**Why the DB fails locally:** `.env` / `.env.local` contain a **stale raw IP** and **swapped** connection strings:

- `.env` / `.env.local` → `DATABASE_URL = …@18.196.8.182:5432` (stale direct IP, wrong username format `postgres.<ref>`)
- `.env.vercel` → correct (`DATABASE_URL` = Supabase pooler, `DIRECT_URL` = direct)

`18.196.8.182` is a long-expired direct-connection IP. Local dev points at a dead host. (A "tenant not found" pooler error also raises the possibility the free-tier Supabase project `reoclbbidpqcvpsfhggl` has been paused.)

---

## 3. Findings ranked by impact

### 🔴 CRITICAL (blocks the product or loses user trust)

**C1. Database is unreachable locally; config is stale and swapped.**
`lib/prisma.ts` reads `DATABASE_URL`, which in `.env`/`.env.local` is a dead IP with the pooler-style username. Every Prisma call fails. Fix: align local env with `.env.vercel` (pooler URL for `DATABASE_URL`, direct URL for `DIRECT_URL`), and confirm the Supabase project is active.

**C2. Production env (`.env.vercel`) is missing 5 required secrets.**
Missing: `CRON_SECRET`, `GOOGLE_PLACES_API_KEY`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PRO_PLAN_CODE`, `NEXT_PUBLIC_APP_URL`. Consequences:
- `/api/cron/scrape` and `/api/cron/worker` return **401** (`if (!cronSecret …)` in `app/api/cron/scrape/route.ts:17`) → **scheduled scraping is silently dead in prod.**
- Paystack `initialize` (billing) throws → users can't upgrade.
- Local-leads scraper throws (`Missing GOOGLE_PLACES_API_KEY`).
- Paystack callback URL falls back to `http://localhost:3000` (`lib/paystack.ts:60`).

**C3. Split-brain data architecture (Prisma vs JSON files).**
Jobs live in **two incompatible stores**:
- Dashboard reads **Prisma** (`/api/leads` → `app/api/leads/route.ts`).
- `lib/db.ts` + 3 Playwright scripts (`ser.js`, `sidescraper.js`, `playwrightWorker.js`) read/write **`leads_storage.json`** and related JSON files.
- `/api/jobs` (`app/api/jobs/route.ts`) reads the **JSON** store; `/api/incoming` writes to **both**.

Net effect: the Playwright "worker" scrapers produce leads that **never reach the dashboard**, and any UI path wired to `/api/jobs` sees different (usually empty) data than `/api/leads`. JSON state is also global (not per-user) and not viable on serverless.

**C4. Job schema is missing the fields a job seeker needs.**
`prisma/schema.prisma` `Lead` has only: `title`, `description`, `budget`, `source`, `url`, `aiScore`, `proposalDraft`, flags. **No `company`, `location`, `salary` (range/currency), or original `postedAt` date.** The UI shows `budget` as a proxy for salary and `createdAt` (scrape time) as "postedTime". A real job platform needs these to filter, sort, and trust listings.

---

### 🟠 HIGH

**H1. Aggressive auto-prune silently deletes user data.**
`lib/scraper.ts:367-370` runs on **every** scrape:
```ts
updateMany({ where: { deleted: false, aiScore: { lt: 8 }, tracked: false, applied: false }, data: { deleted: true } })
```
Any lead scoring <8 that the user hasn't manually tracked/applied is moved to the trash automatically. With a 5–10 scale and a naive scorer, this is **most leads**, and it happens every time the scraper runs. Users will log in and find their leads gone with no explanation.

**H2. "AI scoring" is a hardcoded keyword heuristic, not AI.**
`lib/scraper.ts:331-343` scores via `text.includes('senior')` / `'$'` / `'urgent'` etc. The README claims "Gemini AI scoring"; Gemini is **never called** in the pipeline (only in onboarding resume parse and local-leads analysis). The "AI Score" badge is therefore misleading to users.

**H3. "Trend discovery" is broken — it harvests CDN/tracker domains.**
`scripts/ser.js:141-164` and `app/api/cron/worker/route.ts:18-36` regex-extract *every* URL host from job-board HTML. Confirmed in `settings.json`: the "trendingTargets" are `github.com`, `cdnjs.cloudflare.com`, `js.stripe.com`, `googletagmanager.com`, `facebook.com`, `linkedin.com`, etc. — asset CDNs, **not** company career sites. The weekly worker therefore scrapes garbage.

**H4. Scrapers have no retry, backoff, proxy, or block detection.**
`parseRSS`/`parseReddit`/`parseRemoteOK` return `[]` on any non-OK response (`lib/scraper.ts:68`, `:89`, `:111`). There is a fixed `1500ms` delay (`:259`) but **no retry, exponential backoff, proxy rotation, or 403/429 handling**. Blocked or rate-limited sources fail silently and are recorded as "success: false" only via the thrown path (a silent `[]` is recorded as **success** with count 0). Indeed — a source that aggressively blocks bots — is guaranteed to return empty.

**H5. Fragile regex RSS parsing.**
`lib/scraper.ts:42-46` `extractTag` uses regex on XML. It breaks on namespaced elements, attributes with `>` in values, and self-closing tags. A proper XML parser (`fast-xml-parser` or `cheerio` on XML) is required.

**H6. In-memory rate limiting is ineffective in production.**
`lib/rate-limit.ts` uses a module-level `Map`. On Vercel (serverless), each cold start resets it, and instances don't share state — so the 429 protection is effectively cosmetic. A Redis/Upstash store is needed.

---

### 🟡 MEDIUM

**M1. `/api/jobs` leaks data across users.**
`app/api/jobs/route.ts` calls `getJobs()` (`lib/db.ts`) which returns the **entire** `leads_storage.json` with no user filter. Any authenticated user gets every JSON-stored lead regardless of owner.

**M2. No pagination on the main dashboard; hard 50-lead ceiling.**
`app/page.tsx` fetches `/api/leads` without `page`/`limit`; the route defaults to `limit=50`. There is no "load more" / infinite scroll. Users can never see leads beyond the newest 50.

**M3. "Apply" is a boolean toggle, not an application flow.**
`toggleApplied` (`app/page.tsx:221`) only flips a flag. It doesn't open the listing, track application stage/notes, or record a submission date meaningfully (it sets `appliedAt`). The "View/Launch Link" is buried inside the expanded card (`app/page.tsx:582`) — the primary CTA a job seeker needs is not prominent.

**M4. Playwright scripts are broken for production.**
- `scripts/playwrightWorker.js:118` hardcodes `http://localhost:3000/api/incoming`.
- `app/api/run-scripts/route.ts` spawns `ser.js` + `sidescraper.js` via `child_process` — these require Playwright browsers and **writable filesystem**, neither of which exist on Vercel serverless.
These paths can only work on a long-lived VM, not the stated deploy target.

**M5. Accessibility is largely absent.**
Only one `aria-label` exists in the entire `app/` tree (`Header.tsx:26`). Icon-only buttons (🔄 📄 🚀 🗑 etc.) have no accessible names, no `focus-visible` styles, and status is conveyed by color alone ("Tracked"/"Applied" badges). No skip link. Contrast of `text-slate-500` on `bg-slate-950` is below AA in several places.

**M6. Admin gate leaks the admin ID to the client.**
`NEXT_PUBLIC_ADMIN_CLERK_ID` is embedded in the bundle (`app/components/Header.tsx:19`). The *real* authorization is server-side (`ADMIN_CLERK_ID`), so this is not a privilege escalation, but it unnecessarily exposes the admin's Clerk ID.

**M7. Paystack webhook verification uses a non-constant-time compare and CJS `require`.**
`lib/paystack.ts:42-49` uses `require('crypto')` inside an ESM module and `hmac === signature` (timing-attack-prone). Should use `import { createHmac, timingSafeEqual }` and compare buffers.

**M8. Stale/dead sources still configured.**
`SOURCES` includes **StackOverflow Jobs** (RSS discontinued 2024) and **Indeed RSS** (deprecated/blocked). CareerNest/Workbeam/Jobicy are niche or possibly dead. These silently produce zero leads and inflate the "14 sources" claim.

**M9. `lib/telegram.ts` is dead, misnamed code.**
It exports `sendTelegramAlert` but actually posts to **Discord** (`DISCORD_WEBHOOK_URL`) and is not imported anywhere. Confusing and deletable.

**M10. No observability.**
All logging is `console.error/console.log`. No structured logs, no error tracking (Sentry), no per-source success-rate dashboard beyond raw `SourceHealth` rows. The "scraper health" the manager needs is not surfaced anywhere.

---

### 🟢 LOW

**L1. Scoring logic duplicated 4× with inconsistent rules.**
`lib/scraper.ts:331`, `scripts/ser.js:48`, `scripts/sidescraper.js:96`, `scripts/playwrightWorker.js:83` each implement different keyword scoring. Extract to one shared module.

**L2. Duplicate / dead API routes.**
`/api/apply`, `/api/send-discord`, `/api/discord`, `/api/referral`, `/api/settings`, `/api/stored-leads` overlap with newer routes (`/api/leads/[id]`, `/api/scrape` actions) or reference the abandoned JSON store. Consolidate.

**L3. No tests whatsoever.**
No test framework, no `*.test.*` / `*.spec.*` files, no CI test step. The two GitHub Actions only curl cron endpoints.

**L4. No documented backups.**
Neither the Supabase DB nor the JSON runtime files have any backup/restore procedure. Given the auto-prune (H1), this is a real data-loss risk.

**L5. Minimal `next.config.js` / no security headers.**
No CSP, `X-Frame-Options`, `Referrer-Policy`, or image-domain config. The public jobs API sends `Access-Control-Allow-Origin: *` (`app/api/public/jobs/route.ts:57`) which is acceptable for a read-only feed but should be scoped.

**L6. Mixed monetization references.**
README + schema reference Stripe; code now uses Paystack; `NEXT_PUBLIC_STRIPE_LINK` is still in `.env.local`. Billing story is inconsistent.

---

## 4. Scraper health per source (best-effort, cannot run live)

Because the DB is unreachable and scraping requires auth, live success rates could not be measured. Assessment is from code + source availability:

| Source | Parser | Likely status | Notes |
|---|---|---|---|
| RemoteOK | API | 🟢 Likely OK | `remoteok.com/api` returns JSON array |
| Remotive | RSS | 🟢 Likely OK | Public feed |
| WeWorkRemotely | RSS | 🟡 Uncertain | RSS exists but may be Cloudflare-gated; also duplicated by `sidescraper.js`/`playwrightWorker.js` |
| Himalayas | RSS | 🟢 Likely OK | `himalayas.app/jobs/rss` |
| WorkingNomads | API | 🟡 Uncertain | `api/exposed_jobs/` may be deprecated |
| CryptoJobsList | RSS | 🟡 Uncertain | Niche feed |
| Jobicy | RSS | 🟡 Uncertain | `?feed=job_feed` |
| LandingJobs | RSS | 🟡 Uncertain | `landing.jobs/feed` |
| AuthenticJobs | RSS | 🟠 Likely stale | Feed params may have changed |
| Reddit | JSON | 🟠 Mostly "for hire" noise | Returns `[for hire]` posts, mostly filtered by BLOCK_KEYWORDS |
| CareerNest | RSS | 🔴 Possibly dead | `careernest.cloud` |
| Workbeam | RSS | 🔴 Possibly dead | `workbeamhq.com` |
| **Indeed** | RSS | 🔴 **Blocked/deprecated** | Aggressively blocks scrapers; RSS deprecated |
| **StackOverflow** | RSS | 🔴 **Dead** | Jobs RSS discontinued 2024 |

**Cross-cutting scraper problems:** no dedupe across sources (a job cross-posted to RemoteOK + Remotive appears twice), dedupe fingerprint uses MD5(title+source) which misses near-duplicates, no `postedAt` freshness, and description is truncated to 600 chars.

---

## 5. UI/UX review (designer lens)

**Strengths:** Dark theme is cohesive; card list is scannable; progress bar is polished; mobile filter drawer exists; empty/loading states present.

**Weaknesses:**
1. **"Find and apply in <30s" is not met.** The primary actions are tiny icon/emoji buttons; the actual job link ("Launch Link Origin ↗") is hidden inside an expanded card. No company, location, or salary shown at a glance.
2. **No meaningful search/filter.** Search is client-side substring over the already-loaded 50 leads; filters are "source" + a hardcoded 6-industry keyword list. No location, salary-range, remote-only, or date filters.
3. **Information hierarchy is inverted.** "AI Score", "Profitability", and "Difficulty" (all fake/generated) get more visual weight than title + link.
4. **No saved-jobs or application tracking** beyond a Track/Applied boolean. No alerts UI beyond a Discord webhook field.
5. **Accessibility:** icon-only buttons unnamed; color-only status; no focus rings; low-contrast muted text.
6. **Typography/scale:** many `text-[10px]`/`text-xs` labels; cramped. No consistent component library or design tokens.
7. **Responsiveness:** works down to mobile, but the desktop sidebar and mobile drawer duplicate filter logic (two sources of truth for the same state).

---

## 6. Suggested reading order for the fix phase

`lib/scraper.ts` → `app/api/leads/route.ts` → `app/page.tsx` → `scripts/*.js` → `lib/db.ts` → `prisma/schema.prisma` → `app/api/cron/*`.

---

## 7. Honest statement of what was NOT verified

- Live scraper success rates (DB + Clerk required).
- Live UI in a browser (could not sign in without Clerk keys / reachable DB).
- Actual Supabase project status (paused vs deleted) — needs Supabase dashboard access.
- Whether `.env.vercel` truly reflects the deployed Vercel env (it's a local mirror only).
