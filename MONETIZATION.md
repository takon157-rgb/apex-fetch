# ApexFetch — Monetization Plan

**Prepared:** 2026-10-11
**Inputs:** `RESEARCH.md` (competitive monetization), `pricing-strategist`, `saas-metrics-coach`, `marketing-strategy-pmm` skills.

---

## Bottom line up front

You can make money three ways, in this order of realism for a solo build:

1. **B2B subscription for the lead-gen tool** (strongest — you already have 80% of it).
2. **Employer-paid job postings** on the job board (the RemoteOK model — needs traffic first).
3. **Candidate premium** (instant alerts / advanced filters / salary insights).

The honest truth: **job seekers don't pay.** LinkedIn charges *recruiters*, not candidates. Your current "candidate pays credits to scrape" model fights the grain. The product you've actually built is a **lead-generation engine**, and that's what people pay for.

---

## 1. What you actually have (two surfaces, two customers)

| Surface | Who uses it | Do they pay? |
|---|---|---|
| **Remote job board** (8 scraped sources) | Job seekers / freelancers hunting gigs | ❌ Rarely. Seekers expect free. |
| **Local business lead gen** (Google Maps + AI cold-call scripts + email pitches) | Agencies, freelancers, solo operators selling to local businesses | ✅ Yes — this is a B2B painkiller |

Your existing monetization skeleton (Paystack + credits + `isSubscribed`) is aimed at the **wrong side** — it charges candidates to use the job board. That's the hardest thing to sell.

---

## 2. The model (pricing-strategist lens)

**Forcing question:** *"Is your customer paying for outcomes, seats, or usage?"*

- **Local lead-gen buyer** pays for **outcomes** → a qualified prospect + a ready-to-send pitch = hours of manual work saved. → **Value-based subscription.**
- **Job seeker** pays for **convenience/speed** (get the good jobs first) → thin premium, mostly free. → **Freemium.**

**Model decision:** keep the job board **free** (it's your traffic engine + SEO moat). Put the **B2B lead-gen tool on a flat subscription** with lead quotas. Kill the credit-gated scraping on the job board — it's an anti-pattern ("hidden usage-based pricing inside a subscription") and it chokes your own growth.

---

## 3. Ranked revenue streams

### 🥇 Stream 1 — B2B subscription: "Local Business Lead Finder" (build on what exists)

Agencies, web designers, SEO freelancers, and local-service sellers pay monthly for:
- Unlimited (or tiered) local businesses **without a website** in their niche + city.
- AI cold-call script + email pitch per lead (you already generate these).
- CSV export + CRM status tracking.

**Price anchor (competitors):** Apollo.io $49–$79/mo, UpLead $99+/mo, Instantly $37–$97/mo.

**Your range:** **$29 Starter / $79 Pro / $199 Agency** (seats + lead volume tiers).

**Why it wins:** B2B buyers pay for saved prospecting time; you already have the scraper + AI scripts working. Lowest-effort, highest-margin revenue.

### 🥈 Stream 2 — Employer-paid job postings (RemoteOK model)

Employers pay to **feature** a listing above scraped results. Scraped jobs stay free (inventory); featured jobs are clearly labeled.

- **Range:** **$49–$99 per 30-day featured post** while you're small; move toward RemoteOK's $299 once you have traffic.
- Add-ons: "highlight", "pin to top", "featured employer profile".

**Why it's #2 not #1:** requires candidate traffic first. A job board with no candidates has nothing to sell employers. This becomes your main revenue **after** Stream 1 funds growth.

### 🥉 Stream 3 — Candidate premium (thin, freemium)

- **$9–$19/mo:** instant alerts (vs daily), advanced filters (exact salary/timezone/stack), "apply-first" early access, no ads.
- Free tier: browse + daily digest — enough to grow the email list.

**Why it's #3:** small ticket, but it's recurring and zero inventory cost. RemoteOK's premium is roughly this.

### Stream 4 — Affiliate (passive, zero-maintenance)

- Job-search/resume tools, nomad insurance (SafetyWing), VPN, courses.
- Add affiliate links where relevant. Only after traffic exists.

### Stream 5 — API / data licensing (later, once volume matters)

- Charge for a clean JSON API of scraped + enriched jobs. (RemoteOK/Himalayas give it away free to grow; you gate/rate-limit a paid tier later.)

---

## 4. Unit-economics reality check (saas-metrics-coach)

Before you spend anything, know the numbers that matter:

| Metric | Target | Why |
|---|---|---|
| **LTV:CAC ≥ 3:1** | Each customer must return 3× acquisition cost | Below this, you lose money growing |
| **Monthly churn < 5%** (B2B) | Keep customers ~20+ months | The #1 killer of solo SaaS is churn, not lack of sales |
| **CAC payback < 6 months** | Recoup cost fast | You're bootstrapped — long payback = dead |

**The blunt version:** a $49/mo B2B subscription with 3% churn → LTV ≈ $1,600. So your **cost to acquire one customer (CAC) must stay under ~$500**. That means: founder-led sales, SEO, and referrals — **not** paid ads (paid ads for a $49 product with a new landing page will burn cash). At your stage, acquisition = "I personally DM 20 agencies a day" or "SEO on long-tail local-service keywords."

---

## 5. Positioning (marketing-strategy-pmm)

**Current problem:** the site has no clear "who it's for." It's half job board, half lead-gen tool, branded "AI-powered career opportunities."

**One-line repositioning (April Dunford):**

> *For local web-design and marketing freelancers who waste hours finding businesses that need them, ApexFetch is a lead-finder that hands you no-website businesses plus a ready cold-call script — unlike generic job boards or manual Google Maps browsing.*

**Job board side** keeps a separate, honest promise: *"remote jobs, salary and location upfront, newest first."*

Two products, two landing pages, two clear promises. Right now they're merged and it confuses both buyers.

---

## 6. What to do first (next 30 days)

1. **Flip the billing:** make the job board free; put the local-lead-gen tool behind a $29/$79/$199 subscription. (You already have Paystack + `isSubscribed` + admin — mostly a wiring change.)
2. **Pick ONE niche** for the lead-gen tool (e.g., "web designers prospecting for businesses without sites"). Niche beats broad.
3. **Set up the health/monetization loop:** track signup → activation (first lead exported) → paid → churn. `GET /api/source-health` and `GET /api/health` already exist — add a revenue/cohort view later.
4. **Acquire manually:** 20 DMs/day to agencies, post in r/web_design + r/smallbusiness, write 3 SEO pages on long-tail local keywords.
5. **Defer:** employer postings and candidate premium until the job board has real traffic (a few hundred DAU).

---

## 7. Deferred / needs accounts

- Paystack live keys (currently missing in prod) — required before any of Stream 1/3 can collect money.
- Redis (Upstash) rate limiting, Sentry — nice-to-have, not monetization-blocking.
