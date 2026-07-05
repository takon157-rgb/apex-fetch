import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      const session = await prisma.scrapeSession.findUnique({ where: { id: sessionId } });
      if (!session || session.userId !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({
        id: session.id,
        status: session.status,
        totalSources: session.totalSources,
        completedSources: session.completedSources,
        currentSource: session.currentSource,
        leadsFound: session.leadsFound,
        leadsPruned: session.leadsPruned,
        error: session.error,
        progress: session.totalSources > 0 ? Math.round((session.completedSources / session.totalSources) * 100) : 0,
      });
    }

    const latest = await prisma.scrapeSession.findFirst({
      where: { userId: user.id },
      orderBy: { startedAt: 'desc' },
    });

    return NextResponse.json(latest ? {
      id: latest.id,
      status: latest.status,
      totalSources: latest.totalSources,
      completedSources: latest.completedSources,
      currentSource: latest.currentSource,
      leadsFound: latest.leadsFound,
      leadsPruned: latest.leadsPruned,
      error: latest.error,
      progress: latest.totalSources > 0 ? Math.round((latest.completedSources / latest.totalSources) * 100) : 0,
    } : { status: 'idle', progress: 0 });
  } catch (err) {
    console.error('[Scrape Progress] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
