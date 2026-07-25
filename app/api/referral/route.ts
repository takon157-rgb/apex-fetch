import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { code } = await req.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Missing referral code' }, { status: 400 });
    }

    if (user.referredBy) {
      return NextResponse.json({ error: 'You already used a referral code' }, { status: 400 });
    }

    if (code === user.referralCode) {
      return NextResponse.json({ error: 'Cannot use your own referral code' }, { status: 400 });
    }

    const referrer = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!referrer) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { referredBy: referrer.id, creditsRemaining: { increment: 5 } },
      }),
      prisma.user.update({
        where: { id: referrer.id },
        data: { creditsRemaining: { increment: 5 } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      bonus: 5,
      message: 'Referral applied! You and your referrer each got 5 bonus credits.',
    });
  } catch (err) {
    console.error('[Referral] Error:', err);
    return NextResponse.json({ error: 'Failed to apply referral' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({
      referralCode: user.referralCode,
      referredBy: user.referredBy,
      creditsRemaining: user.creditsRemaining,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch referral info' }, { status: 500 });
  }
}
