import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { initializeTransaction, PLANS, getAppUrl } from '@/lib/paystack';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { plan } = await req.json();
    const selectedPlan = PLANS[plan as keyof typeof PLANS];
    if (!selectedPlan || !selectedPlan.planCode) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const result = await initializeTransaction({
      email: user.email || '',
      amount: 0,
      plan: selectedPlan.planCode,
      metadata: { userId: user.id, plan },
      callbackUrl: `${getAppUrl()}/dashboard/success`,
    });

    return NextResponse.json({ url: result.authorization_url });
  } catch (err) {
    console.error('[Paystack Init] Error:', err);
    return NextResponse.json({ error: 'Failed to initialize payment' }, { status: 500 });
  }
}
