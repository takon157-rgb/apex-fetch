# ApexFetch

**AI-powered remote job lead discovery and operations platform.**  
Aggregates and analyzes job listings from 14+ RSS sources in real time, applies AI scoring/profitability analysis, and streamlines the application pipeline.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Auth:** Clerk (email/passwordless + Google SSO)
- **Database:** PostgreSQL via Prisma ORM
- **AI:** Google Gemini API for job evaluation & proposal generation
- **Scraping:** Native RSS fetching (cheerio/xml parsing) + Playwright workers for fallback
- **UI:** Tailwind CSS + custom dark theme animations
- **Deployment:** Vercel-ready

## Key Features

- **14 Live RSS Feeds** – RemoteOK, WeWorkRemotely, Himalayas, Remotive, StackOverflow, Reddit (r/forhire), AuthenticJobs, WorkingNomads, CryptoJobsList, LandingJobs, CareerNest, Jobicy, Workbeam, YayRemote
- **AI Job Evaluation** – Each job gets a score, profitability estimate, difficulty rating, summary, and auto-generated proposal via Gemini
- **Industry Filtering** – Filter by AI Automation, Video Editing, Appointment Setter, Social Media, Virtual Assistant, Entry Level
- **Platform Filter** – Top 5 sources shown inline, remaining in expandable dropdown
- **Discord Integration** – Send jobs to a Discord channel with one click
- **Admin Panel** – Manage users, toggle subscriptions, assign credits
- **Local Business Lead Scraper** – Google Maps lead extraction for appointment-setter workflows
- **Resume Manager** – Upload and store resumes for auto-applications

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Publishable Key |
| `CLERK_SECRET_KEY` | Clerk Secret Key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/` |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret |
| `GEMINI_API_KEY` | Google Gemini API key |
| `OPENAI_API_KEY` | OpenAI API key (proposal generation) |
| `ADMIN_CLERK_ID` | Clerk user ID of the admin |
| `NEXT_PUBLIC_ADMIN_CLERK_ID` | Same, public-facing |
| `NEXT_PUBLIC_STRIPE_LINK` | Stripe checkout/test payment link |

## Getting Started

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Start dev server
npm run dev
```

## Build

```bash
npm run build
```

The build command runs `prisma generate` then `next build`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Prisma generate + Next build |
| `npm run start` | Start production server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run worker` | Run Playwright worker (`scripts/ser.js`) |

## License

MIT
