import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let user = await prisma.user.upsert({
    where: { clerkId: userId },
    create: {
      clerkId: userId,
      creditsRemaining: 10,
    },
    update: {},
  });

  const clerk = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
  }).then((r) => r.json()).catch(() => ({}));

  if (clerk.email_addresses || clerk.first_name) {
    const email = clerk.email_addresses?.[0]?.email_address || null;
    const name = [clerk.first_name, clerk.last_name].filter(Boolean).join(' ') || null;
    if (email || name) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { ...(email && { email }), ...(name && { name }) },
      });
    }
  }

  return NextResponse.json({ success: true, user });
}
