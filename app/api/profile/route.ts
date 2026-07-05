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
    if (!payload) return NextResponse.json({ error: 'No payload' }, { status: 400 });

    const profile = await prisma.careerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        name: payload.name || payload.fullName || 'Unnamed',
        email: payload.email || '',
        resumeFileName: payload.resumeFileName || '',
        resumeBase64: payload.resumeBase64 || '',
        resumeText: payload.resumeText || '',
      },
      update: {
        name: payload.name || payload.fullName || 'Unnamed',
        email: payload.email || '',
        resumeFileName: payload.resumeFileName || '',
        resumeBase64: payload.resumeBase64 || '',
        resumeText: payload.resumeText || '',
      },
    });

    return NextResponse.json({ success: true, profile });
  } catch (err) {
    console.error('[Profile API] Error saving profile:', err);
    return NextResponse.json({ error: true, message: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ profile: null });

    const profile = await prisma.careerProfile.findUnique({ where: { userId: user.id } });
    return NextResponse.json({ profile });
  } catch (err) {
    console.error('[Profile API] Error fetching profile:', err);
    return NextResponse.json({ error: true, message: (err as Error).message }, { status: 500 });
  }
}
