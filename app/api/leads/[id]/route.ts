import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const lead = await prisma.lead.findUnique({ where: { id: params.id } });
    if (!lead || lead.userId !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const updateData: Record<string, any> = {};

    if (typeof body.tracked === 'boolean') updateData.tracked = body.tracked;
    if (typeof body.applied === 'boolean') {
      updateData.applied = body.applied;
      if (body.applied) updateData.appliedAt = new Date();
    }
    if (typeof body.deleted === 'boolean') updateData.deleted = body.deleted;
    if (typeof body.status === 'string') updateData.status = body.status;
    if (typeof body.aiScore === 'number') updateData.aiScore = body.aiScore;

    const updated = await prisma.lead.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, lead: updated });
  } catch (err) {
    console.error('[Lead PATCH] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const lead = await prisma.lead.findUnique({ where: { id: params.id } });
    if (!lead || lead.userId !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.lead.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Lead DELETE] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
