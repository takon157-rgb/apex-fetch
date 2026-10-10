import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { discoverCompanyJobs, extractCompanyDomains } from '@/lib/scraper';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Weekly "trend" worker: derive company domains from the job URLs we've already
 * scraped (not from page HTML, which previously harvested asset CDNs), then
 * discover career-page openings for subscribed users.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pull a sample of recent job URLs from all users to derive company domains.
    const recentLeads = await prisma.lead.findMany({
      where: { deleted: false },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { url: true },
    });

    const domains = extractCompanyDomains(recentLeads.map(l => l.url));
    const companyUrls = domains.map(d => `https://${d}`);

    const allLeads = companyUrls.length > 0 ? await discoverCompanyJobs(companyUrls) : [];

    const users = await prisma.user.findMany({ where: { isSubscribed: true } });
    let totalLeadsCreated = 0;

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
            company: lead.company || null,
            description: lead.description,
            budget: lead.salaryMin ? `$${lead.salaryMin}` : 'Open Terms',
            salaryMin: lead.salaryMin ?? null,
            salaryMax: lead.salaryMax ?? null,
            location: lead.location || null,
            jobType: lead.jobType || null,
            postedAt: lead.postedAt ? new Date(lead.postedAt) : new Date(),
            tags: lead.tags || [],
            source: lead.source,
            url: lead.url,
            aiScore: 6,
            matchReason: 'Discovered from company career page',
            status: 'active',
          },
        });
        userLeads++;
      }
      totalLeadsCreated += userLeads;
    }

    return NextResponse.json({
      success: true,
      domainsFound: domains.length,
      companyLeadsFound: allLeads.length,
      usersProcessed: users.length,
      totalLeadsCreated,
    });
  } catch (err) {
    console.error('[Cron Worker] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
