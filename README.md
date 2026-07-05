# ⚡ ApexFetch

> High-velocity, AI-powered remote job lead discovery and operations platform.

ApexFetch aggregates, evaluates, and ranks targeted career opportunities from 14+ live sources in real-time. By combining RSS/API feed parsing with automated Gemini AI scoring, resume-tailored filtering, and Discord dispatch, it transforms raw job boards into a high-converting pipeline.

---

## 🛠️ The Tech Stack

- **Core Framework:** Next.js 14 (App Router)
- **Authentication:** Clerk (Passwordless + Google SSO Magic Links)
- **Database:** PostgreSQL via Supabase, managed through Prisma ORM
- **AI Layer:** Google Gemini API (Job scoring, resume tailoring, proposal drafting)
- **Scraping:** Native RSS/JSON feed ingestion + Playwright headless workers
- **UI:** Tailwind CSS with dark-mode design

---

## 🔥 Key Features

### Unified Scraper Pipeline
- **14 sources** scraped sequentially with rate-limit delays: Reddit (JSON API), RemoteOK (API), Remotive, WeWorkRemotely, Himalayas, AuthenticJobs, StackOverflow, CryptoJobsList, WorkingNomads, Indeed, LandingJobs, Jobicy, CareerNest, Workbeam
- **Progress tracking** — real-time progress bar showing per-source status during pull
- **Trend discovery** — Playwright workers identify trending company domains from job boards
- **Source health monitoring** — every scrape records per-source success/failure

### AI-Powered Resume-Tailored Filtering
- Every job is scored against your **target roles, core skills, and parsed resume summary**
- Jobs matching your profile keywords receive score bonuses
- Gemini AI can be called per-job for deep analysis with resume context injected into the prompt

### Smart Feed Pruning
- On each pull, low-scored entries (aiScore < 8) are automatically archived unless tracked or applied
- Only high-quality leads (score 8-10) survive alongside your tracked/applied entries

### Dashboard Controls
- **Track** — mark leads for follow-up (persisted to DB)
- **Apply** — mark leads as applied with timestamp
- **Profile** — send any job to the Career Workspace for AI resume tailoring
- **Send to Discord** — manually dispatch any lead to your configured webhook
- **Delete / Purge** — per-row deletion that persists permanently
- **Restore** — recover deleted leads from the Trash Bin

### Blocklist Management
- Add keywords to filter unwanted postings (e.g., "blockchain", "crypto")
- Blocklist is stored per-user and applied during every scrape

### Career Profile Workspace
- Upload resume (PDF/DOC) or paste text
- Send jobs for review and generate AI-tailored resumes via Gemini
- Full history of reviewed jobs with tailored resume viewer

### Discord Integration
- Configure your webhook URL in Profile settings
- Auto-dispatch high-scoring leads (score >= 7) during scrape
- Manual dispatch per-lead from the dashboard
- Webhook test button in settings

### Admin Command Center
- User management with Upgrade/Demote subscription toggling
- Set credits per user
- Platform stats: total users, leads, subscribed vs free users

### Auto-Scrape Cron
- Scheduled endpoint (`/api/cron/scrape`) for automatic scraping of subscribed users
- Protected by `CRON_SECRET` header

### Local Lead Scraper
- Embedded Google Maps Places API engine for local business discovery
- AI-generated cold call scripts and email pitches

---

## ⚙️ Environment Configuration

Create `.env.local` from the template:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) |
| `DIRECT_URL` | Direct connection for migrations |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret |
| `GEMINI_API_KEY` | Google Gemini API key for AI features |
| `GEMINI_MODEL` | Gemini model name (default: `gemini-2.5-flash`) |
| `ADMIN_CLERK_ID` | Clerk user ID granted admin access |
| `NEXT_PUBLIC_ADMIN_CLERK_ID` | Public admin ID for frontend checks |
| `CRON_SECRET` | Secret for authenticating cron requests |
| `NEXT_PUBLIC_STRIPE_LINK` | Stripe checkout link for upgrades |
| `SUPABASE_URL` | Supabase project URL (for storage) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (for resume storage) |
| `DISCORD_WEBHOOK_URL` | Fallback global Discord webhook URL |

---

## 🏎️ Getting Started

**1. Install dependencies**
```bash
npm install
```

**2. Sync the database schema**
```bash
npx prisma db push
```

**3. Start the dev server**
```bash
npm run dev
```

**4. Open the app**
Navigate to `http://localhost:3000` and sign in via Clerk.

---

## 📦 Build for Production

```bash
npm run build
```

The build compiles TypeScript, generates the Prisma client, and assembles an optimized production bundle ready for Vercel deployment.

---

## 🛠️ CLI Toolkit

| Command | Action |
|---|---|
| `npm run dev` | Start local development server |
| `npm run build` | Build for production |
| `npx prisma db push` | Sync schema to database |
| `npx prisma studio` | Open Prisma data browser |
| `npx prisma migrate dev` | Create and apply migrations |
| `npm run worker` | Run Playwright side scraper (`scripts/ser.js`) |

---

## 📄 License

Distributed under the MIT License.
