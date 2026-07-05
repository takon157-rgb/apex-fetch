import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { runScrapePipeline } from '@/lib/scraper';

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

      const stripHtml = (text: string) => text
        .replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/\\n/g, '\n').replace(/\\t/g, ' ').replace(/\s+/g, ' ').trim();

      const discordPayload = {
        embeds: [{
          title: `🎯 Manual Lead: ${lead.title}`,
          url: lead.url,
          description: stripHtml(lead.description || '').substring(0, 800) || 'No description provided.',
          color: 3447003,
          fields: [
            { name: 'Source', value: lead.source || 'Unknown', inline: true },
            { name: 'Budget', value: lead.budget || 'Not Specified', inline: true },
            { name: 'AI Score', value: `⭐ ${lead.aiScore}/10`, inline: true },
          ],
          footer: { text: 'Manual Dispatch from Dashboard' },
          timestamp: new Date().toISOString(),
        }],
      };

      const discordRes = await fetch(user.discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordPayload),
      });

      if (!discordRes.ok) throw new Error(`Discord returned ${discordRes.status}`);
      return NextResponse.json({ success: true });
    }

    const session = await prisma.scrapeSession.create({
      data: { userId: user.id, totalSources: 14, status: 'running' },
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

    let result: { leadsCreated: number; leadsPruned: number; sourceResults: { source: string; success: boolean; count: number; error?: string }[] };
    try {
      result = await runScrapePipeline(user.id, preferences, blacklist, selectedIndustry, nicheQuery, onProgress);

      if (user.discordWebhookUrl && result.leadsCreated > 0) {
        const { sendJobDiscordAlert } = await import('@/lib/discord');
        const stripHtml = (text: string) => text.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\\n/g, '\n').replace(/\s+/g, ' ').trim();

        const highScoring = await prisma.lead.findMany({
          where: { userId: user.id, aiScore: { gte: 7 }, createdAt: { gte: new Date(Date.now() - 60000) } },
          take: 5,
        });

        for (const l of highScoring) {
          try {
            await sendJobDiscordAlert(user.discordWebhookUrl, {
              title: l.title, url: l.url, description: stripHtml(l.description || ''),
              source: l.source, budget: l.budget, aiScore: l.aiScore,
            }, 'auto');
            await new Promise(r => setTimeout(r, 500));
          } catch {}
        }
      }

      await prisma.scrapeSession.update({
        where: { id: session.id },
        data: { status: 'completed', completedSources: 14, leadsFound: result.leadsCreated, leadsPruned: result.leadsPruned, completedAt: new Date() },
      });
    } catch (err) {
      await prisma.scrapeSession.update({
        where: { id: session.id },
        data: { status: 'error', error: String(err), completedAt: new Date() },
      });
      throw err;
    }

    const totalLeads = await prisma.lead.findMany({
      where: { userId: user.id, deleted: false },
      orderBy: { createdAt: 'desc' },
    });

    const sourcesWithNew = result.sourceResults.filter(s => s.success && s.count > 0).map(s => s.source);
    return NextResponse.json({
      success: true,
      sessionId: session.id,
      leadsCreated: result.leadsCreated,
      leadsPruned: result.leadsPruned,
      sources: sourcesWithNew,
      stats: `Found ${result.leadsCreated} new leads across ${sourcesWithNew.length} sources: ${sourcesWithNew.join(', ') || 'none'}`,
      leads: totalLeads,
    });
  } catch (err: unknown) {
    console.error('[Scrape] Fatal:', err);
    return NextResponse.json({ error: true, message: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
