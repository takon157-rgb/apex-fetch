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

    const body = await req.json();
    const { id, title, description } = body;
    if (!id || !title) return NextResponse.json({ success: false, error: 'Missing id or title' }, { status: 400 });

    const existing = await prisma.reviewedJob.findFirst({
      where: { userId: user.id, id },
    });

    if (!existing) {
      await prisma.reviewedJob.create({
        data: {
          id,
          userId: user.id,
          title,
          description: description || '',
        },
      });
    }

    const jobs = await prisma.reviewedJob.findMany({
      where: { userId: user.id },
      orderBy: { reviewedAt: 'desc' },
    });

    return NextResponse.json({ success: true, jobs });
  } catch (err) {
    console.error('[Review Job] Error:', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ jobs: [] });

    const jobs = await prisma.reviewedJob.findMany({
      where: { userId: user.id },
      orderBy: { reviewedAt: 'desc' },
    });

    return NextResponse.json({ success: true, jobs });
  } catch (err) {
    console.error('[Review Job] Error:', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
