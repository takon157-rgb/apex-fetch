import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import {
  runScrapePipeline,
  SOURCES,
  cleanHtml,
  configureSourceRequests,
} from '@/lib/scraper';
import { sendJobDiscordAlert } from '@/lib/discord';
import { rateLimitByUser } from '@/lib/rate-limit';
import { assertString } from '@/lib/validate';
import { cleanupStaleLeads } from '@/lib/maintenance';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const SCRAPE_COST = 1;

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// A serverless invocation handles a bounded batch; the browser resumes the run.
const SOURCES_PER_BATCH = numEnv('SCRAPE_BATCH_SIZE', 4);
const SOURCE_TIMEOUT_MS = numEnv('SCRAPE_SOURCE_TIMEOUT_MS', 6000);
const SOURCE_RETRIES = numEnv('SCRAPE_SOURCE_RETRIES', 1);
const BATCH_TIME_BUDGET_MS = numEnv('SCRAPE_BATCH_BUDGET_MS', 35000);
const DISCOVERY_TIME_BUDGET_MS = numEnv('SCRAPE_DISCOVERY_BUDGET_MS', 20000);
const TOTAL_UNITS = SOURCES.length + 1;

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rl = rateLimitByUser(clerkId, 40, 60000);
    if (!rl.allowed) return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const payload = await req.json().catch(() => ({}));
    const action = assertString(payload.action);
    const id = assertString(payload.id);
    const newStatus = assertString(payload.status, 50);

    if (action === 'update_status') {
      if (!id || !newStatus) return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
      const lead = await prisma.lead.findUnique({ where: { id } });
      if (!lead || lead.userId !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await prisma.lead.update({ where: { id }, data: { deleted: newStatus === 'deleted', status: newStatus } });
      return NextResponse.json({ success: true });
    }

    if (action === 'purge') {
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const lead = await prisma.lead.findUnique({ where: { id } });
      if (!lead || lead.userId !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await prisma.lead.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    if (action === 'discord_dispatch') {
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const lead = await prisma.lead.findUnique({ where: { id } });
      if (!lead || lead.userId !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (!user.discordWebhookUrl) return NextResponse.json({ error: 'No Discord webhook configured' }, { status: 400 });
      await sendJobDiscordAlert(user.discordWebhookUrl, {
        title: lead.title,
        url: lead.url,
        description: cleanHtml(lead.description || ''),
        source: lead.source,
        budget: lead.budget,
        aiScore: lead.aiScore,
      }, 'manual');
      return NextResponse.json({ success: true });
    }

    const sessionId = assertString(payload.sessionId, 64);
    let session = sessionId ? await prisma.scrapeSession.findUnique({ where: { id: sessionId } }) : null;
    if (sessionId && (!session || session.userId !== user.id)) {
      return NextResponse.json({ error: 'Scrape session not found' }, { status: 404 });
    }

    if (!session) {
      if (!user.isSubscribed && user.creditsRemaining < SCRAPE_COST) {
        return NextResponse.json({ error: 'Insufficient credits. Upgrade your plan or wait for reset.' }, { status: 403 });
      }
      await prisma.scrapeSession.updateMany({
        where: { userId: user.id, status: 'running' },
        data: { status: 'error', error: 'Interrupted - superseded by a newer run', completedAt: new Date() },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { creditsRemaining: user.isSubscribed ? undefined : { decrement: SCRAPE_COST } },
      });
      session = await prisma.scrapeSession.create({
        data: { userId: user.id, totalSources: TOTAL_UNITS, status: 'running' },
      });
    }

    if (session.status !== 'running') {
      return NextResponse.json({ success: true, sessionId: session.id, done: true, status: session.status });
    }

    const preferences = await prisma.userPreference.findUnique({ where: { userId: user.id } });
    const blacklistRows = await prisma.blacklistedKeyword.findMany({ where: { userId: user.id } });
    const blacklist = blacklistRows.map((row) => row.keyword);
    const selectedIndustry = assertString(payload.industry) || 'All';
    const nicheQuery = assertString(payload.query);
    configureSourceRequests({ timeoutMs: SOURCE_TIMEOUT_MS, retries: SOURCE_RETRIES });

    const completed = session.completedSources;
    const onProgress = async (done: number, _total: number, current: string) => {
      // leadsFound is incremented once per completed batch below. Don't write
      // the batch-local count here or the session total gets double-counted.
      await prisma.scrapeSession.update({
        where: { id: session!.id },
        data: { completedSources: done, currentSource: current },
      });
    };

    try {
      if (completed < SOURCES.length) {
        const result = await runScrapePipeline(
          user.id, preferences, blacklist, selectedIndustry, nicheQuery, onProgress,
          { sourceOffset: completed, sourceLimit: SOURCES_PER_BATCH, timeBudgetMs: BATCH_TIME_BUDGET_MS },
        );
        await prisma.scrapeSession.update({
          where: { id: session.id },
          data: { completedSources: result.nextOffset, leadsFound: { increment: result.leadsCreated } },
        });
        return NextResponse.json({
          success: true,
          sessionId: session.id,
          // Even after the last board batch, the client must call again for
          // the saved-target/company-career discovery and finalization phases.
          done: false,
          phase: 'sources',
          completedSources: result.nextOffset,
          totalSources: TOTAL_UNITS,
          leadsCreated: result.leadsCreated,
          sourcesProcessed: result.sourceResults.length,
        });
      }

      if (completed === SOURCES.length) {
        const result = await runScrapePipeline(
          user.id, preferences, blacklist, selectedIndustry, nicheQuery, onProgress,
          { sourceOffset: SOURCES.length, discovery: true, discoveryTimeBudgetMs: DISCOVERY_TIME_BUDGET_MS },
        );
        await prisma.scrapeSession.update({
          where: { id: session.id },
          data: { completedSources: TOTAL_UNITS, leadsFound: { increment: result.leadsCreated } },
        });
        return NextResponse.json({
          success: true,
          sessionId: session.id,
          done: false,
          phase: 'discovery',
          completedSources: TOTAL_UNITS,
          totalSources: TOTAL_UNITS,
          leadsCreated: result.leadsCreated,
        });
      }

      const stale = await cleanupStaleLeads(45);
      if (user.discordWebhookUrl) {
        try {
          const highScoring = await prisma.lead.findMany({
            where: { userId: user.id, aiScore: { gte: 7 }, createdAt: { gte: new Date(Date.now() - 60000) } },
            take: 5,
          });
          for (const lead of highScoring) {
            try {
              await sendJobDiscordAlert(user.discordWebhookUrl, {
                title: lead.title, url: lead.url, description: cleanHtml(lead.description || ''),
                source: lead.source, budget: lead.budget, aiScore: lead.aiScore,
              }, 'auto');
              await new Promise((resolve) => setTimeout(resolve, 500));
            } catch (error) {
              console.error('[Scrape] Discord dispatch error:', error);
            }
          }
        } catch (error) {
          console.error('[Scrape] Discord dispatch failed:', error);
        }
      }
      await prisma.scrapeSession.update({
        where: { id: session.id },
        data: { status: 'completed', completedSources: TOTAL_UNITS, leadsPruned: stale.removed, completedAt: new Date() },
      });
      return NextResponse.json({
        success: true,
        sessionId: session.id,
        done: true,
        phase: 'complete',
        completedSources: TOTAL_UNITS,
        totalSources: TOTAL_UNITS,
        leadsPruned: stale.removed,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Scrape] Pipeline error:', error);
      await prisma.scrapeSession.update({
        where: { id: session.id },
        data: { status: 'error', error: message, completedAt: new Date() },
      });
      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (error) {
    console.error('[Scrape] Fatal:', error);
    return NextResponse.json(
      { error: true, message: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
