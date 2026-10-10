import crypto from 'crypto';

// Pure, dependency-free parsing/scoring utilities for the scraper.
// Kept separate from lib/scraper.ts so they can be unit-tested under Node
// without pulling in Prisma/cheerio.

export const BLOCK_KEYWORDS = [
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

export function cleanHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function fingerprint(title: string, source: string): string {
  return crypto.createHash('md5').update(`${title.toLowerCase().replace(/[^a-z0-9]/g, '')}_${source.toLowerCase()}`).digest('hex');
}

export function parseSalary(text: string): { min?: number; max?: number; currency?: string } {
  if (!text) return {};
  const currencyMap: Record<string, string> = { '$': 'USD', '€': 'EUR', '£': 'GBP', '₹': 'INR', '¥': 'JPY', 'A$': 'AUD', 'C$': 'CAD' };
  const m = text.match(/([€£$₹¥]|A\$|C\$)\s?([0-9][0-9,.]*)\s?[kK]?\s*(?:[-–—]|to)\s*([€£$₹¥]|A\$|C\$)?\s?([0-9][0-9,.]*)\s?[kK]?/);
  if (m) {
    const currency = currencyMap[m[1]] || 'USD';
    const hasK = /[kK]/.test(m[0]);
    const toNum = (raw: string) => {
      const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
      return hasK ? n * 1000 : n;
    };
    const min = toNum(m[2]);
    const max = m[4] ? toNum(m[4]) : undefined;
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

export function inferJobType(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/(full[\s-]?time|permanent)/.test(t)) return 'full-time';
  if (/part[\s-]?time/.test(t)) return 'part-time';
  if (/(contract|freelance|freelancer)/.test(t)) return 'contract';
  if (/(internship|intern\b)/.test(t)) return 'internship';
  return undefined;
}

const TECH_TAGS = ['react', 'python', 'javascript', 'typescript', 'node', 'aws', 'golang', 'go', 'rust', 'java', 'ruby', 'php', 'docker', 'kubernetes', 'sql', 'postgres', 'graphql', 'ai', 'machine learning', 'ml', 'llm', 'data'];

export function inferTags(text: string): string[] {
  const t = text.toLowerCase();
  return TECH_TAGS.filter(k => t.includes(k)).slice(0, 8);
}

export function isBlocked(title: string, desc: string, userBlacklist: string[]): boolean {
  const text = `${title} ${desc}`.toLowerCase();
  const all = [...BLOCK_KEYWORDS, ...userBlacklist.map(k => k.toLowerCase())];
  return all.some(k => text.includes(k));
}

export interface ScoreableItem {
  title: string;
  description: string;
  company?: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  postedAt?: string;
}

export function scoreLead(item: ScoreableItem, preferences: { targetRoles: string[]; coreSkills: string[] } | null): { aiScore: number; matchReason: string } {
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

export function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch { return null; }
}

export const KNOWN_BOARDS = new Set([
  'remoteok.com', 'weworkremotely.com', 'remotive.com', 'himalayas.app', 'workingnomads.co',
  'reddit.com', 'cryptojobslist.com', 'authenticjobs.com', 'jobicy.com', 'landing.jobs',
  'linkedin.com', 'indeed.com', 'glassdoor.com', 'google.com', 'github.com',
]);

export function extractCompanyDomains(urls: string[]): string[] {
  const domains = new Set<string>();
  for (const url of urls) {
    const d = extractDomain(url);
    if (d && !KNOWN_BOARDS.has(d)) domains.add(d);
  }
  return [...domains];
}
