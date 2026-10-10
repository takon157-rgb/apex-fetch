# Competitive Research: Remote Job Aggregators

**Scope:** Patterns worth adopting for a Next.js dashboard that scrapes jobs from Telegram/LinkedIn/RemoteOK/Remotive/etc. and renders them as cards.
**Method:** Web research on 8 platforms (features + UI verified via help docs, reviews, and live pages as of Oct 2026). Anything I could not verify is marked "unverified" and omitted.

---

## 1. Executive Summary

The category splits into three archetypes, and each teaches a different lesson for a solo-built aggregator:

1. **Mass aggregators** (Indeed, LinkedIn, Glassdoor) — huge inventory, deep facet filters, alert infrastructure. Lesson: the *filter surface* is table stakes and cheap to copy.
2. **Curated niche boards** (RemoteOK, We Work Remotely, Himalayas) — smaller, high-signal, remote-only. Lesson: **salary transparency + a remote/tag taxonomy is the entire product.** These are the closest direct competitors and the easiest to beat on UX.
3. **Quality matchers** (Wellfound, Otta/Welcome to the Jungle) — reduce noise via profile + "match" logic rather than a search box. Lesson: the killer differentiator is **telling the user *why* a job is shown.**

The single most valuable and feasible cluster to copy: **RemoteOK's tag/salary system + Himalayas' timezone filter + Indeed's date/sort/alert controls + Otta's "why this matches" framing.** Monetization for a small aggregator points overwhelmingly at RemoteOK's playbook: free browsing, paid job posting, and a thin candidate-premium tier.

---

## 2. Per-Platform Findings

### Indeed (mass aggregator)
- **Filters:** pay range, work setting (remote/hybrid/in-person toggle), job type (full/part/contract/temp/internship), experience level, education, skills, company, location + radius (5–50mi), date posted (24h/3d/7d/30d), benefits (health, 401k, PTO, remote), salary-estimate filter.
- **Job card:** title, company, location, snippet, salary estimate, posting date, company rating. Left-rail facet panel.
- **Alerts:** job alerts per saved search; frequency daily vs real-time ("immediate"); multiple alerts managed from dashboard; works without an account (email-only).
- **Saved/apply tracking:** saved jobs, Easy Apply (one-click inline), resume upload, "applied" state tracked.
- **Relevance/speed:** relevance vs date sort toggle; advanced operators (`title:"designer" -intern (remote OR hybrid)`); AI "Career Scout" conversational search on mobile.
- **Monetization:** pay-per-click sponsored listings, employer subscriptions, Indeed Resume (candidate product), promoted placements.
- **Distinctive:** salary-estimate filter doubles as a spam filter — it removes "no pay info" postings, which correlate with low quality. Company reviews/salary pages.

### Wellfound (startup jobs, ex-AngelList)
- **Filters:** remote preferences, **salary & equity range**, job type, keywords, company size/stage, YC/unicorn flags (verified via scraper schema).
- **Job card:** title, company + logo, **salary + equity ranges shown upfront**, remote tag, company stage/funding, "apply in one click."
- **Alerts:** unverified specifics; profile-driven recommendations rather than classic saved-search alerts.
- **Saved/apply:** one-click apply, talk directly to founders, single reusable profile.
- **Monetization:** free to post base; Recruit Pro ~$499/mo; AI sourcing agents; dedicated-recruiter marketplace. Free for candidates.
- **Distinctive:** **compensation transparency as a brand** (salary AND equity before you click). 27,000+ startups, 10M+ candidates.

### RemoteOK (indie remote board, Pieter Levels)
- **Filters:** **tag-based** (React, Python, AWS, function, salary range, location restrictions); salary range slider/min; benefits toggles (401k, vision, 4-day, distributed team).
- **Job card:** compact row — company, title, **salary tag**, stack tags, posted date, company logo/brand color.
- **Sorts:** 🆕 Latest, 💵 Highest paid, 👀 Most viewed, ✅ Most applied, 🔥 Hottest, 🎪 Most benefits.
- **Alerts:** daily job alerts (free); Premium "instant alerts" the moment a matching job posts.
- **Saved/apply:** no account needed to browse; built-in apply form or external link; no candidate tracking.
- **Relevance/speed:** dense single-page feed, "compact mode," dark mode; "Clear results" + per-filter "remove this filter" chips.
- **Monetization:** **$299–$599 per 30-day listing** (one-time, no subscription); highlighted/sticky placement; cross-post bundles to Nomad List; **candidate Premium subscription** (apply-first, show-up-first, advanced filters, salary insights, no ads); **free public API/RSS/JSON feed** (`remoteok.com/api`, `?tag=dev`).
- **Distinctive:** **#OpenSalaries** — salary transparency is the tagline. Public API drives inbound traffic and third-party apps.

### We Work Remotely (remote board)
- **Filters:** categories (programming, design, marketing, customer support, copywriting, executive), **regions/time-zones**, country; salary/engagement-type via scraper.
- **Job card:** title, company, category, region, salary band (where provided). Traditional clean list, company pages.
- **Alerts:** **per-category RSS feeds** (public); tailored view filtered by region/timezone (via account).
- **Monetization:** **$299 per 30-day listing** + visibility add-ons; now also pushing an adjacent product (global contractor payroll/EOIR, "$19/worker/mo") as a cross-sell.
- **Distinctive:** strongest *category taxonomy* of the remote boards; RSS per category is a low-friction distribution channel.

### Himalayas (remote board + company profiles)
- **Filters:** **timezone** (unique, explicit "must work these hours"), **country**, **visa**, **salary range**, **seniority level**, **skills/tech stack**, company, employment type.
- **Job card:** title, company + logo, location/region, salary range, seniority, tags.
- **Company profiles:** 25,000+ profiles with benefits, culture, remote policy, tech stack.
- **Alerts:** profile/preference-based matching + standard email alerts (unverified specifics).
- **Free AI tools:** job-specific resume and cover-letter generator (adjacent product hook).
- **Monetization:** **free public JSON API** (pagination, keyword/country/company/seniority/timezone params); paid listings (pricing unverified).
- **Distinctive:** **timezone/visa as first-class filter** — the thing that actually determines whether a remote job is viable; most boards bury it.

### Otta → Welcome to the Jungle (quality matcher)
- **Model:** profile + preference driven *matching*, not a search box. Set role, level, salary, remote, company size, "what you care about" → curated feed **one role at a time** with a **"why this matches you"** reason.
- **Filters (still present):** location/remote (up to 5 cities), contract type, job title (comma-separated multi-role), experience level (0–2/2–5/5–10/10+), minimum salary, industry + sub-sectors, **company size** (startup/SME/mid/large), **employee benefits**, **labels/commitments** (B Corp, gender-equality index, CSR).
- **Job card:** role, company, salary (pushed on companies to provide), match rationale.
- **Company profiles:** best in category — team, funding, product, benefits, sometimes staff interviews, photos/videos/stats.
- **Relevance:** "fewer results is a good sign" positioning; every interaction refines matching; match % surfaced.
- **Monetization:** companies pay to be listed; employer side = Welcome Job Matching / AI-native ATS, candidate scoring, JD-based search.
- **Distinctive:** **match transparency** ("why is this a match?") and **match %**, and the explicit stance that curation beats volume. Acquired 2024; stage bias = funded scaleups (Series A+), weak for seed.

### LinkedIn Jobs (optional — filters/alerts)
- **Filters:** work type (remote/hybrid/on-site), experience level, date posted, company, job type, **Easy Apply** (filter for one-click roles), location.
- **Alerts:** saved searches → email alerts (frequency + daily digest).
- **AI search:** describe the role in natural language; matches intent against descriptions.
- **Monetization:** promoted job posts, Recruiter subscriptions, candidate Premium.
- **Distinctive:** Easy Apply + the "applied" state tied to your identity; network/company insights layered on cards.

### Glassdoor (optional — reviews/salary)
- **Filters:** title, company, location, workstyle; **workplace-factor filters** (work/life balance, culture & values, diversity & inclusion ratings).
- **Job card:** title, company, logo, salary, **company rating**, location.
- **Distinctive:** job listings fused with reviews + salary data + interview insights in one dashboard; ratings as a card field.
- **Monetization:** employer branding / recruiter subscriptions, sponsored jobs.

---

## 3. Features & Design Patterns Worth Adopting

Ranked by **value-to-users × feasibility for a solo Next.js aggregator** (1 = do first).

### Tier 1 — High value, high feasibility (quick wins)

1. **Salary tag + min-salary slider + "highest paid" sort** — *RemoteOK.* The single most copied pattern in the remote niche; trivial to implement when you parse salary from listings, and it instantly differentiates from generic boards.
2. **Remote-only toggle + "work from anywhere" / timezone filter** — *Himalayas (timezone), Indeed (remote/hybrid toggle).* Remote job seekers' #1 question; timezone is just a parsed field.
3. **Tag/tech-stack filter chips with per-filter remove** — *RemoteOK.* Derive tags from scraped keywords; chips + "remove this filter" make faceted search feel instant and reversible.
4. **Date-posted filter + "latest" default sort** — *Indeed, RemoteOK.* Recency is the highest-leverage relevance signal for remote (roles flood fast). Default to newest.
5. **Sort menu: latest / highest-paid / most-viewed** — *RemoteOK.* Gives the feed multiple personalities for free.
6. **Saved searches + email alerts with daily/instant frequency** — *Indeed, RemoteOK premium.* High retention; email-only (no account required) lowers friction.
7. **Left-rail facet panel + keyword search** — *Indeed, LinkedIn, WTTJ.* Users expect it; instant client-side filtering over an already-scraped dataset is cheap.
8. **Experience-level / seniority filter** — *all platforms, especially Himalayas (seniority).* Parse or infer from title/description.

### Tier 2 — High value, medium feasibility (bigger bets)

9. **Match % + "why this matches" line** — *Otta/WTTJ.* Even a naive keyword-overlap score + a one-line reason ("matches your React + remote prefs") is a differentiator that repositions the whole product from search → recommendations.
10. **Salary *and* equity shown on the card** — *Wellfound.* Requires the data (sparse outside startup sources) but is brand-defining when present.
11. **Company size / stage filter + funding flags (YC, unicorn)** — *Wellfound.* Needs company metadata enrichment, but high value for the startup-leaning audience.
12. **Saved jobs + a minimal application tracker (saved → applied → interview, notes)** — *standard across Indeed/LinkedIn; kanban idea.* High retention; needs accounts + persistence.
13. **Rich company profiles** — *Himalayas, WTTJ.* Big content lift, but a profile page per company gives users a reason to return beyond the feed.

### Tier 3 — Medium value, lower feasibility (defer)

14. **Company ratings/reviews on the card** — *Indeed, Glassdoor.* Network-effect content you can't scrape ethically/legally at scale; skip or source via API.
15. **Benefits filter (health/401k/4-day/distributed)** — *Indeed, RemoteOK, WTTJ.* Nice, but requires structured benefits parsing; do after salary.
16. **Public JSON/RSS API** — *RemoteOK, Himalayas, WWR.* Great for distribution and SEO once the core product works; don't build first.
17. **One-role-at-a-time feed** — *Otta.* Opinionated; risky as the *only* mode, but worth an optional "curated" view.
18. **AI conversational search** — *Indeed Career Scout, LinkedIn AI search.* Differentiating but needs an LLM integration; a later, self-contained bet.

---

## 4. Monetization Recommendations

Best fit for a small, solo-built aggregator — modeled on RemoteOK (which is itself a solo build):

1. **Paid job posting (primary).** Charge employers $99–$299 per 30-day listing to "feature" or "promote" a job above scraped results. Scraped jobs remain free (inventory), featured jobs are clearly labeled. *Why:* zero ongoing infra, filters for serious employers, and directly monetizes your traffic.
2. **Candidate premium (secondary).** RemoteOK-style subscription: instant alerts (not daily), advanced filters (exact salary/timezone/stack), salary insights, ad-free, "apply first" early access. *Why:* recurring revenue from the demand side with no inventory cost.
3. **Sponsored/affiliate slots.** Affiliate links for adjacent products (job-search tools, resume services, VPN/health-insurance for nomads — RemoteOK cross-sells SafetyWing). *Why:* passive, zero-maintenance.
4. **API / data licensing (later).** Charge for a clean JSON API of scraped+enriched jobs once volume is meaningful (RemoteOK/Himalayas give it away free to grow; you can gate or rate-limit a premium tier).
5. **Avoid:** pure pay-per-click like Indeed (needs massive volume + ad ops) and recruiter-marketplace like Wellfound (two-sided sales motion). Both out of reach for a solo build.

Sequence: free browsing → paid "featured" posting → candidate premium → affiliate → API.

---

## 5. Quick Wins vs Big Bets

**Quick wins (ship in weeks, high ROI):**
- Salary tag + min-salary slider + "highest paid" sort (RemoteOK).
- Remote-only toggle + timezone/country filter (Himalayas/Indeed).
- Tag/tech-stack filter chips with per-filter remove (RemoteOK).
- Date-posted filter + default "latest" sort + multi-sort menu (RemoteOK).
- Saved searches + email alerts (daily/instant) — no account required (Indeed).
- Left-rail facets + instant client-side search (Indeed/LinkedIn).

**Big bets (ship later, differentiated):**
- Match % + "why this matches" line, moving from search → recommendation (Otta).
- Saved-jobs application tracker with notes/status (Indeed/LinkedIn).
- Salary *and* equity on cards + company-stage/YC flags (Wellfound).
- Rich company profiles as a return-to reason (Himalayas/WTTJ).
- AI natural-language search (Indeed/LinkedIn).

**Bottom line:** build the RemoteOK core (salary + tags + sorts + alerts) with Himalayas' timezone filter, wrap it in a left-rail facet layout like Indeed, and add Otta's "why this matches" as the one memorable differentiator. Monetize by featuring employer posts, not by gating candidates.
