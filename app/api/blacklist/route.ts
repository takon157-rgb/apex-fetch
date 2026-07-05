import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ keywords: [] });

    const keywords = await prisma.blacklistedKeyword.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ keywords: keywords.map(k => k.keyword) });
  } catch (err) {
    console.error('[Blacklist GET] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { keyword } = await req.json();
    if (!keyword || typeof keyword !== 'string') return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });

    const existing = await prisma.blacklistedKeyword.findUnique({
      where: { userId_keyword: { userId: user.id, keyword: keyword.toLowerCase().trim() } },
    });
    if (existing) return NextResponse.json({ success: true, keyword: existing.keyword });

    const created = await prisma.blacklistedKeyword.create({
      data: { userId: user.id, keyword: keyword.toLowerCase().trim() },
    });

    return NextResponse.json({ success: true, keyword: created.keyword });
  } catch (err) {
    console.error('[Blacklist POST] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { keyword } = await req.json();
    if (!keyword) return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });

    await prisma.blacklistedKeyword.deleteMany({
      where: { userId: user.id, keyword: keyword.toLowerCase().trim() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Blacklist DELETE] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
