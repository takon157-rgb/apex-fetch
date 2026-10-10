import { prisma } from './prisma';

/**
 * Soft-delete leads whose original posting date is older than `days` and that
 * the user has not tracked/applied to. Keeps the feed fresh without silently
 * destroying user data (they remain recoverable from the trash bin).
 */
export async function cleanupStaleLeads(days = 45): Promise<{ removed: number }> {
  const cutoff = new Date(Date.now() - days * 86400000);
  const result = await prisma.lead.updateMany({
    where: {
      deleted: false,
      tracked: false,
      applied: false,
      OR: [
        { postedAt: { lt: cutoff } },
        { postedAt: null, createdAt: { lt: cutoff } },
      ],
    },
    data: { deleted: true },
  });
  return { removed: result.count };
}

/**
 * Aggregate per-source scraper health over the last `days` days for a user:
 * runs, success rate, total leads, and last error message per source.
 */
export async function getSourceHealth(userId: string, days = 7) {
  const since = new Date(Date.now() - days * 86400000);
  const rows = await prisma.sourceHealth.findMany({
    where: { userId, checkedAt: { gte: since } },
    orderBy: { checkedAt: 'desc' },
  });

  const bySource = new Map<string, { runs: number; successes: number; leads: number; lastError: string | null; lastChecked: Date | null }>();
  for (const row of rows) {
    const s = bySource.get(row.source) || { runs: 0, successes: 0, leads: 0, lastError: null, lastChecked: null };
    s.runs += 1;
    if (row.success) s.successes += 1;
    s.leads += row.leadsCount;
    if (row.errorMsg) s.lastError = row.errorMsg;
    if (!s.lastChecked || row.checkedAt > s.lastChecked) s.lastChecked = row.checkedAt;
    bySource.set(row.source, s);
  }

  const totalLeads = await prisma.lead.count({ where: { userId, deleted: false } });

  return {
    totalLeads,
    windowDays: days,
    sources: [...bySource.entries()].map(([source, s]) => ({
      source,
      runs: s.runs,
      successRate: s.runs > 0 ? Math.round((s.successes / s.runs) * 100) : null,
      leads: s.leads,
      lastError: s.lastError,
      lastChecked: s.lastChecked,
    })),
  };
}
