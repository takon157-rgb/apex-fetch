import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { discoverCompanyJobs, extractCompanyDomains, configureSourceRequests } from '@/lib/scraper';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// The weekly worker walks company career pages, which are slow and sometimes
// dead. It therefore handles a bounded slice of domains per call and the
// workflow repeats the call until it reports "done".
const DOMAINS_PER_CALL = numEnv('WORKER_DOMAINS_PER_CALL', 2);
const SOURCE_TIMEOUT_MS = numEnv('WORKER_SOURCE_TIMEOUT_MS', 6000);
const SOURCE_RETRIES = numEnv('WORKER_SOURCE_RETRIES', 1);
const CALL_TIME_BUDGET_MS = numEnv('WORKER_CALL_BUDGET_MS', 25000);

/**
 * Weekly "trend" worker: derive company domains from the job URLs we've
 * already scraped (not from page HTML, which previously harvested asset
 * CDNs), then discover career-page openings for subscribed users.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    configureSourceRequests({ timeoutMs: SOURCE_TIMEOUT_MS, retries: SOURCE_RETRIES });

    const { searchParams } = new URL(req.url);
    const offset = Math.max(0, Number(searchParams.get('offset')) || 0);

    // Pull a sample of recent job URLs from all users to derive company domains.
    const recentLeads = await prisma.lead.findMany({
      where: { deleted: false },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { url: true },
    });

    // Sorted so the offset stays meaningful between calls.
    const domains = [...new Set(extractCompanyDomains(recentLeads.map((l) => l.url)))].sort();
    const slice = domains.slice(offset, offset + DOMAINS_PER_CALL);
    const nextOffset = offset + slice.length;

    // discoverCompanyJobs expects full URLs, not bare hostnames.
    const allLeads =
      slice.length > 0
        ? await discoverCompanyJobs(
            slice.map((d) => `https://${d}`),
            { maxDomains: slice.length, timeBudgetMs: CALL_TIME_BUDGET_MS },
          )
        : [];

    const users = await prisma.user.findMany({
      where:
        (process.env.CRON_INCLUDE_FREE_USERS ?? 'true') !== 'false'
          ? { OR: [{ isSubscribed: true }, { creditsRemaining: { gt: 0 } }] }
          : { isSubscribed: true },
    });
    let totalLeadsCreated = 0;

    for (const user of users) {
      if (allLeads.length === 0) break;

      // One query for the existing URLs instead of a lookup per lead.
      const existing = await prisma.lead.findMany({
        where: { userId: user.id, url: { in: allLeads.map((l) => l.url) } },
        select: { url: true },
      });
      const existingUrls = new Set(existing.map((l) => l.url));

      const fresh = allLeads.filter((l) => !existingUrls.has(l.url));
      if (fresh.length === 0) continue;

      await prisma.lead.createMany({
        data: fresh.map((lead) => ({
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
        })),
      });

      totalLeadsCreated += fresh.length;
    }

    return NextResponse.json({
      success: true,
      done: nextOffset >= domains.length,
      domainsFound: domains.length,
      domainsProcessed: slice.length,
      nextOffset,
      companyLeadsFound: allLeads.length,
      usersProcessed: users.length,
      totalLeadsCreated,
    });
  } catch (err) {
    console.error('[Cron Worker] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
