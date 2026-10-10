import { prisma } from './prisma';
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
// ---------------------------------------------------------------------------
export const SOURCES: { name: string; url: string; type: 'rss' | 'json' | 'api'; parser: 'rss' | 'remoteok' | 'remotive' | 'workingnomads' }[] = [
  { name: 'RemoteOK',       url: 'https://remoteok.com/api', type: 'api',  parser: 'remoteok' },
  { name: 'Remotive',       url: 'https://remotive.com/api/remote-jobs', type: 'api', parser: 'remotive' },
  { name: 'WeWorkRemotely', url: 'https://weworkremotely.com/remote-jobs.rss', type: 'rss', parser: 'rss' },
  { name: 'Himalayas',      url: 'https://himalayas.app/jobs/rss', type: 'rss', parser: 'rss' },
  { name: 'WorkingNomads',  url: 'https://www.workingnomads.co/api/exposed_jobs/', type: 'api', parser: 'workingnomads' },
  { name: 'AuthenticJobs',  url: 'https://authenticjobs.com/?feed=job_feed&job_types=freelance,full-time,internship,part-time&search_location=remote', type: 'rss', parser: 'rss' },
  { name: 'Jobicy',         url: 'https://jobicy.com/?feed=job_feed', type: 'rss', parser: 'rss' },
  { name: 'LandingJobs',    url: 'https://landing.jobs/feed?remote=true', type: 'rss', parser: 'rss' },
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
// Network helpers
// ---------------------------------------------------------------------------
function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

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
      description: cleanHtml(job.description || '').slice(0, 2000),
      url: job.url || '',
      source: 'Remotive',
      company: cleanHtml(job.company_name || ''),
      location: cleanHtml(job.candidate_required_location || ''),
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: salary.currency,
      jobType: jtMap[(job.job_type || '').toLowerCase()] || job.job_type || undefined,
      postedAt: job.publication_date ? new Date(job.publication_date).toISOString() : undefined,
      tags: (job.tags || []).map((t: string) => String(t).toLowerCase()).slice(0, 8),
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
      if (source.parser === 'remoteok') items = await parseRemoteOk();
      else if (source.parser === 'remotive') items = await parseRemotive(source.url);
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
