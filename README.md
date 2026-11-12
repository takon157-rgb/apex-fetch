# 🚀 JobPilot

> Finds real job openings, ranks them against your resume, tailors an application for every good match, and sends nothing without your approval.

JobPilot is a job-search automation platform. It ingests live postings from **34 sources** — company career boards plus remote/freelance job boards — ranks them against your resume, drafts tailored applications, and holds every outbound email in an approval queue for a human to release.

---

## 🎯 What it actually does

1. **Finds real jobs.** 21 company career boards (Greenhouse + Ashby) and 13 aggregator feeds, scraped on demand or on a daily cron. No mock data, no placeholder rows.
2. **Ranks by resume fit.** Every lead is scored against your target roles, core skills and parsed resume — with an optional LLM pass for deeper analysis.
3. **Tailors applications.** Generates a tailored resume and a cover email per job, then checks the draft against your master resume to flag anything it can't support.
4. **Never sends without approval.** Drafts wait in the Approval Queue. A daily cap limits how many applications can go out, and every send is recorded in the Tracker.

---

## 🛠️ Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Auth | Clerk (email + Google) |
| Database | PostgreSQL (Supabase) via Prisma |
| UI | Tailwind CSS, dark theme |
| AI | Gemini (scoring, tailoring, drafting) with a deterministic offline fallback |
| Payments | Paystack (subscriptions) |
| Hosted | Vercel + Supabase |

---

## 📡 Sources

**Company boards (21)** — each a live Greenhouse or Ashby endpoint:
Stripe, OpenAI, Anthropic-adjacent boards, Vanta, Sentry, Linear, Notion, Perplexity, Ramp, Figma, Instacart, Gusto, Discord, Cursor, OpenRouter, Replit, Resend, MongoDB, Elastic, GitLab, Reddit, Robinhood.

**Aggregators (13)** — RemoteOK, Remotive, WeWorkRemotely, Himalayas (×2 pages), WorkingNomads, AuthenticJobs, Jobicy (main + part-time + contract + internship feeds), LandingJobs, Arbeitnow.

Plus a **company career-page discovery** pass that resolves domains from previously seen postings and scrapes their boards directly. You can also add your own career pages under **Profile → Target Sites**; those are stored per account and take priority over the ones inferred automatically.

Every source is health-checked on each run; failures are reported per source rather than silently dropping the run.

---

## ✨ Features

### Feed
- **Source-balanced ordering.** Leads are interleaved by board so one high-volume aggregator can't take over the page. Page 1 typically shows 25+ distinct sources.
- **Infinite scroll** with an accessible "Load more" fallback. The candidate list is fetched once and reused, so scrolling never repeats or skips a job.
- **Server-side filters** that narrow the whole feed, not just loaded rows: source, job type, remote, minimum salary, niche keywords, free-text search, and freshness.
- **Live filter counts.** The job-type dropdown shows exactly how many jobs each option will yield before you click it.
- **Expired-posting control.** A freshness window hides stale leads, with a running count of how many are hidden. Himalayas postings are additionally dropped when their own expiry date has passed.

### Resume matching
- Deterministic heuristic scoring (no API key needed) with an optional LLM refinement.
- Matched skills, missing skills, and a plain-English reason for every lead.
- Skill-gap view on the Profile page.

### Applications
- Tailored resume + cover email generated per job.
- A verification pass flags claims in the draft that the master resume doesn't support.
- **Live resume preview** in the Approval Queue — the tailored resume renders as a real A4 document, not a wall of text.
- **Four document templates** (ATS Safe, Modern, Classic, Compact) and one-click export to PDF (browser print-to-PDF) or an editable Word file.
- PDF resume generation and attachment for the outbound email.
- Approval Queue with approve / skip / send, and a daily send cap.
- Tracker showing every application and its status: `found → drafted → approved → sent → replied → interview → rejected`.

### Platform
- Per-user data isolation — every lead, profile and preference is scoped by user id.
- Admin dashboard with user management, subscription toggles and platform stats.
- Per-user blocklist applied during every scrape.
- **Bulk cleanup controls** — "Empty trash" permanently removes every trashed lead in one server-side query, and "Clear old" removes leads older than 30 days (leads you already applied to are always kept).
- Discord dispatch for high-scoring leads.
- Scheduled daily scrape and a weekly worker via GitHub Actions.
- Paystack subscription flow with signature-verified webhooks, and a public pricing page.

---

## ⚙️ Setup

**1. Install**
```bash
npm install
```

**2. Configure** — copy `.env.example` to `.env.local` and fill in the values:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection string |
| `DIRECT_URL` | Direct (non-pooled) connection for migrations |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret |
| `GEMINI_API_KEY` | Gemini key for AI scoring/tailoring (optional) |
| `GEMINI_MODEL` | Gemini model id (default `gemini-2.5-flash`) |
| `ADMIN_CLERK_ID` | Clerk user id granted admin access |
| `NEXT_PUBLIC_ADMIN_CLERK_ID` | Same id, for client-side checks |
| `CRON_SECRET` | Secret header for cron endpoints |
| `CRON_INCLUDE_FREE_USERS` | `false` restricts the daily scrape to paid accounts (default `true`) |
| `SCRAPE_BATCH_SIZE` | Sources processed per serverless slice (default 4) |
| `SCRAPE_SOURCE_TIMEOUT_MS` | Per-request timeout during a scrape (default 6000) |
| `SCRAPE_SOURCE_RETRIES` | Retries per request during a scrape (default 1) |
| `SCRAPE_BATCH_BUDGET_MS` | Wall-clock budget for one slice (default 35000) |
| `SCRAPE_DISCOVERY_BUDGET_MS` | Wall-clock budget for career-page discovery (default 20000) |
| `WORKER_DOMAINS_PER_CALL` | Company domains visited per weekly-worker call (default 2) |
| `WORKER_CALL_BUDGET_MS` | Wall-clock budget for one worker call (default 25000) |
| `PAYSTACK_SECRET_KEY` | Paystack API secret |
| `PAYSTACK_WEBHOOK_SECRET` | Paystack webhook signing secret |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (resume storage) |
| `DISCORD_WEBHOOK_URL` | Fallback global Discord webhook |
| `NEXT_PUBLIC_STRIPE_LINK` | Checkout link for upgrades |

**3. Sync the schema**
```bash
npx prisma db push
```

**4. Run**
```bash
npm run dev
```
Open `http://localhost:3000` and sign in with Clerk.

---

## 🧪 Verification

```bash
npm test          # 96 unit tests across the pure scoring/parsing/filter/document cores
npx tsc --noEmit  # type check
npm run build     # production build
```

The test suite covers board parsers (Greenhouse, Ashby, Arbeitnow, Jobicy, Himalayas), the canonical job-type vocabulary across six languages, remote detection, the feed query builder, source grouping, resume-fit scoring, draft verification, the resume document renderer and the send rails.

Live-data harnesses (need `DATABASE_URL`):

| Script | Checks |
|---|---|
| `node scripts/smoke-sources.mjs` | Every source is reachable and returns items |
| `node scripts/test-parsers.mjs` | Parsers against live API responses |
| `node scripts/e2e-scrape.mjs` | Full pipeline against the real database |
| `node scripts/verify-scrape-batches.mjs` | The resumable batch pipeline runs every source within the serverless time budget |
| `node scripts/verify-cron-scrape.mjs` | The daily cron endpoint resumes across calls and leaves no session stuck running |
| `node scripts/verify-filters.mjs` | Every feed filter returns real rows |
| `node scripts/verify-feed.mjs` | Feed depth, source diversity, ordering stability |
| `node scripts/verify-freshness.mjs` | Posted-date coverage and expiry handling |
| `node scripts/backfill-job-attrs.mjs` | Normalise job type / remote across stored leads |
| `node scripts/db-status.mjs` | Per-user lead counts, job-type / remote distribution, freshness |
| `node scripts/check-credits.mjs` | Credit balances and the scrape-session history |
| `node scripts/check-links.mjs` | Every internal link resolves to a route that exists |
| `node scripts/cleanup-stuck-sessions.mjs` | Closes scrape sessions left running by a killed invocation |

---

## ⏱️ How scraping survives serverless

A full pull across 34 boards takes minutes. A serverless function is killed
long before that, and because the original implementation ran the pipeline as
an unawaited background promise, every live run died the moment the response
was sent — leaving sessions stuck at `running, 0 sources`.

The pipeline is now **resumable**:

- `runScrapePipeline` accepts a slice of sources (`sourceOffset`, `sourceLimit`) and a time budget.
- `POST /api/scrape` performs one bounded slice per request and records where it stopped.
- The dashboard drives the slices until the server reports the run is complete.
- Credits are charged once per run, not once per slice.

Each slice takes roughly 6–13 seconds, well inside a 60-second function limit.
`scripts/verify-scrape-batches.mjs` exercises exactly this path against the
live database.

Tunable with environment variables: `SCRAPE_BATCH_SIZE` (default 4),
`SCRAPE_SOURCE_TIMEOUT_MS` (6000), `SCRAPE_SOURCE_RETRIES` (1),
`SCRAPE_BATCH_BUDGET_MS` (35000), `SCRAPE_DISCOVERY_BUDGET_MS` (20000).

### The scheduled jobs use the same trick

`GET /api/cron/scrape` and `GET /api/cron/worker` had the same fatal flaw:
each one tried to walk every source (or every company domain) inside a single
invocation, so the platform killed them partway through and the daily job
quietly did nothing.

Both endpoints now do one bounded slice per call and report `done: false`
while there is more to do. The GitHub Actions workflows loop until the
response says `"done": true`:

- `.github/workflows/daily-scrape.yml` — one slice per call, up to 120 calls.
- `.github/workflows/weekly-worker.yml` — one domain slice per call, following
  the `nextOffset` the endpoint returns.

The daily job refreshes every account that could pull jobs for itself
(subscribed **or** still holding credits). Restricting it to paid accounts
turned the schedule into a no-op, and a stale feed is the opposite of what
JobPilot promises. Set `CRON_INCLUDE_FREE_USERS=false` to restrict it to
paid accounts.

`scripts/verify-cron-scrape.mjs` drives the cron endpoint the same way the
workflow does and checks that no session is left stuck at `running`.

---

## 🔐 Security notes

- Every route requires a Clerk session; API routes return `401` and pages redirect to sign-in.
- All lead queries are scoped by `userId` — one user can never read or act on another's leads.
- The stored resume PDF is **never** returned to the browser; the API reports only whether one exists, and server-side routes read it directly.
- Webhook signatures use constant-time comparison (`crypto.timingSafeEqual`).
- The rate limiter is bounded and self-sweeping, so it can't grow without limit.
- No `.env` file is tracked by git; `.env.example` contains placeholders only.
- The admin dashboard is gated by `ADMIN_CLERK_ID` server-side and rate limited.
- Scrape targets are stored per account and validated on write: only public `http(s)` URLs are accepted, and loopback, private, link-local and cloud-metadata addresses are rejected — the server fetches these, so an unchecked URL would be a server-side request forgery hole.

---

## 📦 Deployment

The app deploys to Vercel with Supabase as the database.

**Live production URL:** <https://apex-fetch-takon157-rgbs-projects.vercel.app>

### GitHub → Vercel (the supported path)

The repository is connected to a Vercel project with the GitHub integration.
**Every push to `main` triggers a production deployment automatically** — no
CLI, no manual step. The repo has a single branch (`main`); there is no
second project folder in the repository.

### Manual CLI deploy

```bash
vercel link
vercel --prod
```

### Two settings to check before inviting real users

| Setting | Where | Why it matters |
|---|---|---|
| **Deployment Protection** | Vercel → Settings → Deployment Protection | While "Vercel Authentication" is on, every route redirects to a Vercel SSO login, so nobody outside the team can reach the app. Turn it off for Production. |
| **Clerk instance** | Clerk dashboard → API keys | A `pk_test_` publishable key points at Clerk's **development** instance: sign-ups do not deliver real email and the user cap applies. Use a `pk_live_` key from a production Clerk instance. |

Set every environment variable from the setup table above in the Vercel project
settings. `.github/workflows/` runs the daily scrape and weekly worker on a
schedule.

### Database

Local and Vercel both point at the same Supabase Postgres instance, so a
scrape run locally is visible on the live site immediately. On the free tier
Supabase pauses an idle project after a week — `scripts/restore-supabase.ps1`
wakes it back up. The pooler allows only 15 concurrent sessions, so the
parallel board queries run through a bounded-concurrency helper rather than
opening a connection per source.

---

## 📄 License

MIT.
