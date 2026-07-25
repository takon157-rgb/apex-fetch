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

    const payload = await req.json().catch(() => ({}));
    if (!payload || !payload.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const lead = await prisma.lead.findFirst({
      where: { id: payload.id, userId: user.id },
    });
    if (!lead) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    await prisma.lead.update({
      where: { id: payload.id },
      data: {
        applied: true,
        appliedAt: new Date(),
        status: 'applied',
      },
    });

    return NextResponse.json({ success: true, id: payload.id });
  } catch (err) {
    return NextResponse.json({ error: true, message: (err as Error).message }, { status: 500 });
  }
}
