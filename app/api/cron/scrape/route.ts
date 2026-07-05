import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runScrapePipeline } from '@/lib/scraper';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      where: { isSubscribed: true },
      include: { preferences: true },
    });

    const results: { userId: string; email: string; leadsCreated: number; leadsPruned: number; error?: string }[] = [];

    for (const user of users) {
      try {
        const blacklistRows = await prisma.blacklistedKeyword.findMany({ where: { userId: user.id } });
        const blacklist = blacklistRows.map(b => b.keyword);

        const result = await runScrapePipeline(
          user.id,
          user.preferences,
          blacklist,
          'All',
          '',
          async () => {},
        );

        results.push({
          userId: user.id,
          email: user.email || 'unknown',
          leadsCreated: result.leadsCreated,
          leadsPruned: result.leadsPruned,
        });

        await delay(2000);
      } catch (err) {
        results.push({
          userId: user.id,
          email: user.email || 'unknown',
          leadsCreated: 0,
          leadsPruned: 0,
          error: String(err),
        });
      }
    }

    const totalNew = results.reduce((sum, r) => sum + r.leadsCreated, 0);
    const totalPruned = results.reduce((sum, r) => sum + r.leadsPruned, 0);

    return NextResponse.json({
      success: true,
      usersProcessed: users.length,
      totalNewLeads: totalNew,
      totalPrunedLeads: totalPruned,
      results,
    });
  } catch (err) {
    console.error('[Cron Scrape] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
