import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { discordWebhookUrl } = body;

    if (!discordWebhookUrl || typeof discordWebhookUrl !== 'string') {
      return NextResponse.json({ success: false, error: 'No webhook URL provided' }, { status: 400 });
    }

    if (!/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(discordWebhookUrl)) {
      return NextResponse.json({ success: false, error: 'Invalid Discord webhook URL format' }, { status: 400 });
    }

    const testPayload = {
      embeds: [{
        title: '✅ ApexFetch Webhook Test',
        description: 'Your Discord webhook is configured correctly! You will receive high-scoring lead alerts here.',
        color: 5763719,
        footer: { text: 'ApexFetch Engine • Connection Test' },
        timestamp: new Date().toISOString(),
      }],
    };

    const res = await fetch(discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({
        success: false,
        error: `Discord returned ${res.status}: ${text.substring(0, 200)}`,
      }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Discord Test] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
