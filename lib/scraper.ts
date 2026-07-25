import { prisma } from './prisma';
import crypto from 'crypto';

export const SOURCES: { name: string; url: string; type: 'rss' | 'json' | 'api'; parser: string }[] = [
  { name: 'Reddit',         url: 'https://www.reddit.com/r/forhire+jobbit+remotejs+remotework+designjobs/.json?limit=50', type: 'json', parser: 'reddit' },
  { name: 'RemoteOK',       url: 'https://remoteok.com/api', type: 'api', parser: 'remoteok' },
  { name: 'Remotive',       url: 'https://remotive.com/feed', type: 'rss', parser: 'rss' },
  { name: 'WeWorkRemotely', url: 'https://weworkremotely.com/remote-jobs.rss', type: 'rss', parser: 'rss' },
  { name: 'Himalayas',      url: 'https://himalayas.app/jobs/rss', type: 'rss', parser: 'rss' },
  { name: 'AuthenticJobs',  url: 'https://authenticjobs.com/?feed=job_feed&job_types=freelance,full-time,internship,part-time&search_location=remote', type: 'rss', parser: 'rss' },
  { name: 'StackOverflow',  url: 'https://stackoverflow.com/jobs/feed?r=True', type: 'rss', parser: 'rss' },
  { name: 'CryptoJobsList', url: 'https://cryptojobslist.com/jobs.rss?jobLocation=Remote', type: 'rss', parser: 'rss' },
  { name: 'WorkingNomads',  url: 'https://www.workingnomads.co/api/exposed_jobs/', type: 'api', parser: 'workingnomads' },
  { name: 'Jobicy',         url: 'https://jobicy.com/?feed=job_feed', type: 'rss', parser: 'rss' },
  { name: 'Indeed',         url: 'https://www.indeed.com/rss/jobs?q=remote+developer&l=remote', type: 'rss', parser: 'rss' },
  { name: 'LandingJobs',    url: 'https://landing.jobs/feed?remote=true', type: 'rss', parser: 'rss' },
  { name: 'CareerNest',     url: 'https://careernest.cloud/api/feed.xml?limit=100', type: 'rss', parser: 'rss' },
  { name: 'Workbeam',       url: 'https://workbeamhq.com/feeds/all', type: 'rss', parser: 'rss' },
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

interface ScrapedItem {
  title: string;
  description: string;
  url: string;
  source: string;
  budget: string;
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!match) return '';
  return match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim();
}

export function cleanHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

function fingerprint(title: string, source: string): string {
  return crypto.createHash('md5').update(`${title.toLowerCase().replace(/[^a-z0-9]/g, '')}_${source.toLowerCase()}`).digest('hex');
}

async function parseRSS(feed: { name: string; url: string }): Promise<ScrapedItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const res = await fetch(feed.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 ApexFetch/2.0' },
    signal: controller.signal,
  });
  clearTimeout(timeout);
  if (!res.ok) return [];
  const text = await res.text();
  const items = text.split(/<item>|<entry>/i).slice(1);
  return items.map(item => {
    const title = cleanHtml(extractTag(item, 'title'));
    let link = extractTag(item, 'link');
    if (!link) {
      const m = item.match(/href=["']([^"']+)["']/i);
      if (m) link = m[1];
    }
    const desc = cleanHtml(extractTag(item, 'description') || extractTag(item, 'content') || extractTag(item, 'summary')).slice(0, 600);
    const budgetMatch = desc.match(/(\$[0-9,]+)/);
    if (title && link) return { title, description: desc, url: link.trim(), source: feed.name, budget: budgetMatch ? budgetMatch[1] : 'Open Terms' };
    return null;
  }).filter(Boolean) as ScrapedItem[];
}

async function parseReddit(url: string): Promise<ScrapedItem[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 ApexFetch/2.0 (by /u/apexfetch)' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const children = data?.data?.children || [];
  return children.map((child: any) => {
    const d = child.data;
    const title = d.title || '';
    const desc = d.selftext || d.title || '';
    const budgetMatch = desc.match(/(\$[0-9,]+)/);
    return {
      title: cleanHtml(title),
      description: cleanHtml(desc).slice(0, 600),
      url: `https://reddit.com${d.permalink}`,
      source: 'Reddit',
      budget: budgetMatch ? budgetMatch[1] : d.link_flair_text?.includes('Hiring') ? 'Negotiable' : 'Open Terms',
    };
  }).filter((item: ScrapedItem) => item.title && item.url);
}

async function parseRemoteOK(): Promise<ScrapedItem[]> {
  const res = await fetch('https://remoteok.com/api', {
    headers: { 'User-Agent': 'Mozilla/5.0 ApexFetch/2.0' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.slice(1).map((job: any) => ({
    title: cleanHtml(job.position || ''),
    description: cleanHtml((job.description || '')).slice(0, 600),
    url: job.url || `https://remoteok.com/remote-jobs/${job.slug}`,
    source: 'RemoteOK',
    budget: `$${job.salary_min || '?'} - $${job.salary_max || '?'}`,
  })).filter((item: ScrapedItem) => item.title && item.url);
}

async function parseWorkingNomads(url: string): Promise<ScrapedItem[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 ApexFetch/2.0' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((job: any) => ({
    title: cleanHtml(job.title || job.name || ''),
    description: cleanHtml(job.description || job.summary || '').slice(0, 600),
    url: job.url || job.link || '',
    source: 'WorkingNomads',
    budget: job.salary || job.budget || 'Open Terms',
  })).filter((item: ScrapedItem) => item.title && item.url);
}

function isBlocked(title: string, desc: string, userBlacklist: string[]): boolean {
  const text = `${title} ${desc}`.toLowerCase();
  const all = [...BLOCK_KEYWORDS, ...userBlacklist.map(k => k.toLowerCase())];
  return all.some(k => text.includes(k));
}

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
      await new Promise(r => setTimeout(r, 1500));

      let items: ScrapedItem[] = [];
      if (source.parser === 'reddit') {
        items = await parseReddit(source.url);
      } else if (source.parser === 'remoteok') {
        items = await parseRemoteOK();
      } else if (source.parser === 'workingnomads') {
        items = await parseWorkingNomads(source.url);
      } else {
        items = await parseRSS(source);
      }

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

  const existingLeads = await prisma.lead.findMany({
    where: { userId, deleted: false },
    select: { url: true, title: true, source: true },
  });
  const existingUrls = new Set(existingLeads.map(l => l.url.toLowerCase().trim()));
  const existingFingerprints = new Set(existingLeads.map(l => fingerprint(l.title, l.source)));

  let leadsCreated = 0;
  const batchData: any[] = [];

  for (const item of allItems) {
    const fp = fingerprint(item.title, item.source);
    const url = item.url.toLowerCase().trim();
    if (existingUrls.has(url) || existingFingerprints.has(fp)) continue;
    existingUrls.add(url);
    existingFingerprints.add(fp);

    const title = item.title;
    const description = item.description;
    const unifiedText = `${title} ${description}`.toLowerCase();
    const industryKeywords: Record<string, string[]> = {
      'Entry Level': ['entry level', 'junior', 'graduate', 'new grad', 'associate', 'early career', 'no experience', 'beginner'],
      'AI Automation': ['automation', 'ai', 'machine learning', 'llm', 'chatgpt', 'gpt', 'genai'],
      'Video Editing': ['video', 'editor', 'editing', 'thumbnail', 'premiere', 'davinci', 'after effects', 'shorts', 'youtube'],
      'Appointment Setter': ['setter', 'appointment', 'cold call', 'outreach', 'lead generation', 'sales development'],
      'Social Media': ['social', 'media', 'marketing', 'instagram', 'tiktok', 'content creator', 'community'],
      'Virtual Assistant': ['assistant', 'virtual assistant', 'va', 'admin support', 'administrative'],
    };

    if (industry !== 'All') {
      const keywords = industryKeywords[industry] || [industry.toLowerCase()];
      if (!keywords.some(k => unifiedText.includes(k))) continue;
    }

    let aiScore = 5;
    if (unifiedText.includes('expert') || unifiedText.includes('senior') || unifiedText.includes('long-term')) aiScore += 2;
    if (unifiedText.includes('budget') || unifiedText.includes('$') || unifiedText.includes('retainer')) aiScore += 2;
    if (unifiedText.includes('urgent') || unifiedText.includes('immediate') || unifiedText.includes('asap')) aiScore += 1;
    if (unifiedText.includes('remote') || unifiedText.includes('flexible')) aiScore += 1;
    if (aiScore > 10) aiScore = 10;

    if (preferences) {
      const roleMatch = preferences.targetRoles.some(r => unifiedText.includes(r.toLowerCase()));
      const skillMatch = preferences.coreSkills.some(s => unifiedText.includes(s.toLowerCase()));
      if (roleMatch) aiScore = Math.min(10, aiScore + 1);
      if (skillMatch) aiScore = Math.min(10, aiScore + 1);
    }

    const budgetMatch = description.match(/(\$[0-9,]+)/);
    const budget = budgetMatch ? budgetMatch[1] : item.budget || 'Open Terms';
    const proposal = `Hi there,\n\nI came across your posting for "${title}" and I'm confident I can deliver great results. I have relevant experience in this exact area and would love to discuss how I can help bring your project to life.\n\nLet me know when you're available for a quick chat.`;

    batchData.push({
      userId,
      title,
      description,
      budget,
      source: item.source,
      url: item.url,
      aiScore,
      proposalDraft: proposal,
      status: 'active',
    });
    leadsCreated++;
  }

  if (batchData.length > 0) {
    await prisma.lead.createMany({ data: batchData, skipDuplicates: true });
  }

  const deleted = await prisma.lead.updateMany({
    where: { userId, deleted: false, aiScore: { lt: 8 }, tracked: false, applied: false },
    data: { deleted: true },
  });

  await prisma.sourceHealth.createMany({
    data: sourceResults.map(sr => ({
      userId,
      source: sr.source,
      success: sr.success,
      leadsCount: sr.count,
      errorMsg: sr.error || null,
    })),
  });

  return { leadsCreated, leadsPruned: deleted.count, sourceResults };
}
