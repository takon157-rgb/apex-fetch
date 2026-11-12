import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runScrapePipeline, SOURCES, configureSourceRequests } from '@/lib/scraper';
import { cleanupStaleLeads } from '@/lib/maintenance';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// The cron runs inside a serverless function too, so it gets the same
// bounded-slice treatment as the dashboard's "Pull" button: one slice per
// request, and the caller (the GitHub Actions workflow) repeats the call.
const SOURCES_PER_BATCH = numEnv('SCRAPE_BATCH_SIZE', 4);
const SOURCE_TIMEOUT_MS = numEnv('SCRAPE_SOURCE_TIMEOUT_MS', 6000);
const SOURCE_RETRIES = numEnv('SCRAPE_SOURCE_RETRIES', 1);
const BATCH_TIME_BUDGET_MS = numEnv('SCRAPE_BATCH_BUDGET_MS', 35000);
const DISCOVERY_TIME_BUDGET_MS = numEnv('SCRAPE_DISCOVERY_BUDGET_MS', 20000);

const TOTAL_UNITS = SOURCES.length + 1;

/**
 * Daily scrape for subscribed accounts.
 *
 * Each call performs one bounded slice for one account and returns `done:
 * false` while there is more to do. The workflow loops until it sees
 * `done: true`. Running the whole pipeline in a single invocation was
 * silently killed by the platform's function timeout, which left the daily
 * job doing nothing.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    configureSourceRequests({ timeoutMs: SOURCE_TIMEOUT_MS, retries: SOURCE_RETRIES });

    // Every account that could otherwise pull jobs for itself gets a fresh
    // feed each day. Restricting this to paid accounts silently turned the
    // daily job into a no-op, because the free tier is where most accounts
    // live - and a stale feed is the opposite of what the product promises.
    // Credits still gate manual runs; this is the once-a-day refresh.
    const includeFreeUsers = (process.env.CRON_INCLUDE_FREE_USERS ?? 'true') !== 'false';

    const accounts = await prisma.user.findMany({
      where: includeFreeUsers
        ? { OR: [{ isSubscribed: true }, { creditsRemaining: { gt: 0 } }] }
        : { isSubscribed: true },
      orderBy: { createdAt: 'asc' },
      include: { preferences: true },
    });

    if (accounts.length === 0) {
      const stale = await cleanupStaleLeads(45);
      return NextResponse.json({
        success: true,
        done: true,
        reason: 'No accounts to scrape for',
        staleRemoved: stale.removed,
      });
    }

    const userIds = accounts.map((u) => u.id);
    const userById = new Map(accounts.map((u) => [u.id, u]));

    // Resume the oldest unfinished run before starting a new one.
    let session = await prisma.scrapeSession.findFirst({
      where: { status: 'running', userId: { in: userIds } },
      orderBy: { startedAt: 'asc' },
    });

    if (!session) {
      // Accounts already scraped in the last 12 hours are left alone.
      const since = new Date(Date.now() - 12 * 60 * 60 * 1000);
      const recent = await prisma.scrapeSession.findMany({
        where: { userId: { in: userIds }, startedAt: { gte: since } },
        select: { userId: true },
      });
      const alreadyRan = new Set(recent.map((s) => s.userId));
      const nextUser = accounts.find((u) => !alreadyRan.has(u.id));

      if (!nextUser) {
        const stale = await cleanupStaleLeads(45);
        return NextResponse.json({
          success: true,
          done: true,
          reason: 'Every account has been scraped in the last 12 hours',
          staleRemoved: stale.removed,
        });
      }

      session = await prisma.scrapeSession.create({
        data: { userId: nextUser.id, totalSources: TOTAL_UNITS, status: 'running' },
      });
    }

    const user = userById.get(session.userId);
    if (!user) {
      await prisma.scrapeSession.update({
        where: { id: session.id },
        data: { status: 'error', error: 'Account no longer exists', completedAt: new Date() },
      });
      return NextResponse.json({ success: true, done: false, sessionId: session.id });
    }

    const blacklistRows = await prisma.blacklistedKeyword.findMany({ where: { userId: user.id } });
    const blacklist = blacklistRows.map((b) => b.keyword);

    const completed = session.completedSources;
    const onProgress = async (done: number, total: number, current: string, leadsFound: number) => {
      await prisma.scrapeSession.update({
        where: { id: session!.id },
        data: { completedSources: done, currentSource: current, leadsFound },
      });
    };

    // Phase 1 - the registered boards, a slice at a time.
    if (completed < SOURCES.length) {
      const result = await runScrapePipeline(
        user.id,
        user.preferences,
        blacklist,
        'All',
        '',
        onProgress,
        {
          sourceOffset: completed,
          sourceLimit: SOURCES_PER_BATCH,
          timeBudgetMs: BATCH_TIME_BUDGET_MS,
        },
      );

      await prisma.scrapeSession.update({
        where: { id: session.id },
        data: {
          completedSources: result.nextOffset,
          leadsFound: { increment: result.leadsCreated },
        },
      });

      return NextResponse.json({
        success: true,
        done: false,
        phase: 'sources',
        sessionId: session.id,
        userId: user.id,
        email: user.email,
        completedSources: result.nextOffset,
        totalSources: TOTAL_UNITS,
        leadsCreated: result.leadsCreated,
      });
    }

    // Phase 2 - company career-page discovery.
    if (completed === SOURCES.length) {
      const result = await runScrapePipeline(
        user.id,
        user.preferences,
        blacklist,
        'All',
        '',
        onProgress,
        { sourceOffset: SOURCES.length, discovery: true, discoveryTimeBudgetMs: DISCOVERY_TIME_BUDGET_MS },
      );

      await prisma.scrapeSession.update({
        where: { id: session.id },
        data: {
          completedSources: TOTAL_UNITS,
          leadsFound: { increment: result.leadsCreated },
        },
      });

      return NextResponse.json({
        success: true,
        done: false,
        phase: 'discovery',
        sessionId: session.id,
        userId: user.id,
        completedSources: TOTAL_UNITS,
        totalSources: TOTAL_UNITS,
        leadsCreated: result.leadsCreated,
      });
    }

    // Phase 3 - this account is finished.
    await prisma.scrapeSession.update({
      where: { id: session.id },
      data: { status: 'completed', completedSources: TOTAL_UNITS, completedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      done: false,
      phase: 'complete',
      sessionId: session.id,
      userId: user.id,
      email: user.email,
      completedSources: TOTAL_UNITS,
      totalSources: TOTAL_UNITS,
      note: 'Account finished - call again to move to the next one.',
    });
  } catch (err) {
    console.error('[Cron Scrape] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
