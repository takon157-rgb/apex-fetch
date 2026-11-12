// Clears scrape sessions left in "running" state by an interrupted run and
// removes leftover verification accounts.
//
// Run: node scripts/cleanup-stuck-sessions.mjs
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

register('./ts-resolve-hook.mjs', import.meta.url);

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

try {
  // Verification accounts are throwaway - remove them and their rows.
  const testUsers = await prisma.user.findMany({
    where: { OR: [{ clerkId: { startsWith: 'cron-verify-' } }, { email: { endsWith: '@local.test' } }] },
    select: { id: true, email: true },
  });
  for (const u of testUsers) {
    await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    console.log(`removed verification account: ${u.email}`);
  }

  // A session still marked "running" belongs to an invocation that was killed.
  const stuck = await prisma.scrapeSession.findMany({
    where: { status: 'running' },
    select: { id: true, userId: true, completedSources: true },
  });
  for (const s of stuck) {
    await prisma.scrapeSession.update({
      where: { id: s.id },
      data: {
        status: 'error',
        error: 'Interrupted - the invocation was killed before it finished',
        completedAt: new Date(),
      },
    });
    console.log(`closed stuck session ${s.id} (was at ${s.completedSources}/35)`);
  }

  console.log(`\nverification accounts removed: ${testUsers.length}`);
  console.log(`stuck sessions closed:          ${stuck.length}`);
} finally {
  await prisma.$disconnect();
}

process.exit(0);
