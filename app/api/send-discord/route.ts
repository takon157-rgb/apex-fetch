import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { job } = await req.json();
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    const response = await fetch(webhookUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'ApexFetch Dispatch',
        embeds: [{
          title: `ApexFetch Opportunity Alert: ${job.title}`,
          description: job.proposal,
          color: 0x5865F2,
          fields: [{ name: 'Budget', value: job.budget, inline: true }]
        }]
      }),
    });

    if (!response.ok) throw new Error('Discord failed');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Webhook failed' }, { status: 500 });
  }
}