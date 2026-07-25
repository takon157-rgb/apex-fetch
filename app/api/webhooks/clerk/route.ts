import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json({ error: 'CLERK_WEBHOOK_SECRET not configured' }, { status: 500 });
    }

    const svix = new Webhook(webhookSecret);
    const payload = await req.text();
    const headers = {
      'svix-id': req.headers.get('svix-id') || '',
      'svix-timestamp': req.headers.get('svix-timestamp') || '',
      'svix-signature': req.headers.get('svix-signature') || '',
    };

    let body: any;
    try {
      body = svix.verify(payload, headers);
    } catch {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

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

    if (type === 'user.deleted') {
      const clerkId = data.id;
      await prisma.user.deleteMany({ where: { clerkId } });
      console.log(`[Clerk Webhook] User deleted: ${clerkId}`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Clerk Webhook] Error:', err);
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 });
  }
}
