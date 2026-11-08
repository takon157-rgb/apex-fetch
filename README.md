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

Plus a **company career-page discovery** pass that resolves domains from previously seen postings and scrapes their boards directly.

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
- PDF resume generation and attachment.
- Approval Queue with approve / skip / send, and a daily send cap.
- Tracker showing every application and its status: `found → drafted → approved → sent → replied → interview → rejected`.

### Platform
- Per-user data isolation — every lead, profile and preference is scoped by user id.
- Admin dashboard with user management, subscription toggles and platform stats.
- Per-user blocklist applied during every scrape.
- Discord dispatch for high-scoring leads.
- Scheduled daily scrape and a weekly worker via GitHub Actions.
- Paystack subscription flow with signature-verified webhooks.

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
npm test          # 85 unit tests across the pure scoring/parsing/filter cores
npx tsc --noEmit  # type check
npm run build     # production build
```

The test suite covers board parsers (Greenhouse, Ashby, Arbeitnow, Jobicy, Himalayas), the canonical job-type vocabulary across six languages, remote detection, the feed query builder, source grouping, resume-fit scoring, draft verification and the send rails.

Live-data harnesses (need `DATABASE_URL`):

| Script | Checks |
|---|---|
| `node scripts/smoke-sources.mjs` | Every source is reachable and returns items |
| `node scripts/test-parsers.mjs` | Parsers against live API responses |
| `node scripts/e2e-scrape.mjs` | Full pipeline against the real database |
| `node scripts/verify-filters.mjs` | Every feed filter returns real rows |
| `node scripts/verify-feed.mjs` | Feed depth, source diversity, ordering stability |
| `node scripts/verify-freshness.mjs` | Posted-date coverage and expiry handling |
| `node scripts/backfill-job-attrs.mjs` | Normalise job type / remote across stored leads |

---

## 🔐 Security notes

- Every route requires a Clerk session; API routes return `401` and pages redirect to sign-in.
- All lead queries are scoped by `userId` — one user can never read or act on another's leads.
- The stored resume PDF is **never** returned to the browser; the API reports only whether one exists, and server-side routes read it directly.
- Webhook signatures use constant-time comparison (`crypto.timingSafeEqual`).
- The rate limiter is bounded and self-sweeping, so it can't grow without limit.
- No `.env` file is tracked by git; `.env.example` contains placeholders only.
- The admin dashboard is gated by `ADMIN_CLERK_ID` server-side and rate limited.

---

## 📦 Deployment

The app deploys to Vercel with Supabase as the database.

```bash
vercel link
vercel --prod
```

Set every environment variable from the table above in the Vercel project settings. `.github/workflows/` runs the daily scrape and weekly worker on a schedule.

---

## 📄 License

MIT.
