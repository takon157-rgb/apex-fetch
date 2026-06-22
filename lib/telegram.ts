import { JobOpportunity } from './types';

/**
 * Sends high-scoring opportunity alerts straight to your Discord channel 
 * using beautiful rich markdown embeds.
 */
export async function sendTelegramAlert(job: JobOpportunity): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error('❌ Discord Alert Error: DISCORD_WEBHOOK_URL environment variable is missing.');
    return false;
  }

  // Construct a rich Discord layout embed
  const payload = {
    embeds: [
      {
        title: `🚀 New Lead: ${job.title}`,
        url: job.url || undefined,
        color: (job.score ?? 0) >= 9 ? 3066993 : 15105570,
        fields: [
          {
            name: '📊 Match Score',
            value: `**${job.score ?? 'N/A'}/10**`,
            inline: true
          },
          {
            name: '💰 Budget / Pay',
            value: `\`${job.budget || 'Not specified'}\``,
            inline: true
          },
          {
            name: '🌐 Source Platform',
            value: job.source || 'Unknown',
            inline: true
          }
        ],
        description: `**AI Summary:**\n${job.summary || job.description?.substring(0, 200) + '...'}\n\n**🤖 Generated AI Proposal Preview:**\n\`\`\`text\n${(job.proposal || '').substring(0, 800) || 'No proposal generated.'}${(job.proposal || '').length > 800 ? '...' : ''}\n\`\`\``,
        footer: {
          text: `Found at ${job.postedTime || new Date().toLocaleTimeString()}`
        }
      }
    ]
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Discord API responded with status ${response.status}`);
    }

    console.log(`✅ Rich Discord alert dispatched for job: ${job.title}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to push notification update to Discord:', error);
    return false;
  }
}