import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { job } = await request.json();
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        { success: false, error: 'DISCORD_WEBHOOK_URL environment variable is missing.' },
        { status: 400 }
      );
    }

    // Format a beautiful rich Discord Embed matching the theme
    const discordPayload = {
      username: 'ApexFetch Dispatch Bot',
      embeds: [
        {
          title: `🎯 ApexFetch Lead Dispatched: ${job.title}`,
          url: job.url || undefined,
          color: 6376669, // Smooth Indigo color hex match
          fields: [
            { name: '🌐 Source Platform', value: `\`${job.source || 'Unknown'}\``, inline: true },
            { name: '💰 Budget/Terms', value: `\`${job.budget || 'Open Terms'}\``, inline: true },
            { name: '⭐️ AI Evaluation Score', value: `\`${job.score || 5}/10\``, inline: true },
            { name: '📊 Projected Profitability', value: job.profitability || 'Medium', inline: true },
            { name: '🛠 Skill Requirements', value: job.difficulty || 'Intermediate', inline: true }
          ],
          description: `### 🤖 AI Assessment Summary\n${job.summary || 'No overview generated.'}\n\n### 📝 Job Context Context\n${(job.description || 'No raw text provided by source site. Check original URL listing context.').substring(0, 1200)}`,
          footer: { text: 'ApexFetch Engine Workflow Pipeline' },
          timestamp: new Date().toISOString()
        }
      ]
    };

    const targetRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordPayload)
    });

    if (!targetRes.ok) {
      throw new Error(`Discord Webhook API returned structural status code: ${targetRes.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Discord Dispatch Failure]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}