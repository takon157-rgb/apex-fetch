import { prisma } from './prisma';

interface LocalBusinessLead {
  id: string;
  businessName: string;
  niche: string;
  city: string;
  address: string;
  phoneNumber: string;
  rating: number;
  reviewCount: number;
  googleMapsUrl: string;
  opportunityScore: number;
  aiAnalysis: string;
  coldCallScript: string;
  emailPitch: string;
  status: string;
  createdAt: string;
}

async function getUserWebhookUrl(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (user?.discordWebhookUrl) return user.discordWebhookUrl;
  } catch {
    // DB error — skip notification
  }
  return null;
}

export async function sendLocalLeadDiscordAlert(
  lead: LocalBusinessLead,
  userId?: string
): Promise<boolean> {
  const webhookUrl = await getUserWebhookUrl(userId || null);

  if (!webhookUrl) {
    console.warn('⚠️ No Discord webhook URL configured. Set one in your Profile settings or add DISCORD_WEBHOOK_URL to .env');
    return false;
  }

  if (lead.opportunityScore < 8) {
    console.log(`[Discord] Lead opportunity score is ${lead.opportunityScore} (< 8). Skipping notification.`);
    return false;
  }

  const embed = {
    title: `🎯 High-Opportunity Local Lead: ${lead.businessName}`,
    url: lead.googleMapsUrl,
    color: lead.opportunityScore >= 9 ? 0x00ff00 : 0xffaa00,
    fields: [
      {
        name: '🏙️ Location',
        value: `${lead.city}, ${lead.address}`,
        inline: false,
      },
      {
        name: '🏢 Industry',
        value: lead.niche,
        inline: true,
      },
      {
        name: '⭐ Rating',
        value: `${lead.rating}/5 (${lead.reviewCount} reviews)`,
        inline: true,
      },
      {
        name: '📊 Opportunity Score',
        value: `**${lead.opportunityScore}/10**`,
        inline: true,
      },
      {
        name: '📞 Phone',
        value: `\`${lead.phoneNumber}\``,
        inline: true,
      },
      {
        name: '🔍 Analysis',
        value: lead.aiAnalysis.substring(0, 300) + '...',
        inline: false,
      },
      {
        name: '☎️ Cold Call Script',
        value: `\`\`\`\n${lead.coldCallScript.substring(0, 400)}\n\`\`\``,
        inline: false,
      },
      {
        name: '📧 Email Pitch',
        value: `\`\`\`\n${lead.emailPitch.substring(0, 300)}\n\`\`\``,
        inline: false,
      },
    ],
    footer: {
      text: `Status: ${lead.status} | Created: ${new Date(lead.createdAt).toLocaleDateString()}`,
    },
    timestamp: new Date().toISOString(),
  };

  const payload = {
    username: 'Local Lead Generator',
    avatar_url: 'https://cdn-icons-png.flaticon.com/512/1995/1995467.png',
    embeds: [embed],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status}`);
    }

    console.log(`✅ Discord alert sent for: ${lead.businessName}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send Discord notification:', error);
    return false;
  }
}

export async function sendBulkDiscordAlerts(
  leads: LocalBusinessLead[],
  userId?: string
): Promise<number> {
  let successCount = 0;

  for (const lead of leads) {
    try {
      const success = await sendLocalLeadDiscordAlert(lead, userId);
      if (success) successCount++;
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error sending alert for ${lead.businessName}:`, error);
    }
  }

  console.log(`[Discord] Sent ${successCount}/${leads.length} alert notifications`);
  return successCount;
}
