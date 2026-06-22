import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body;

    if (type === 'user.created' || type === 'user.updated') {
      const clerkId = data.id;
      const email = data.email_addresses?.[0]?.email_address || null;
      const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || null;

      await prisma.user.upsert({
        where: { clerkId },
        create: { clerkId, email, name, creditsRemaining: 10 },
        update: { email, name },
      });

      console.log(`[Clerk Webhook] User ${type}: ${clerkId} (${email})`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Clerk Webhook] Error:', err);
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 });
  }
}
