// Pure mapping functions: raw board JSON -> ScrapedItem.
//
// Deliberately no network calls and no I/O so the mapping logic can be unit
// tested directly against live API payloads (see scripts/test-parsers.mjs).

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
  postedAt?: string;
  tags?: string[];
}

export const MAX_JOBS_PER_BOARD = 40;

const AMP = String.fromCharCode(38); // '&'

const ENTITIES: Record<string, string> = {
  [`${AMP}nbsp;`]: ' ',
  [`${AMP}amp;`]: AMP,
  [`${AMP}lt;`]: '<',
  [`${AMP}gt;`]: '>',
  [`${AMP}quot;`]: '"',
  [`${AMP}apos;`]: "'",
  [`${AMP}lsquo;`]: '\u2018',
  [`${AMP}rsquo;`]: '\u2019',
  [`${AMP}ldquo;`]: '\u201C',
  [`${AMP}rdquo;`]: '\u201D',
  [`${AMP}ndash;`]: '\u2013',
  [`${AMP}mdash;`]: '\u2014',
  [`${AMP}hellip;`]: '\u2026',
  [`${AMP}bull;`]: '\u2022',
  [`${AMP}middot;`]: '\u00B7',
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

// Greenhouse ships job descriptions as HTML-escaped HTML ("<p>...").
// Decoding must happen BEFORE stripping, otherwise the decoded markup
// re-appears in the plain text and pollutes resume-match token scoring.
const stripTags = (html: string): string => {
  let text = decodeEntities(String(html || ''));
  // Some boards double-encode; a second decode catches "&lt;p&gt;".
  text = decodeEntities(text);
  text = text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(text)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const TAG_HINTS = ['react', 'typescript', 'javascript', 'python', 'node', 'next.js', 'vue', 'angular',
  'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'postgres', 'sql', 'redis', 'graphql', 'api',
  'rest', 'figma', 'design', 'product', 'sales', 'marketing', 'seo', 'data', 'ml', 'ai', 'rust',
  'go', 'java', 'c#', 'c++', 'php', 'ruby', 'rails', 'swift', 'kotlin', 'flutter', 'wordpress'];

function inferTags(text: string): string[] {
  const lower = String(text || '').toLowerCase();
  const hits = TAG_HINTS.filter(t => lower.includes(t));
  return Array.from(new Set(hits)).slice(0, 8);
}

function inferJobType(text: string): string | undefined {
  const t = String(text || '').toLowerCase();
  if (/full[- ]?time|permanent|staff/.test(t)) return 'full-time';
  if (/part[- ]?time/.test(t)) return 'part-time';
  if (/contract|freelance|contractor/.test(t)) return 'contract';
  if (/internship|intern/.test(t)) return 'internship';
  return undefined;
}

function toIso(value: unknown): string | undefined {
  if (!value) return undefined;
  try {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Greenhouse: { jobs: [{ id, title, updated_at, created_at, location:{name},
// absolute_url, content, departments:[{name}] }] }
// ---------------------------------------------------------------------------
export function parseGreenhouseBoard(payload: any, sourceName: string): ScrapedItem[] {
  const jobs: any[] = Array.isArray(payload?.jobs) ? payload.jobs : [];
  return jobs
    .slice()
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())
    .slice(0, MAX_JOBS_PER_BOARD)
    .map((job: any) => {
      const description = stripTags(job.content).slice(0, 4000);
      const location = stripTags(job.location?.name || job.location || '');
      const departments = Array.isArray(job.departments) ? job.departments.map((d: any) => d.name).filter(Boolean) : [];
      return {
        title: stripTags(job.title),
        description,
        url: job.absolute_url || '',
        source: sourceName,
        company: sourceName.replace(/^Direct:\s*/, ''),
        location: location || undefined,
        jobType: inferJobType(`${job.title || ''} ${description}`),
        postedAt: toIso(job.updated_at || job.created_at),
        tags: inferTags(`${job.title || ''} ${description} ${departments.join(' ')}`),
        remote: /remote|anywhere|worldwide/i.test(`${job.title || ''} ${location}`) ? true : undefined,
      };
    })
    .filter((i) => i.title && i.url);
}

// ---------------------------------------------------------------------------
// Ashby: { jobs: [{ id, title, location, employmentType, jobUrl, applyUrl,
// descriptionPlain, descriptionHtml, publishedAt, updatedAt, tags[] }] }
// ---------------------------------------------------------------------------
export function parseAshbyBoard(payload: any, sourceName: string): ScrapedItem[] {
  const jobs: any[] = Array.isArray(payload?.jobs) ? payload.jobs : [];
  return jobs
    .slice()
    .sort((a, b) => new Date(b.publishedAt || b.updatedAt || 0).getTime() - new Date(a.publishedAt || a.updatedAt || 0).getTime())
    .slice(0, MAX_JOBS_PER_BOARD)
    .map((job: any) => {
      const description = stripTags(job.descriptionPlain || job.descriptionHtml).slice(0, 4000);
      const location = stripTags(job.location || '');
      const secondary = Array.isArray(job.secondaryLocations)
        ? job.secondaryLocations.map((l: any) => l.location).filter(Boolean).join(', ')
        : '';
      const tags: string[] = Array.isArray(job.tags) ? job.tags : [];
      return {
        title: stripTags(job.title),
        description,
        url: job.jobUrl || job.applyUrl || '',
        source: sourceName,
        company: sourceName.replace(/^Direct:\s*/, ''),
        location: [location, secondary].filter(Boolean).join(' · ') || undefined,
        jobType: job.employmentType || undefined,
        postedAt: toIso(job.publishedAt || job.updatedAt),
        tags: Array.from(new Set([...tags.map((t: string) => String(t).toLowerCase()), ...inferTags(`${job.title || ''} ${description}`)])).slice(0, 8),
        remote: /remote|anywhere|worldwide/i.test(`${job.title || ''} ${location}`) ? true : undefined,
      };
    })
    .filter((i) => i.title && i.url);
}

// ---------------------------------------------------------------------------
// Jobicy JSON API: https://jobicy.com/api/v2/remote-jobs?count=50[&tag=...]
// { id, url, jobTitle, companyName, jobType[], jobGeo, jobIndustry[], jobLevel,
//   jobDescription (HTML), pubDate (ISO), salaryMin/Max/Currency }
// ---------------------------------------------------------------------------
export function parseJobicyApi(payload: any, sourceName: string): ScrapedItem[] {
  const jobs: any[] = Array.isArray(payload) ? payload : Array.isArray(payload?.jobs) ? payload.jobs : [];
  return jobs.map((job: any) => {
    const description = stripTags(job.jobDescription || job.jobExcerpt).slice(0, 4000);
    const jobType = Array.isArray(job.jobType) ? job.jobType[0] : job.jobType;
    const industries: string[] = Array.isArray(job.jobIndustry) ? job.jobIndustry : [];
    return {
      title: stripTags(job.jobTitle || ''),
      description,
      url: job.url || '',
      source: sourceName,
      company: stripTags(job.companyName || ''),
      location: stripTags(job.jobGeo || ''),
      jobType: jobType || undefined,
      postedAt: toIso(job.pubDate),
      tags: Array.from(new Set([...industries.map((t: string) => String(t).toLowerCase()), ...inferTags(`${job.jobTitle || ''} ${description}`)])).slice(0, 8),
      remote: true,
      salaryMin: typeof job.salaryMin === 'number' ? job.salaryMin : undefined,
      salaryMax: typeof job.salaryMax === 'number' ? job.salaryMax : undefined,
      salaryCurrency: job.salaryCurrency || undefined,
    };
  }).filter((i) => i.title && i.url);
}

// ---------------------------------------------------------------------------
// Himalayas JSON API: https://himalayas.app/jobs/api?limit=20&offset=0
// { title, companyName, employmentType, locationRestrictions[], description,
//   pubDate (unix s), expiryDate (unix s), minSalary/maxSalary/currency,
//   categories[], applicationLink }
// ---------------------------------------------------------------------------
export function parseHimalayasApi(payload: any, sourceName: string): ScrapedItem[] {
  const jobs: any[] = Array.isArray(payload) ? payload : Array.isArray(payload?.jobs) ? payload.jobs : [];
  const now = Date.now() / 1000;
  // Drop postings whose own expiry date has passed — that's a dead link we
  // can detect without fetching it.
  const live = jobs.filter(j => !(typeof j.expiryDate === 'number' && j.expiryDate > 0 && j.expiryDate < now));
  return live.map((job: any) => {
    const description = stripTags(job.description || job.excerpt).slice(0, 4000);
    const locations: string[] = Array.isArray(job.locationRestrictions) ? job.locationRestrictions : [];
    const categories: string[] = Array.isArray(job.categories) ? job.categories : [];
    return {
      title: stripTags(job.title || ''),
      description,
      url: job.applicationLink || '',
      source: sourceName,
      company: stripTags(job.companyName || ''),
      location: locations.join(', ') || undefined,
      jobType: job.employmentType || undefined,
      postedAt: toIso(job.pubDate),
      tags: Array.from(new Set([...categories.map((t: string) => String(t).toLowerCase()), ...inferTags(`${job.title || ''} ${description}`)])).slice(0, 8),
      remote: true,
      salaryMin: typeof job.minSalary === 'number' ? job.minSalary : undefined,
      salaryMax: typeof job.maxSalary === 'number' ? job.maxSalary : undefined,
      salaryCurrency: job.currency || undefined,
    };
  }).filter((i) => i.title && i.url);
}

// ---------------------------------------------------------------------------
// Arbeitnow: [{ slug, title, company_name, description, remote, url, tags[], job_types[] }]
// ---------------------------------------------------------------------------
export function parseArbeitNowBoard(payload: any, sourceName: string): ScrapedItem[] {
  const jobs: any[] = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
  return jobs.map((job: any) => {
    const description = stripTags(job.description).slice(0, 4000);
    const jobTypes: string[] = Array.isArray(job.job_types) ? job.job_types : [];
    const tags: string[] = Array.isArray(job.tags) ? job.tags : [];
    const location = stripTags(job.location || '');
    return {
      title: stripTags(job.title),
      description,
      url: job.url || (job.slug ? `https://www.arbeitnow.com/view/${job.slug}` : ''),
      source: sourceName,
      company: stripTags(job.company_name),
      location: location || (job.remote ? 'Remote' : undefined),
      jobType: jobTypes[0] || undefined,
      postedAt: toIso(job.created_at),
      tags: Array.from(new Set([...tags.map((t: string) => String(t).toLowerCase()), ...inferTags(`${job.title || ''} ${description}`)])).slice(0, 8),
      remote: job.remote === true || /remote/i.test(location) ? true : undefined,
    };
  }).filter((i) => i.title && i.url);
}
