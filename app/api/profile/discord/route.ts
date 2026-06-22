import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      user = await prisma.user.create({
        data: { clerkId: userId },
      });
    }

    return NextResponse.json({
      success: true,
      discordWebhookUrl: user.discordWebhookUrl || '',
    });
  } catch (error) {
    console.error('[Profile Discord] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch webhook' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { discordWebhookUrl } = body;

    if (typeof discordWebhookUrl !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid webhook URL' }, { status: 400 });
    }

    const user = await prisma.user.upsert({
      where: { clerkId: userId },
      update: { discordWebhookUrl },
      create: {
        clerkId: userId,
        discordWebhookUrl,
      },
    });

    return NextResponse.json({
      success: true,
      discordWebhookUrl: user.discordWebhookUrl || '',
    });
  } catch (error) {
    console.error('[Profile Discord] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save webhook' }, { status: 500 });
  }
}
