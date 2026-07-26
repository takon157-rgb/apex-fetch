import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { rateLimitByUser } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function isAdmin(clerkId: string): boolean {
  return clerkId === (process.env.ADMIN_CLERK_ID || '');
}

export async function GET() {
  const { userId } = await auth();
  if (!userId || !isAdmin(userId)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const rl = rateLimitByUser(userId, 30, 60000);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const users = await prisma.user.findMany({
      include: {
        _count: {
          select: { leads: true, localLeads: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalScrapes = users.reduce((sum, u) => sum + u._count.leads, 0);

    return NextResponse.json({
      success: true,
      totalUsers: users.length,
      totalScrapes,
      users: users.map(u => ({
        id: u.id,
        clerkId: u.clerkId,
        email: u.email,
        name: u.name,
        isSubscribed: u.isSubscribed,
        creditsRemaining: u.creditsRemaining,
        _count: u._count,
      })),
    });
  } catch (error) {
    console.error('[Admin] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId || !isAdmin(userId)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const rl = rateLimitByUser(userId, 30, 60000);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const body = await req.json();
    const targetUserId = typeof body.userId === 'string' ? body.userId : '';
    const isSubscribed = typeof body.isSubscribed === 'boolean' ? body.isSubscribed : undefined;
    const credits = typeof body.credits === 'number' && body.credits >= 0 ? Math.floor(body.credits) : undefined;

    if (!targetUserId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (isSubscribed !== undefined) updateData.isSubscribed = isSubscribed;
    if (credits !== undefined) updateData.creditsRemaining = credits;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin] PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}
