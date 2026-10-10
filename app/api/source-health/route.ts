import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getSourceHealth } from '@/lib/maintenance';

export const dynamic = 'force-dynamic';

// Per-user scraper health: per-source success rate + total leads over a window.
export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const days = Math.min(30, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '7', 10) || 7));
  const health = await getSourceHealth(user.id, days);

  return NextResponse.json(health, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
