import { prisma } from './prisma';

export async function sendJobDiscordAlert(
  webhookUrl: string,
  job: { title: string; url: string; description: string; source: string; budget: string; aiScore: number; summary?: string; proposal?: string },
  mode: 'manual' | 'auto' = 'auto',
): Promise<boolean> {
  try {
    const discordPayload = {
      embeds: [{
        title: `${mode === 'manual' ? '🎯 Manual' : '🚨 Live Pipeline'} Lead: ${job.title}`,
        url: job.url || undefined,
        description: job.description?.substring(0, 800) || 'No description provided.',
        color: mode === 'manual' ? 3447003 : 5763719,
        fields: [
          { name: 'Source', value: job.source || 'Unknown', inline: true },
          { name: 'Budget', value: job.budget || 'Not Specified', inline: true },
          { name: 'AI Score', value: `⭐ ${job.aiScore}/10`, inline: true },
          ...(job.summary ? [{ name: 'Summary', value: job.summary.substring(0, 500) }] : []),
          ...(job.proposal ? [{ name: 'Proposal', value: job.proposal.substring(0, 500) }] : []),
        ],
        footer: { text: `ApexFetch • ${mode === 'manual' ? 'Manual Dispatch' : 'Auto Dispatch'}` },
        timestamp: new Date().toISOString(),
      }],
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordPayload),
    });

    if (!res.ok) throw new Error(`Discord returned ${res.status}`);
    console.log(`[Discord] Alert sent for: ${job.title}`);
    return true;
  } catch (err) {
    console.error('[Discord] Failed to send:', err);
    return false;
  }
}

export async function sendLocalLeadDiscordAlert(
  lead: { id?: string; businessName: string; niche: string; city: string; address: string; phoneNumber: string; rating: number; reviewCount: number; googleMapsUrl: string; opportunityScore: number; aiAnalysis: string; coldCallScript: string; emailPitch: string; status: string; createdAt: string | Date },
  userId?: string,
): Promise<boolean> {
  const webhookUrl = userId ? await (async () => { try { const u = await prisma.user.findUnique({ where: { clerkId: userId } }); return u?.discordWebhookUrl || null; } catch { return null; } })() : null;
  if (!webhookUrl) return false;
  if (lead.opportunityScore < 8) return false;

  const embed = {
    title: `🎯 High-Opportunity Local Lead: ${lead.businessName}`,
    url: lead.googleMapsUrl,
    color: lead.opportunityScore >= 9 ? 0x00ff00 : 0xffaa00,
    fields: [
      { name: 'Location', value: `${lead.city}, ${lead.address}`, inline: false },
      { name: 'Industry', value: lead.niche, inline: true },
      { name: 'Rating', value: `${lead.rating}/5 (${lead.reviewCount} reviews)`, inline: true },
      { name: 'Opportunity Score', value: `**${lead.opportunityScore}/10**`, inline: true },
      { name: 'Phone', value: `\`${lead.phoneNumber}\``, inline: true },
      { name: 'Analysis', value: (lead.aiAnalysis || '').substring(0, 300), inline: false },
      { name: 'Cold Call Script', value: `\`\`\`\n${(lead.coldCallScript || '').substring(0, 400)}\n\`\`\``, inline: false },
      { name: 'Email Pitch', value: `\`\`\`\n${(lead.emailPitch || '').substring(0, 300)}\n\`\`\``, inline: false },
    ],
    footer: { text: `Status: ${lead.status} | Created: ${new Date(lead.createdAt).toLocaleDateString()}` },
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Local Lead Generator', avatar_url: 'https://cdn-icons-png.flaticon.com/512/1995/1995467.png', embeds: [embed] }),
    });
    if (!res.ok) throw new Error(`Discord API error: ${res.status}`);
    return true;
  } catch (err) {
    console.error('Failed to send Discord notification:', err);
    return false;
  }
}

export async function sendJobToUserDiscord(
  userId: string,
  job: { title: string; url: string; description: string; source: string; budget: string; aiScore: number },
  mode: 'manual' | 'auto' = 'auto',
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.discordWebhookUrl) return false;
    return sendJobDiscordAlert(user.discordWebhookUrl, job, mode);
  } catch {
    return false;
  }
}
