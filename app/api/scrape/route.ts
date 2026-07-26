import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { runScrapePipeline, SOURCES, cleanHtml } from '@/lib/scraper';
import { sendJobDiscordAlert } from '@/lib/discord';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const payload = await req.json().catch(() => ({}));
    const { action, id, status: newStatus, industry, query } = payload;

    if (action === 'update_status') {
      const lead = await prisma.lead.findUnique({ where: { id } });
      if (!lead || lead.userId !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await prisma.lead.update({ where: { id }, data: { deleted: newStatus === 'deleted', status: newStatus } });
      return NextResponse.json({ success: true });
    }

    if (action === 'purge') {
      const lead = await prisma.lead.findUnique({ where: { id } });
      if (!lead || lead.userId !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await prisma.lead.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    if (action === 'discord_dispatch') {
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

    const session = await prisma.scrapeSession.create({
      data: { userId: user.id, totalSources: SOURCES.length, status: 'running' },
    });

    const preferences = await prisma.userPreference.findUnique({ where: { userId: user.id } });
    const blacklistRows = await prisma.blacklistedKeyword.findMany({ where: { userId: user.id } });
    const blacklist = blacklistRows.map(b => b.keyword);

    const selectedIndustry = (payload.industry as string) || 'All';
    const nicheQuery = (payload.query as string) || '';

    const onProgress = async (completed: number, total: number, current: string, leadsFound: number) => {
      await prisma.scrapeSession.update({
        where: { id: session.id },
        data: { completedSources: completed, currentSource: current, leadsFound },
      });
    };

    runScrapePipeline(user.id, preferences, blacklist, selectedIndustry, nicheQuery, onProgress)
      .then(async (result) => {
        if (user.discordWebhookUrl && result.leadsCreated > 0) {
          const highScoring = await prisma.lead.findMany({
            where: { userId: user.id, aiScore: { gte: 7 }, createdAt: { gte: new Date(Date.now() - 60000) } },
            take: 5,
          });

          for (const l of highScoring) {
            try {
              await sendJobDiscordAlert(user.discordWebhookUrl, {
                title: l.title, url: l.url, description: cleanHtml(l.description || ''),
                source: l.source, budget: l.budget, aiScore: l.aiScore,
              }, 'auto');
              await new Promise(r => setTimeout(r, 500));
            } catch (err) {
              console.error('[Scrape] Discord dispatch error:', err);
            }
          }
        }

        await prisma.scrapeSession.update({
          where: { id: session.id },
          data: { status: 'completed', completedSources: SOURCES.length, leadsFound: result.leadsCreated, leadsPruned: result.leadsPruned, completedAt: new Date() },
        });
      })
      .catch(async (err) => {
        console.error('[Scrape] Pipeline error:', err);
        await prisma.scrapeSession.update({
          where: { id: session.id },
          data: { status: 'error', error: String(err), completedAt: new Date() },
        });
      });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
    });
  } catch (err: unknown) {
    console.error('[Scrape] Fatal:', err);
    return NextResponse.json({ error: true, message: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
