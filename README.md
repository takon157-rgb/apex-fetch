# ⚡ ApexFetch

> High-velocity, AI-powered remote job lead discovery and operations platform.

ApexFetch aggregates, evaluates, and ranks targeted career opportunities from 14+ live RSS sources in real-time. By combining lightning-fast native XML parsing with automated Gemini AI scoring and automated proposal pipelines, it transforms raw job boards into a high-converting pipeline.

🚀 **Built for speed. Optimized for deployment on Vercel.**

---

## 🛠️ The Tech Stack

- **Core Framework:** Next.js 14 (App Router)
- **Authentication:** Clerk (Passwordless + Google SSO Magic Links)
- **Database Engine:** PostgreSQL managed via Prisma ORM
- **Intelligence Layer:** Google Gemini API (Job scoring, summary metrics, & custom proposal drafting)
- **Data Ingestion:** Native RSS fetching via Cheerio / fast XML parser + isolated Playwright background workers
- **Interface Design:** Tailwind CSS with fluid custom dark-mode animations

---

## 🔥 Key Features

- **Multi-Source Aggregation:** Real-time ingestion from 14 premium remote tech channels including *RemoteOK, WeWorkRemotely, Himalayas, Remotive, Reddit (r/forhire), CryptoJobsList,* and more.
- **AI-Powered Deep Filtering:** Deep intelligence scoring. Every lead is evaluated for real-time profitability, complexity grading, and instant personalized cold proposal generation.
- **Granular Skill Vectors:** Instant routing for modern high-ticket positions: *AI Automation, Video Editing, Appointment Setting, and Tech Operations.*
- **One-Click Delivery:** Native Discord integration allowing webhook-driven alerts directly to your target channels.
- **Admin Command Center:** Complete control panel to manage registered users, track platform credits, and toggle user subscription access manually.
- **Hyper-Local Lead Scraper:** Embedded Google Maps engine designed to instantly extract high-converting local agency workflows.

---

## ⚙️ Environment Configuration

Create a local environment file by duplicating the template:

```bash
cp .env.example .env.local
```

| Variable | Focus Area | Impact / Role |
|---|---|---|
| `DATABASE_URL` | Infrastructure | Connection string to your live PostgreSQL database |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Security | Public identifier for the Clerk authentication flow |
| `CLERK_SECRET_KEY` | Security | Backend authorization secret for Clerk routines |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Routing | `/sign-in` path |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Routing | `/sign-up` path |
| `CLERK_WEBHOOK_SECRET` | Synchronization | Real-time database sync for webhooks |
| `GEMINI_API_KEY` | Intelligence | Powers core job parsing and automated analysis |
| `OPENAI_API_KEY` | Intelligence | Auxiliary generation and backup model tasks |
| `ADMIN_CLERK_ID` | Access Control | The master user ID granted complete backend override controls |
| `NEXT_PUBLIC_STRIPE_LINK` | Monetization | Target checkout link for client tier upscaling |

---

## 🏎️ Getting Started

**1. Initialize Dependencies**
```bash
npm install
```

**2. Prepare the Database Layout**
```bash
# Generate the localized type definitions
npm run db:generate

# Sync your Postgres target schema with the state definition
npm run db:push
```

**3. Fire up the Engine**
```bash
npm run dev
```

---

## 📦 Build & Production Optimization

To generate an optimized production bundle ready for Vercel edge deployment:

```bash
npm run build
```

> Note: The compilation script automatically executes internal type-checking and updates client Prisma schemas sequentially before assembling production assets.

---

## 🛠️ CLI Toolkit Reference

| Command | Action Scope |
|---|---|
| `npm run dev` | Spins up the local web engine interface |
| `npm run build` | Compiles codebase for live cloud environments |
| `npm run db:migrate` | Commits structural state migrations to the live database |
| `npm run db:studio` | Launches visual Prisma client to manipulate raw tables |
| `npm run worker` | Initiates the Playwright headless fallbacks (`scripts/ser.js`) |

---

## 📄 License

Distributed under the MIT License.
