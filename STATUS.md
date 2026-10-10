# ApexFetch — STATUS

**Last updated:** 2026-10-10
**Current phase:** Phase 1 (Audit) ✅ complete → Phase 2 (Research) next

---

## What's working ✅

- Codebase compiles clean (`tsc --noEmit`).
- Git is clean on `main`; remote `takon157-rgb/apex-fetch.git` reachable.
- Auth scaffolding (Clerk) wired end-to-end (middleware, webhook, header).
- Prisma client generated and in sync with `schema.prisma`.
- Playwright browsers installed locally.

## What's broken ❌ (top blockers)

1. **DB unreachable locally** — `.env`/`.env.local` `DATABASE_URL` points to stale IP `18.196.8.182`; strings swapped vs `.env.vercel`.
2. **Prod env missing secrets** — `CRON_SECRET`, `PAYSTACK_*`, `GOOGLE_PLACES_API_KEY`, `NEXT_PUBLIC_APP_URL` absent from `.env.vercel` → cron 401, billing broken, local leads broken.
3. **Split-brain data** — Prisma (dashboard) vs JSON files (Playwright scripts + `/api/jobs`).
4. **Missing job fields** — no `company`, `location`, `salary`, `postedAt` on `Lead`.
5. **Aggressive auto-prune** — leads with `aiScore < 8` deleted on every scrape.

## What's next 🚀

- **Phase 2:** Research 5–8 top job platforms → `RESEARCH.md`.
- **Phase 3:** Produce `PLAN.md` (prioritized roadmap, owners, effort, risk) → **get approval before execution.**
- **Phase 4:** Execute via sub-agents on a feature branch.
- **Phase 5:** Test, QA, deploy with rollback plan → **get approval before deploy.**

## Blocked on (need from owner)

- Supabase dashboard access to confirm whether project `reoclbbidpqcvpsfhggl` is paused/deleted.
- Correct Supabase connection strings for local `.env.local` (or confirm the `.env.vercel` values).
- Vercel env confirmation (does the deployed app actually have `CRON_SECRET`/`PAYSTACK_*`?).

## Key files

- `AUDIT.md` — full Phase 1 findings, ranked Critical/High/Medium/Low.
- `lib/scraper.ts` — core pipeline (needs hardening first).
- `prisma/schema.prisma` — schema (needs job fields).
- `app/page.tsx` — dashboard (needs redesign).
