import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 1];

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing lead ID' }, { status: 400 });
    }

    const payload = await req.json().catch(() => ({}));
    const status = payload.status as string;

    if (!status) {
      return NextResponse.json({ success: false, error: 'Invalid lead status' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const lead = await prisma.localLead.findFirst({
      where: { id, userId: user.id },
    });
    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    await prisma.localLead.update({
      where: { id },
      data: { status },
    });

    const leads = await prisma.localLead.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, lead: { ...lead, status }, leads });
  } catch (error) {
    console.error('[Scrape Local ID] PATCH error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update lead status' },
      { status: 500 }
    );
  }
}
