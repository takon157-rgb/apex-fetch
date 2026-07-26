import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { discoverCompanyJobs } from '@/lib/scraper';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TREND_SOURCES = [
  'https://remoteok.com/remote-jobs',
  'https://weworkremotely.com',
  'https://remotive.io/remote-jobs',
];

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function discoverTrendingTargets(): Promise<string[]> {
  const hosts = new Set<string>();
  for (const url of TREND_SOURCES) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 ApexFetch/2.0' } });
      if (!res.ok) continue;
      const html = await res.text();
      const matches = Array.from(html.matchAll(/https?:\/\/([^\/"'\s]+)\//gi));
      matches.slice(0, 120).forEach((m) => {
        const hostname = m[1].replace(/^www\./, '');
        if (!TREND_SOURCES.some(s => hostname.includes(new URL(s).hostname.replace(/^www\./, '')))) {
          hosts.add(hostname);
        }
      });
      await delay(350);
    } catch {}
  }
  return Array.from(hosts).slice(0, 30);
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron Worker] Starting weekly trend discovery...');
    const trending = await discoverTrendingTargets();
    console.log(`[Cron Worker] Found ${trending.length} trending domains`);

    let totalLeadsCreated = 0;
    const results: { domain: string; leads: number }[] = [];

    const companyUrls = trending.map(d => `https://${d}`);
    const allLeads = await discoverCompanyJobs(companyUrls);

    const users = await prisma.user.findMany({ where: { isSubscribed: true } });

    for (const user of users) {
      let userLeads = 0;
      for (const lead of allLeads) {
        const existing = await prisma.lead.findFirst({
          where: { userId: user.id, url: lead.url },
        });
        if (existing) continue;

        await prisma.lead.create({
          data: {
            userId: user.id,
            title: lead.title,
            description: lead.description,
            budget: lead.budget,
            source: lead.source,
            url: lead.url,
            aiScore: 6,
            status: 'active',
          },
        });
        userLeads++;
      }
      totalLeadsCreated += userLeads;
      results.push({ domain: '(trending)', leads: userLeads });
      await delay(500);
    }

    console.log(`[Cron Worker] Complete. Created ${totalLeadsCreated} leads across ${users.length} users.`);

    return NextResponse.json({
      success: true,
      trendingDomainsFound: trending.length,
      companyLeadsFound: allLeads.length,
      usersProcessed: users.length,
      totalLeadsCreated,
      results,
    });
  } catch (err) {
    console.error('[Cron Worker] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
