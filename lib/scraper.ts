import { prisma } from './prisma';
import { SOURCES, MAX_JOBS_PER_BOARD } from './source-registry';
import type { SourceDef } from './source-registry';
import { parseGreenhouseBoard, parseAshbyBoard, parseArbeitNowBoard, parseJobicyApi, parseHimalayasApi } from './board-parsers';
import { resolveJobType, resolveRemote } from './job-attrs-core';
import * as cheerio from 'cheerio';
import {
  BLOCK_KEYWORDS,
  cleanHtml,
  fingerprint,
  parseSalary,
  inferJobType,
  inferTags,
  isBlocked,
  scoreLead,
  extractDomain,
  extractCompanyDomains,
} from './scraper-utils';

// Re-export the utilities that other modules already import from this file.
export { cleanHtml, extractCompanyDomains };

// ---------------------------------------------------------------------------
// Source registry — public APIs/RSS only (no LinkedIn/Telegram direct scraping).
// Indeed (RSS deprecated/blocked) and StackOverflow Jobs (RSS discontinued) removed.
// The live list lives in ./source-registry so it can be smoke-tested directly.
// ---------------------------------------------------------------------------
export { SOURCES };
export type { SourceDef };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ScrapedItem {
  title: string;
  description: string;
  url: string;
  source: string;
  company?: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  jobType?: string;
  remote?: boolean;
  timezone?: string;
  postedAt?: string; // ISO string
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Network helpers
// ---------------------------------------------------------------------------
function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// Hostname of a URL, used to rate-limit per-host rather than globally.
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

// Per-request knobs for every outbound fetch. The serverless scrape runner
// lowers these so a single unresponsive board cannot consume an entire
// function invocation's time budget (the full pipeline takes minutes, but a
// serverless invocation may only have ~60s).
let requestTimeoutMs = 15000;
let requestRetries = 2;

export function configureSourceRequests(opts: { timeoutMs?: number; retries?: number }): void {
  if (typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0) requestTimeoutMs = opts.timeoutMs;
  if (typeof opts.retries === 'number' && opts.retries >= 0) requestRetries = opts.retries;
}

async function fetchWithRetry(
  url: string,
  opts: RequestInit = {},
  retries: number = requestRetries,
  timeoutMs: number = requestTimeoutMs,
): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 429 || res.status === 503 || res.status >= 500) {
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
      // Client errors (403/404/410/etc.) won't resolve on retry — surface them
      // so the source is recorded as a failure rather than silently "0 leads".
      if (res.status >= 400) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.message.startsWith('HTTP ')) throw err;
      if (attempt === retries) return null;
      await sleep(800 * Math.pow(2, attempt));
    }
  }
  return null;
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ApexFetch/2.0 (+https://github.com/takon157-rgb/apex-fetch)';

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------
async function parseRss(feed: { name: string; url: string }): Promise<ScrapedItem[]> {
  const res = await fetchWithRetry(feed.url, { headers: { 'User-Agent': UA } });
  if (!res || !res.ok) return [];
  const text = await res.text();
  const $ = cheerio.load(text, { xmlMode: true });
  const items: ScrapedItem[] = [];

  $('item, entry').each((_, el) => {
    const $el = $(el);
    const title = cleanHtml($el.find('title').first().text());
    let link = $el.find('link').first().text().trim() || $el.find('link').first().attr('href') || '';
    if (!link) {
      const m = ($el.html() || '').match(/href=["']([^"']+)["']/i);
      if (m) link = m[1];
    }
    if (!title || !link) return;

    const descRaw =
      $el.find('description').first().text() ||
      $el.find('content').first().text() ||
      $el.find('summary').first().text() ||
      $el.find('encoded').first().text() ||
      '';
    const description = cleanHtml(descRaw).slice(0, 4000);
    const company = cleanHtml($el.find('company').first().text() || $el.find('company_name').first().text() || $el.find('author').first().text() || $el.find('dc\\:creator').first().text());
    const location = cleanHtml($el.find('location').first().text() || $el.find('city').first().text() || $el.find('region').first().text());
    const postedAt = $el.find('pubDate').first().text() || $el.find('published').first().text() || $el.find('updated').first().text() || $el.find('date').first().text();

    const salary = parseSalary(`${title} ${description}`);
    const jobType = inferJobType(`${title} ${description} ${$el.find('job_type').first().text()}`);

    items.push({
      title,
      description,
      url: link.trim(),
      source: feed.name,
      company: company || undefined,
      location: location || undefined,
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: salary.currency,
      jobType,
      remote: /remote|anywhere|worldwide|distributed/i.test(`${title} ${location}`) ? true : undefined,
      postedAt: postedAt ? new Date(postedAt).toISOString() : undefined,
      tags: inferTags(`${title} ${description}`),
    });
  });

  return items;
}

async function parseRemotive(url: string): Promise<ScrapedItem[]> {
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': UA } });
  if (!res) return [];
  const data = await res.json();
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  const jtMap: Record<string, string> = {
    full_time: 'full-time', part_time: 'part-time', contract: 'contract',
    freelance: 'contract', internship: 'internship',
  };
  return jobs.map((job: any) => {
    const title = cleanHtml(job.title || '');
    const salary = parseSalary(job.salary || '');
    return {
      title,
      description: cleanHtml(job.description || '').slice(0, 4000),
      url: job.url || '',
      source: 'Remotive',
      company: cleanHtml(job.company_name || ''),
      location: cleanHtml(job.candidate_required_location || ''),
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: salary.currency,
      jobType: jtMap[(job.job_type || '').toLowerCase()] || job.job_type || undefined,
      postedAt: job.publication_date ? new Date(job.publication_date).toISOString() : undefined,
      tags: toTagArray(job.tags).slice(0, 8),
      remote: /worldwide|remote|anywhere/i.test(`${job.candidate_required_location || ''}`) ? true : undefined,
    } as ScrapedItem;
  }).filter((i: ScrapedItem) => i.title && i.url);
}

async function parseRemoteOk(): Promise<ScrapedItem[]> {
  const res = await fetchWithRetry('https://remoteok.com/api', { headers: { 'User-Agent': UA } });
  if (!res || !res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.slice(1).map((job: any) => ({
    title: cleanHtml(job.position || ''),
    description: cleanHtml(job.description || '').slice(0, 4000),
    url: job.url || `https://remoteok.com/remote-jobs/${job.slug}`,
    source: 'RemoteOK',
    company: cleanHtml(job.company || ''),
    location: cleanHtml(job.location || ''),
    salaryMin: job.salary_min ?? undefined,
    salaryMax: job.salary_max ?? undefined,
    salaryCurrency: job.salary_currency || 'USD',
    jobType: job.employment_type || undefined,
    postedAt: job.date ? new Date(job.date).toISOString() : undefined,
    tags: toTagArray(job.tags).slice(0, 8),
    remote: true,
  } as ScrapedItem)).filter((i: ScrapedItem) => i.title && i.url);
}

// Job boards are inconsistent about tags: some send an array, some send a
// comma-separated string, some send null. Normalise all of them to string[].
function toTagArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(t => String(t).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

async function parseWorkingNomads(url: string): Promise<ScrapedItem[]> {
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': UA } });
  if (!res || !res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((job: any) => {
    const title = cleanHtml(job.title || job.name || '');
    const desc = cleanHtml(job.description || job.summary || '');
    return {
      title,
      description: desc.slice(0, 4000),
      url: job.url || job.link || '',
      source: 'WorkingNomads',
      company: cleanHtml(job.company_name || job.company || ''),
      location: cleanHtml(job.location || job.region || ''),
      salaryMin: job.salary_min ?? undefined,
      salaryMax: job.salary_max ?? undefined,
      jobType: job.job_type || undefined,
      postedAt: job.pub_date ? new Date(job.pub_date).toISOString() : undefined,
      tags: toTagArray(job.tags ?? job.keywords).slice(0, 8),
      remote: /remote/i.test(`${title} ${job.location || ''}`) ? true : undefined,
    } as ScrapedItem;
  }).filter((i: ScrapedItem) => i.title && i.url);
}

// Arbeitnow board: { slug, title, company_name, description, remote, url,
// tags[], job_types[], location }
async function parseArbeitNow(url: string, sourceName: string): Promise<ScrapedItem[]> {
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': UA } });
  if (!res || !res.ok) return [];
  return parseArbeitNowBoard(await res.json(), sourceName);
}

// Greenhouse board: { jobs: [{ id, title, updated_at, created_at, location,
// absolute_url, content, departments[], offices[] }] }
async function parseGreenhouse(url: string, sourceName: string): Promise<ScrapedItem[]> {
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': UA } }, 1, 25000);
  if (!res || !res.ok) return [];
  return parseGreenhouseBoard(await res.json(), sourceName);
}

// Ashby board: { jobs: [{ id, title, location, employmentType, jobUrl, applyUrl,
// descriptionHtml, descriptionPlain, publishedAt, updatedAt, tags[] }] }
async function parseAshby(url: string, sourceName: string): Promise<ScrapedItem[]> {
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': UA } }, 1, 20000);
  if (!res || !res.ok) return [];
  return parseAshbyBoard(await res.json(), sourceName);
}

// Jobicy JSON API: { jobTitle, companyName, jobType[], jobGeo, jobDescription,
// pubDate, salaryMin/Max/Currency }
async function parseJobicy(url: string, sourceName: string): Promise<ScrapedItem[]> {
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': UA } });
  if (!res || !res.ok) return [];
  return parseJobicyApi(await res.json(), sourceName);
}

// Himalayas JSON API: { title, companyName, employmentType, locationRestrictions,
// description, pubDate, expiryDate, minSalary/maxSalary/currency }
async function parseHimalayas(url: string, sourceName: string): Promise<ScrapedItem[]> {
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': UA } });
  if (!res || !res.ok) return [];
  return parseHimalayasApi(await res.json(), sourceName);
}

// ---------------------------------------------------------------------------
// Company career-page discovery (targets actual job domains, not asset CDNs)
// ---------------------------------------------------------------------------
const CAREER_PATHS = ['/careers', '/jobs', '/about/careers', '/about-us/careers', '/about/jobs', '/join-us', '/careers.html', '/open-positions'];

function commonCareerUrls(domain: string): string[] {
  return CAREER_PATHS.map(p => `https://${domain}${p}`);
}

async function scrapeCareerPage(url: string): Promise<ScrapedItem[]> {
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': `${UA} CareerScraper` } }, 1, 12000);
  if (!res || !res.ok) return [];
  const html = await res.text();
  const $ = cheerio.load(html);
  const items: ScrapedItem[] = [];
  const jobKeywords = ['job', 'position', 'opening', 'career', 'hiring', 'role', 'vacancy'];

  $('a').each((_, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr('href');
    if (!text || !href || text.length > 150 || text.length < 5) return;
    const lower = text.toLowerCase();
    const isJobLink = jobKeywords.some(k => lower.includes(k)) || jobKeywords.some(k => href.toLowerCase().includes(k));
    if (!isJobLink) return;
    const fullUrl = href.startsWith('http') ? href : new URL(href, url).href;
    if (!fullUrl.startsWith('http')) return;
    const domain = extractDomain(url);
    items.push({
      title: cleanHtml(text),
      description: cleanHtml(text),
      url: fullUrl,
      source: domain ? `Direct: ${domain}` : 'Direct Career Page',
    });
  });

  return items.filter((item, i, arr) => arr.findIndex(x => x.url === item.url) === i).slice(0, 20);
}

export async function discoverCompanyJobs(companyUrls: string[]): Promise<ScrapedItem[]> {
  // The ATS boards above (Greenhouse/Ashby) cover the big companies properly.
  // This generic pass is only for smaller firms without a public board, so keep
  // it small enough that it doesn't dominate the pipeline's time budget.
  const targetDomains = extractCompanyDomains(companyUrls).slice(0, 5);
  if (targetDomains.length === 0) return [];

  const allItems: ScrapedItem[] = [];
  let idx = 0;
  for (const domain of targetDomains) {
    idx++;
    for (const careerUrl of commonCareerUrls(domain)) {
      await sleep(300);
      try {
        const items = await scrapeCareerPage(careerUrl);
        allItems.push(...items);
      } catch {
        // One dead career page (404, timeout) must not abort the whole pass.
      }
    }
  }

  return allItems.filter((item, i, arr) => arr.findIndex(x => x.url === item.url) === i).slice(0, 100);
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------
/**
 * Controls how much of the pipeline one invocation runs.
 *
 * A full run over 34 boards takes several minutes. On a serverless platform
 * the function is killed long before that, which is why the pipeline is now
 * resumable: each invocation processes a slice of the sources, records where
 * it stopped, and the caller asks for the next slice.
 */
export interface ScrapeBatchOptions {
  /** Index of the first source to process. */
  sourceOffset?: number;
  /** Maximum number of sources to process in this batch. */
  sourceLimit?: number;
  /** Run the company career-page discovery pass. */
  discovery?: boolean;
  /** Stop early once this many milliseconds have elapsed. */
  timeBudgetMs?: number;
}

export interface ScrapePipelineResult {
  leadsCreated: number;
  leadsPruned: number;
  leadsHealed: number;
  sourceResults: { source: string; success: boolean; count: number; error?: string }[];
  /** Index of the next source that still needs processing. */
  nextOffset: number;
  /** True when every registered source has been processed. */
  allSourcesDone: boolean;
  /** True when the batch stopped early because it ran out of time. */
  timedOut: boolean;
}

export async function runScrapePipeline(
  userId: string,
  preferences: { targetRoles: string[]; coreSkills: string[]; parsedResumeSummary: string | null } | null,
  blacklist: string[],
  industry: string,
  nicheQuery: string,
  onProgress: (completed: number, total: number, current: string, leadsFound: number) => Promise<void>,
  options: ScrapeBatchOptions = {},
): Promise<ScrapePipelineResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const allItems: ScrapedItem[] = [];
  const sourceResults: { source: string; success: boolean; count: number; error?: string }[] = [];

  // Cap per source per scrape run so a single high-volume board can't
  // monopolise the feed. 34 sources x 40 = up to ~1360 fresh leads per run.
  const MAX_JOBS_PER_SOURCE = 40;

  const totalSources = SOURCES.length;
  const startOffset = Math.max(0, Math.min(options.sourceOffset ?? 0, totalSources));
  const maxSources = options.sourceLimit != null
    ? Math.max(0, options.sourceLimit)
    : totalSources - startOffset;
  const timeBudgetMs = options.timeBudgetMs ?? 0;
  const batchStartedAt = Date.now();

  let timedOut = false;
  let nextOffset = startOffset;
  let previousHost = '';
  for (let index = startOffset; index < totalSources; index++) {
    // Batch boundary - stop before starting another source.
    if (index - startOffset >= maxSources) break;
    // Time budget - stop before starting another source. The source we would
    // have run next is picked up by the following invocation.
    if (timeBudgetMs > 0 && Date.now() - batchStartedAt >= timeBudgetMs) {
      timedOut = true;
      break;
    }
    const source = SOURCES[index];
    try {
      // Be polite to a host we just hit, but don't stall between different
      // companies — 30 sources at a blanket 1s would blow the pipeline budget.
      const host = hostOf(source.url);
      await sleep(host === previousHost ? 1200 : 250);
      previousHost = host;
      let items: ScrapedItem[] = [];
      if (source.parser === 'remoteok') items = await parseRemoteOk();
      else if (source.parser === 'remotive') items = await parseRemotive(source.url);
      else if (source.parser === 'workingnomads') items = await parseWorkingNomads(source.url);
      else if (source.parser === 'arbeitnow') items = await parseArbeitNow(source.url, source.name);
      else if (source.parser === 'greenhouse') items = await parseGreenhouse(source.url, source.name);
      else if (source.parser === 'ashby') items = await parseAshby(source.url, source.name);
      else if (source.parser === 'jobicy') items = await parseJobicy(source.url, source.name);
      else if (source.parser === 'himalayas') items = await parseHimalayas(source.url, source.name);
      else items = await parseRss(source);

      items = items.filter(item => !isBlocked(item.title, item.description, blacklist));
      if (nicheQuery) {
        items = items.filter(item => `${item.title} ${item.description}`.toLowerCase().includes(nicheQuery.toLowerCase()));
      }
      // Cap each source's contribution per run. Without this, one high-volume
      // board (Arbeitnow returns 300) dominated the feed and every other
      // company was pushed off the first page.
      if (items.length > MAX_JOBS_PER_SOURCE) {
        items = items.slice(0, MAX_JOBS_PER_SOURCE);
      }

      allItems.push(...items);
      sourceResults.push({ source: source.name, success: true, count: items.length });
      nextOffset = index + 1;
      await onProgress(index + 1, totalSources + 1, source.name, allItems.length);
    } catch (err) {
      sourceResults.push({ source: source.name, success: false, count: 0, error: String(err) });
      nextOffset = index + 1;
      await onProgress(index + 1, totalSources + 1, source.name, allItems.length);
    }
  }

  // Direct company career-page discovery. Previously this only ran in the weekly
  // cron, so a manual "Pull" never touched company /careers pages. Derive the
  // target domains from jobs we already have for this user, then scrape them.
  if (options.discovery) {
    try {
      const priorLeads = await prisma.lead.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 120,
        select: { url: true },
      });
      const domains = extractCompanyDomains(priorLeads.map(l => l.url));
      if (domains.length > 0) {
        const companyUrls = domains.slice(0, 12).map(d => `https://${d}`);
        const companyItems = await discoverCompanyJobs(companyUrls);
        allItems.push(...companyItems);
        sourceResults.push({ source: 'Company Career Pages', success: true, count: companyItems.length });
        await onProgress(totalSources + 1, totalSources + 1, 'Company Career Pages', allItems.length);
      }
    } catch (err) {
      sourceResults.push({ source: 'Company Career Pages', success: false, count: 0, error: String(err) });
    }
  }

  // Cross-source dedupe (canonical URL + normalized title fingerprint)
  const seen = new Set<string>();
  const deduped: ScrapedItem[] = [];
  for (const item of allItems) {
    const urlKey = item.url.toLowerCase().replace(/\/+$/, '').replace(/[?#].*$/, '');
    const titleKey = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
    const key = `${urlKey}|${titleKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  const existingLeads = await prisma.lead.findMany({
    where: { userId },
    select: { id: true, url: true, title: true, source: true, jobType: true, remote: true, description: true },
  });
  const existingUrls = new Set(existingLeads.map(l => l.url.toLowerCase().trim()));
  const existingFingerprints = new Set(existingLeads.map(l => fingerprint(l.title, l.source)));
  // Re-scraped postings fill in attributes we were missing before, instead of
  // being skipped outright. This is how leads scraped before jobType/remote
  // were captured gradually get repaired.
  const healByUrl = new Map<string, typeof existingLeads[number]>();
  const healByFingerprint = new Map<string, typeof existingLeads[number]>();
  for (const l of existingLeads) {
    healByUrl.set(l.url.toLowerCase().trim(), l);
    healByFingerprint.set(fingerprint(l.title, l.source), l);
  }

  const industryKeywords: Record<string, string[]> = {
    'Entry Level': ['entry level', 'junior', 'graduate', 'new grad', 'associate', 'early career', 'no experience', 'beginner'],
    'AI Automation': ['automation', 'ai', 'machine learning', 'llm', 'chatgpt', 'gpt', 'genai'],
    'Video Editing': ['video', 'editor', 'editing', 'thumbnail', 'premiere', 'davinci', 'after effects', 'shorts', 'youtube'],
    'Appointment Setter': ['setter', 'appointment', 'cold call', 'outreach', 'lead generation', 'sales development'],
    'Social Media': ['social', 'media', 'marketing', 'instagram', 'tiktok', 'content creator', 'community'],
    'Virtual Assistant': ['assistant', 'virtual assistant', 'va', 'admin support', 'administrative'],
  };

  let leadsCreated = 0;
  const batchData: any[] = [];
  const healBatch: { id: string; data: Record<string, any> }[] = [];

  for (const item of deduped) {
    const fp = fingerprint(item.title, item.source);
    const url = item.url.toLowerCase().trim();

    // Normalise employment type and remote status before they hit the DB.
    // Boards send "FullTime", "Full Time", "Unbefristeter arbeitsvertrag"… and
    // most omit remote entirely, which made the dashboard filters useless.
    const canonicalType = resolveJobType(item.jobType, item.title, item.description);
    const canonicalRemote = item.remote ?? resolveRemote(item.title, item.location, item.description);

    // Heal: we already have this posting, but it's missing attributes (or has
    // a stub description) from an older scrape. Repair it in place.
    const existing = healByUrl.get(url) || healByFingerprint.get(fp);
    if (existing) {
      const data: Record<string, any> = {};
      if (!existing.jobType && canonicalType) data.jobType = canonicalType;
      if (existing.remote === null && canonicalRemote !== null && canonicalRemote !== undefined) data.remote = canonicalRemote;
      if ((existing.description || '').length < 300 && (item.description || '').length > (existing.description || '').length) {
        data.description = item.description;
      }
      if (Object.keys(data).length > 0) healBatch.push({ id: existing.id, data });
      existingUrls.add(url);
      existingFingerprints.add(fp);
      continue;
    }

    if (existingUrls.has(url) || existingFingerprints.has(fp)) continue;
    existingUrls.add(url);
    existingFingerprints.add(fp);

    const unifiedText = `${item.title} ${item.description}`.toLowerCase();
    if (industry !== 'All') {
      const keywords = industryKeywords[industry] || [industry.toLowerCase()];
      if (!keywords.some(k => unifiedText.includes(k))) continue;
    }

    const { aiScore, matchReason } = scoreLead(item, preferences);

    batchData.push({
      userId,
      title: item.title,
      company: item.company || null,
      description: item.description,
      budget: item.salaryMin ? `$${item.salaryMin}${item.salaryMax ? ` - $${item.salaryMax}` : ''}` : 'Open Terms',
      salaryMin: item.salaryMin ?? null,
      salaryMax: item.salaryMax ?? null,
      salaryCurrency: item.salaryCurrency || 'USD',
      location: item.location || null,
      jobType: canonicalType,
      remote: canonicalRemote,
      timezone: item.timezone || null,
      postedAt: item.postedAt ? new Date(item.postedAt) : new Date(),
      tags: item.tags || [],
      source: item.source,
      url: item.url,
      aiScore,
      matchReason,
      status: 'active',
    });
    leadsCreated++;
  }

  if (batchData.length > 0) {
    await prisma.lead.createMany({ data: batchData, skipDuplicates: true });
  }

  // Apply repairs to leads we already had. Chunked so one big scrape doesn't
  // build a single enormous transaction.
  if (healBatch.length > 0) {
    const CHUNK = 100;
    for (let i = 0; i < healBatch.length; i += CHUNK) {
      const chunk = healBatch.slice(i, i + CHUNK);
      await prisma.$transaction(
        chunk.map(h => prisma.lead.update({ where: { id: h.id }, data: h.data }))
      );
    }
  }

  // NOTE: auto-prune of low-score leads has been REMOVED (was silently deleting
  // user data on every scrape). Deletion is now explicit-only via the trash bin.

  await prisma.sourceHealth.createMany({
    data: sourceResults.map(sr => ({
      userId,
      source: sr.source,
      success: sr.success,
      leadsCount: sr.count,
      errorMsg: sr.error || null,
    })),
  });

  return {
    leadsCreated,
    leadsPruned: 0,
    leadsHealed: healBatch.length,
    sourceResults,
    nextOffset,
    allSourcesDone: nextOffset >= totalSources,
    timedOut,
  };
}
