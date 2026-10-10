import { prisma } from './prisma';
import crypto from 'crypto';
import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// Source registry — public APIs/RSS only (no LinkedIn/Telegram direct scraping).
// Indeed (RSS deprecated/blocked) and StackOverflow Jobs (RSS discontinued) removed.
// ---------------------------------------------------------------------------
export const SOURCES: { name: string; url: string; type: 'rss' | 'json' | 'api'; parser: 'rss' | 'reddit' | 'remoteok' | 'workingnomads' }[] = [
  { name: 'RemoteOK',       url: 'https://remoteok.com/api', type: 'api',  parser: 'remoteok' },
  { name: 'Remotive',       url: 'https://remotive.com/feed', type: 'rss',  parser: 'rss' },
  { name: 'WeWorkRemotely', url: 'https://weworkremotely.com/remote-jobs.rss', type: 'rss', parser: 'rss' },
  { name: 'Himalayas',      url: 'https://himalayas.app/jobs/rss', type: 'rss', parser: 'rss' },
  { name: 'WorkingNomads',  url: 'https://www.workingnomads.co/api/exposed_jobs/', type: 'api', parser: 'workingnomads' },
  { name: 'Reddit',         url: 'https://www.reddit.com/r/forhire+jobbit+remotejs+remotework+designjobs/.json?limit=50', type: 'json', parser: 'reddit' },
  { name: 'CryptoJobsList', url: 'https://cryptojobslist.com/jobs.rss?jobLocation=Remote', type: 'rss', parser: 'rss' },
  { name: 'AuthenticJobs',  url: 'https://authenticjobs.com/?feed=job_feed&job_types=freelance,full-time,internship,part-time&search_location=remote', type: 'rss', parser: 'rss' },
  { name: 'Jobicy',         url: 'https://jobicy.com/?feed=job_feed', type: 'rss', parser: 'rss' },
  { name: 'LandingJobs',    url: 'https://landing.jobs/feed?remote=true', type: 'rss', parser: 'rss' },
];

const BLOCK_KEYWORDS = [
  'for hire', '[for hire]', 'hire me', 'looking for work', 'seeking employment',
  'portfolio', 'freelancer available', 'looking for a job',
  'post a job', 'post a remote job', 'hire remotely', 'top 100 remote',
  'best remote', 'remote companies', 'how to',
  'sign up', 'subscribe', 'newsletter', 'get started',
  'upload your resume', 'build your resume', 'create account',
  'we are the leading', 'leading remote', 'join our team of',
  'browse jobs', 'search jobs', 'find a job', 'apply now',
  'start your free trial', 'hire developers', 'hire designers',
];

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
// Utilities
// ---------------------------------------------------------------------------
export function cleanHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function fingerprint(title: string, source: string): string {
  return crypto.createHash('md5').update(`${title.toLowerCase().replace(/[^a-z0-9]/g, '')}_${source.toLowerCase()}`).digest('hex');
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Fetch with timeout, retry, and exponential backoff. Returns null on final failure.
 * Handles 429/5xx (retry) vs 4xx (give up) distinctly.
 */
async function fetchWithRetry(url: string, opts: RequestInit = {}, retries = 2, timeoutMs = 15000): Promise<Response | null> {
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
      return res;
    } catch {
      clearTimeout(timer);
      if (attempt === retries) return null;
      await sleep(800 * Math.pow(2, attempt));
    }
  }
  return null;
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ApexFetch/2.0 (+https://github.com/takon157-rgb/apex-fetch)';

// ---------------------------------------------------------------------------
// Field extraction heuristics (best-effort, per-source variance expected)
// ---------------------------------------------------------------------------
function parseSalary(text: string): { min?: number; max?: number; currency?: string } {
  if (!text) return {};
  // "50k", "$50,000", "€60,000", "£45k", "$120k+", "50 - 80k", "$70k-$90k"
  const currencyMap: Record<string, string> = { '$': 'USD', '€': 'EUR', '£': 'GBP', '₹': 'INR', '¥': 'JPY', 'A$': 'AUD', 'C$': 'CAD' };
  const m = text.match(/([€£$₹¥]|A\$|C\$)\s?([0-9][0-9,.]*)\s?[kK]?\s*(?:[-–—]|to)\s*([€£$₹¥]|A\$|C\$)?\s?([0-9][0-9,.]*)\s?[kK]?/);
  if (m) {
    const sym = m[1];
    const currency = currencyMap[sym] || 'USD';
    const toNum = (raw: string, hasK: boolean) => {
      const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
      return hasK ? n * 1000 : n;
    };
    const hasK = /[kK]/.test(m[0]);
    const min = toNum(m[2], hasK);
    const max = m[4] ? toNum(m[4], hasK) : undefined;
    return { min, max, currency };
  }
  const single = text.match(/([€£$₹¥]|A\$|C\$)\s?([0-9][0-9,.]*)\s?[kK]?/);
  if (single) {
    const sym = single[1];
    const hasK = /[kK]/.test(single[0]);
    const n = parseFloat(single[2].replace(/[^0-9.]/g, '')) * (hasK ? 1000 : 1);
    return { min: n, currency: currencyMap[sym] || 'USD' };
  }
  return {};
}

function inferJobType(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/(full[\s-]?time|permanent)/.test(t)) return 'full-time';
  if (/part[\s-]?time/.test(t)) return 'part-time';
  if (/(contract|freelance|freelancer)/.test(t)) return 'contract';
  if (/(internship|intern\b)/.test(t)) return 'internship';
  return undefined;
}

function inferTags(text: string): string[] {
  const t = text.toLowerCase();
  const tech = ['react', 'python', 'javascript', 'typescript', 'node', 'aws', 'golang', 'go', 'rust', 'java', 'ruby', 'php', 'docker', 'kubernetes', 'sql', 'postgres', 'graphql', 'ai', 'machine learning', 'ml', 'llm', 'data'];
  return tech.filter(k => t.includes(k)).slice(0, 8);
}

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
    const description = cleanHtml(descRaw).slice(0, 2000);
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

async function parseReddit(url: string): Promise<ScrapedItem[]> {
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': UA } });
  if (!res || !res.ok) return [];
  const data = await res.json();
  const children = data?.data?.children || [];
  return children.map((child: any) => {
    const d = child.data;
    const title = cleanHtml(d.title || '');
    const desc = cleanHtml(d.selftext || d.title || '');
    const salary = parseSalary(desc);
    return {
      title,
      description: desc.slice(0, 2000),
      url: `https://reddit.com${d.permalink}`,
      source: 'Reddit',
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: salary.currency,
      postedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : undefined,
      tags: inferTags(`${title} ${desc}`),
      remote: undefined,
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
    description: cleanHtml(job.description || '').slice(0, 2000),
    url: job.url || `https://remoteok.com/remote-jobs/${job.slug}`,
    source: 'RemoteOK',
    company: cleanHtml(job.company || ''),
    location: cleanHtml(job.location || ''),
    salaryMin: job.salary_min ?? undefined,
    salaryMax: job.salary_max ?? undefined,
    salaryCurrency: job.salary_currency || 'USD',
    jobType: job.employment_type || undefined,
    postedAt: job.date ? new Date(job.date).toISOString() : undefined,
    tags: (job.tags || []).map((t: string) => t.toLowerCase()).slice(0, 8),
    remote: true,
  } as ScrapedItem)).filter((i: ScrapedItem) => i.title && i.url);
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
      description: desc.slice(0, 2000),
      url: job.url || job.link || '',
      source: 'WorkingNomads',
      company: cleanHtml(job.company_name || job.company || ''),
      location: cleanHtml(job.location || job.region || ''),
      salaryMin: job.salary_min ?? undefined,
      salaryMax: job.salary_max ?? undefined,
      jobType: job.job_type || undefined,
      postedAt: job.pub_date ? new Date(job.pub_date).toISOString() : undefined,
      tags: (job.tags || job.keywords || []).map((t: string) => t.toLowerCase()).slice(0, 8),
      remote: /remote/i.test(`${title} ${job.location || ''}`) ? true : undefined,
    } as ScrapedItem;
  }).filter((i: ScrapedItem) => i.title && i.url);
}

function isBlocked(title: string, desc: string, userBlacklist: string[]): boolean {
  const text = `${title} ${desc}`.toLowerCase();
  const all = [...BLOCK_KEYWORDS, ...userBlacklist.map(k => k.toLowerCase())];
  return all.some(k => text.includes(k));
}

// ---------------------------------------------------------------------------
// Company career-page discovery (targets actual job domains, not asset CDNs)
// ---------------------------------------------------------------------------
function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch { return null; }
}

const KNOWN_BOARDS = new Set([
  'remoteok.com', 'weworkremotely.com', 'remotive.com', 'himalayas.app', 'workingnomads.co',
  'reddit.com', 'cryptojobslist.com', 'authenticjobs.com', 'jobicy.com', 'landing.jobs',
  'linkedin.com', 'indeed.com', 'glassdoor.com', 'google.com', 'github.com',
]);

/**
 * Given a list of job URLs, return the unique company domains that are NOT
 * job boards themselves — i.e. actual employers worth scraping for career pages.
 */
export function extractCompanyDomains(urls: string[]): string[] {
  const domains = new Set<string>();
  for (const url of urls) {
    const d = extractDomain(url);
    if (d && !KNOWN_BOARDS.has(d)) domains.add(d);
  }
  return [...domains];
}

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
  const targetDomains = extractCompanyDomains(companyUrls).slice(0, 20);
  if (targetDomains.length === 0) return [];

  const allItems: ScrapedItem[] = [];
  let idx = 0;
  for (const domain of targetDomains) {
    idx++;
    for (const careerUrl of commonCareerUrls(domain)) {
      await sleep(500);
      const items = await scrapeCareerPage(careerUrl);
      allItems.push(...items);
    }
    if (idx >= 10) break;
  }

  return allItems.filter((item, i, arr) => arr.findIndex(x => x.url === item.url) === i).slice(0, 100);
}

// ---------------------------------------------------------------------------
// Honest, explainable relevance scoring (replaces the old keyword "AI" score)
// ---------------------------------------------------------------------------
function scoreLead(item: ScrapedItem, preferences: { targetRoles: string[]; coreSkills: string[] } | null): { aiScore: number; matchReason: string } {
  const text = `${item.title} ${item.description}`.toLowerCase();
  const reasons: string[] = [];
  let score = 4;

  if (/remote|anywhere|worldwide|distributed|work from home|wfh/i.test(text)) { score += 1; reasons.push('remote'); }
  if (item.salaryMin || item.salaryMax) { score += 1; reasons.push('salary listed'); }
  if (item.company) { score += 1; reasons.push('company listed'); }
  if (item.location) { score += 1; reasons.push('location listed'); }
  if (item.postedAt) {
    const age = Date.now() - new Date(item.postedAt).getTime();
    if (age < 7 * 86400000) { score += 1; reasons.push('posted recently'); }
  }

  if (preferences) {
    const roleMatch = preferences.targetRoles.filter(Boolean).some(r => text.includes(r.toLowerCase()));
    const skillMatches = preferences.coreSkills.filter(Boolean).filter(s => text.includes(s.toLowerCase()));
    if (roleMatch) { score += 1; reasons.push('matches target role'); }
    if (skillMatches.length > 0) { score += 1; reasons.push(`matches ${skillMatches[0]} skill`); }
  }

  const matchReason = reasons.length ? `Matches: ${reasons.join(' · ')}` : 'General listing';

  return { aiScore: Math.min(10, Math.max(0, score)), matchReason };
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------
export async function runScrapePipeline(
  userId: string,
  preferences: { targetRoles: string[]; coreSkills: string[]; parsedResumeSummary: string | null } | null,
  blacklist: string[],
  industry: string,
  nicheQuery: string,
  onProgress: (completed: number, total: number, current: string, leadsFound: number) => Promise<void>,
): Promise<{ leadsCreated: number; leadsPruned: number; sourceResults: { source: string; success: boolean; count: number; error?: string }[] }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const allItems: ScrapedItem[] = [];
  const sourceResults: { source: string; success: boolean; count: number; error?: string }[] = [];
  let completed = 0;

  for (const source of SOURCES) {
    try {
      await sleep(1000);
      let items: ScrapedItem[] = [];
      if (source.parser === 'reddit') items = await parseReddit(source.url);
      else if (source.parser === 'remoteok') items = await parseRemoteOk();
      else if (source.parser === 'workingnomads') items = await parseWorkingNomads(source.url);
      else items = await parseRss(source);

      items = items.filter(item => !isBlocked(item.title, item.description, blacklist));
      if (nicheQuery) {
        items = items.filter(item => `${item.title} ${item.description}`.toLowerCase().includes(nicheQuery.toLowerCase()));
      }

      allItems.push(...items);
      completed++;
      sourceResults.push({ source: source.name, success: true, count: items.length });
      await onProgress(completed, SOURCES.length, source.name, allItems.length);
    } catch (err) {
      completed++;
      sourceResults.push({ source: source.name, success: false, count: 0, error: String(err) });
      await onProgress(completed, SOURCES.length, source.name, allItems.length);
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
    select: { url: true, title: true, source: true },
  });
  const existingUrls = new Set(existingLeads.map(l => l.url.toLowerCase().trim()));
  const existingFingerprints = new Set(existingLeads.map(l => fingerprint(l.title, l.source)));

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

  for (const item of deduped) {
    const fp = fingerprint(item.title, item.source);
    const url = item.url.toLowerCase().trim();
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
      jobType: item.jobType || null,
      remote: item.remote ?? null,
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

  return { leadsCreated, leadsPruned: 0, sourceResults };
}
