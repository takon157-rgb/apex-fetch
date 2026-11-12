// Reports credit balances and recent scrape sessions, so a failed "Pull" can
// be traced to credits, the session lifecycle, or the pipeline itself.
import { readFileSync } from 'node:fs';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const users = await prisma.user.findMany({
  orderBy: { createdAt: 'asc' },
  select: {
    email: true,
    isSubscribed: true,
    creditsRemaining: true,
    _count: { select: { leads: true } },
  },
});

console.log('=== USER CREDITS ===');
for (const u of users) {
  console.log(
    `  ${u.email.padEnd(28)} subscribed=${String(u.isSubscribed).padEnd(5)} credits=${String(u.creditsRemaining).padStart(4)} leads=${String(u._count.leads).padStart(5)}`,
  );
}

const sessions = await prisma.scrapeSession.findMany({
  orderBy: { startedAt: 'desc' },
  take: 10,
});

console.log('\n=== RECENT SCRAPE SESSIONS ===');
for (const s of sessions) {
  console.log(
    `  ${s.startedAt.toISOString()}  ${s.status.padEnd(9)} ${String(s.completedSources).padStart(3)}/${s.totalSources}  found=${String(s.leadsFound).padStart(4)}  current="${s.currentSource}"${s.error ? `  ERROR: ${s.error.slice(0, 120)}` : ''}`,
  );
}

await prisma.$disconnect();
