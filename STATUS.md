# ApexFetch — STATUS

**Last updated:** 2026-10-11
**Branch:** `audit-and-plan`
**Phase:** 0–4 done ✅ → 5 (QA + deploy) blocked on owner

---

## Verification evidence (all green)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm test` | ✅ 9/9 pass |
| `npm run build` | ✅ succeeds (all ~30 routes) |
| Live source health | ✅ 8/8 sources return 200 with valid payloads |
| Dangling references | ✅ none (deleted scripts/routes fully removed) |

---

## Done (Phases 0–4, committed)

**Phase 0 — config:** fixed local `.env.local` (pooler/direct hosts), generated `CRON_SECRET`.

**Phase 1 — data foundation:** schema + non-destructive migration (company/location/salary/jobType/remote/timezone/postedAt/tags/matchReason); scraper rewrite (real XML, retry+backoff, field extraction, dedupe); honest score + matchReason; **removed auto-prune**; fixed `/api/jobs` data leak; pagination; deleted dead JSON/Playwright scaffolding.

**Phase 2 — scrapers:** 8 live sources (fixed Remotive → JSON API; removed 403-blocked Reddit/CryptoJobsList); 4xx now surfaces as failures.

**Phase 3 — ops:** `/api/health` (public liveness), `/api/source-health` (per-user scraper health), stale-lead cleanup wired into daily cron, `BACKUP.md` runbook, removed 3 dead routes.

**Phase 4 — UI:** dashboard redesigned — RemoteOK-style cards (prominent Apply, company/location/salary/date/tags, relative time), filters (search/min-salary/remote/job-type + removable chips + clear-all), sort (Latest/Highest-paid/Score), skeleton + empty states, full accessibility pass.

**Strategy:** `MONETIZATION.md` — flip billing to B2B lead-gen subscription + employer postings.

---

## Remaining tech debt (non-blocking)

1. `api/settings` + `api/stored-leads` still use JSON files (`lib/db.ts`) — work locally, won't persist on Vercel serverless. Migrate to Prisma later.
2. Duplicate/legacy routes remain: `api/review-job`, `api/rework-resume`, `api/referral`, `api/profile/*` (functional, just overlap).

---

## Blocked on owner (2 items — required to go live)

1. **Unpause Supabase** project `reoclbbidpqcvpsfhggl` (Dashboard → Resume/Restore). The DB is the only thing preventing a live end-to-end test.
2. **Add to Vercel:** `CRON_SECRET` (copy from `.env.local`), `PAYSTACK_SECRET_KEY`, `PAYSTACK_PRO_PLAN_CODE`, `GOOGLE_PLACES_API_KEY`, `NEXT_PUBLIC_APP_URL`.

---

## Go-live steps (once unblocked)

1. Unpause Supabase → verify `GET /api/health` returns `db: up`.
2. `npx prisma db push` (or run `supabase/migration_add_job_fields.sql`) to apply new columns.
3. Add the 5 Vercel secrets → redeploy.
4. Sign in via Clerk → run "Pull" → confirm leads appear with company/location/salary/date.
5. Trigger `GET /api/cron/scrape` with `Authorization: Bearer <CRON_SECRET>` → confirm 200 + `staleRemoved`/`totalNewLeads`.
6. Manual QA pass (I'll do a full click-through once the DB is live).

---

## Verify commands

- `npx tsc --noEmit`
- `npm test`
- `npm run build`
