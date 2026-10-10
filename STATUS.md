# ApexFetch — STATUS

**Last updated:** 2026-10-10
**Branch:** `audit-and-plan`
**Phase:** 1 (Data foundation) mostly done → 2/3/4 next

---

## Done so far ✅

**Phase 0 — config**
- Fixed local `.env.local`: `DATABASE_URL` → Supabase pooler, `DIRECT_URL` → direct host (was stale IP `18.196.8.182`).
- Generated a 64-char `CRON_SECRET` in `.env.local` (gitignored) — **owner must copy it to Vercel**.

**Phase 1 — data foundation** (committed, tsc clean, 9/9 tests pass, `next build` succeeds)
- Schema: added `company`, `location`, `salaryMin/Max`, `salaryCurrency`, `jobType`, `remote`, `timezone`, `postedAt`, `tags`, `matchReason` + indexes (all nullable → non-destructive).
- `supabase/migration_add_job_fields.sql` (idempotent) for the new columns.
- `lib/scraper.ts` rewritten: real XML parsing (cheerio), retry+backoff+timeout, per-source field extraction, cross-source dedupe, honest explainable `score` + `matchReason`.
- **Removed the auto-prune** that silently deleted leads scoring <8 on every scrape.
- Fixed "trend discovery" to derive company domains from job URLs (not CDN hosts).
- `api/leads`: paginated per-user results ordered by `postedAt`; removed the relevance filter that hid leads.
- Deleted dead JSON/Playwright scaffolding: `lib/telegram.ts`, `scripts/*.js`, `api/jobs`, `api/status`, `api/incoming`, `api/run-scripts`.
- `app/page.tsx`: cards now show company/location/salary/date/tags/matchReason; fixed "newest" sort.
- Extracted pure utils to `lib/scraper-utils.ts` (fixes duplicated scoring) + `lib/scraper.test.mjs` (9 tests, `npm test`).
- README + `.env.example` updated (10 sources, no more `worker` command, added `NEXT_PUBLIC_APP_URL`).

**Phase 2 — scraper hardening** (live-verified)
- Live source health check: **8/8 sources return 200 with valid payloads** (RemoteOK, Remotive, WeWorkRemotely, Himalayas, WorkingNomads, AuthenticJobs, Jobicy, LandingJobs).
- Fixed Remotive (old `/feed` → 404; switched to `/api/remote-jobs` JSON API + added `parseRemotive`).
- Removed Reddit + CryptoJobsList (both 403-blocked; Reddit was mostly "[for hire]" noise).
- `fetchWithRetry` now throws on 4xx so blocked/dead sources are recorded as failures, not silent "0 leads".

## Still broken / blocked ⛔

1. **Supabase is paused** — owner must unpause project `reoclbbidpqcvpsfhggl` before the DB works at all.
2. **Prod secrets missing** — owner needs to set on Vercel: `CRON_SECRET` (use the one in `.env.local`), `PAYSTACK_SECRET_KEY`, `PAYSTACK_PRO_PLAN_CODE`, `GOOGLE_PLACES_API_KEY`, `NEXT_PUBLIC_APP_URL`. Until then: cron 401s, billing broken, local-leads broken.
3. **`/api/settings` and `/api/stored-leads` still use JSON files** (`lib/db.ts`) — legacy, lower priority; migrate later.
4. **Duplicate/dead routes still present**: `api/discord`, `api/send-discord`, `api/apply`, `api/referral` (overlap newer routes).

## What's next 🚀

- **Phase 3:** caching, Redis rate limiting, stale-job cleanup, Sentry logging, backup runbook.
- **Phase 4 (delegate to sub-agents):** full UI redesign — RemoteOK salary/tag/filter/sort core, saved jobs + application tracker, saved-search email alerts, accessibility pass.
- **Phase 5:** QA sub-agent (E2E + manual), then deploy gate with rollback plan.

## Blocked on owner (please do when convenient)

1. Unpause Supabase project `reoclbbidpqcvpsfhggl`.
2. Add the 5 secrets to Vercel (list above).
3. Create Paystack + Google Cloud accounts when ready for billing / local-leads.

## Verify commands

- `npx tsc --noEmit` → clean
- `npm test` → 9/9 pass
- `npm run build` → succeeds
- After unpausing DB: `npx prisma db push` (or run `supabase/migration_add_job_fields.sql`) to apply the new columns.
