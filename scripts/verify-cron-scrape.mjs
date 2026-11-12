// Drives the daily cron endpoint the same way the GitHub Actions workflow
// does: one bounded slice per call, repeating until the endpoint reports
// "done". This is the harness that proves the cron route is resumable -
// previously it ran every source for every subscribed account in a single
// invocation, which the platform killed partway through, so the daily job
// quietly did nothing.
//
// Run: node scripts/verify-cron-scrape.mjs
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

register('./ts-resolve-hook.mjs', import.meta.url);

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

process.env.CRON_SECRET = process.env.CRON_SECRET || 'cron-verify-secret';
// Only the throwaway account below should be picked up. Without this the cron
// would also refresh every real account in the database, which this harness
// has no business doing.
process.env.CRON_INCLUDE_FREE_USERS = 'false';

const { PrismaClient } = await import('@prisma/client');
const { NextRequest } = await import('next/server');
const { GET } = await import('../app/api/cron/scrape/route.ts');
const { SOURCES } = await import('../lib/scraper.ts');

const prisma = new PrismaClient();

// A throwaway subscribed account so the cron has work to do.
const clerkId = `cron-verify-${Date.now()}`;
const user = await prisma.user.create({
  data: { clerkId, email: 'cron-verify@local.test', isSubscribed: true },
});

console.log(`sources registered: ${SOURCES.length}`);
console.log('driving /api/cron/scrape until it reports done...\n');

let calls = 0;
let phase = '';
let sawRunningSession = false;
let sessionCompleted = false;
let lastBody = null;
const startedAt = Date.now();

try {
  while (calls < 120) {
    calls++;
    const t0 = Date.now();
    const res = await GET(
      new NextRequest('http://localhost/api/cron/scrape', {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    );
    const body = await res.json();
    lastBody = body;
    const elapsed = Date.now() - t0;

    if (res.status !== 200) {
      console.error(`FAIL: call ${calls} returned HTTP ${res.status}:`, body);
      process.exitCode = 1;
      break;
    }

    if (body.phase && body.phase !== phase) {
      phase = body.phase;
      console.log(`  -- phase: ${phase}`);
    }

    const session = await prisma.scrapeSession.findFirst({
      where: { userId: user.id },
      orderBy: { startedAt: 'desc' },
    });
    if (session?.status === 'running') sawRunningSession = true;
    if (session?.status === 'completed') sessionCompleted = true;

    console.log(
      `  call ${String(calls).padStart(2)}  took ${String(elapsed).padStart(5)}ms  ` +
      `done=${String(body.done).padEnd(5)}  phase=${String(body.phase ?? '-').padEnd(10)}  ` +
      `completed=${body.completedSources ?? '-'}/${body.totalSources ?? '-'}  ` +
      `leads=${body.leadsCreated ?? 0}`,
    );

    if (elapsed > 55000) {
      console.error(`FAIL: call ${calls} took ${elapsed}ms - that would exceed a 60s serverless limit.`);
      process.exitCode = 1;
      break;
    }

    if (body.done === true) break;
    // The endpoint asks for one more call to move on to the next account.
    if (body.phase === 'complete') continue;
  }

  const dbCount = await prisma.lead.count({ where: { userId: user.id } });
  const sessions = await prisma.scrapeSession.findMany({ where: { userId: user.id } });
  const stuck = sessions.filter((s) => s.status === 'running');

  console.log('\n=== RESULT ===');
  console.log(`  calls:              ${calls}`);
  console.log(`  wall time:          ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  console.log(`  sessions created:   ${sessions.length}`);
  console.log(`  sessions completed: ${sessions.filter((s) => s.status === 'completed').length}`);
  console.log(`  sessions stuck:     ${stuck.length}`);
  console.log(`  leads persisted:    ${dbCount}`);
  console.log(`  last response:      ${JSON.stringify(lastBody)}`);

  const ok =
    calls > 1 &&
    dbCount > 0 &&
    sessionCompleted &&
    stuck.length === 0 &&
    process.exitCode !== 1;

  console.log(`\n  ${ok ? 'PASS' : 'FAIL'}: cron resumed across ${calls} calls, ${dbCount} leads persisted, ${stuck.length} sessions left running`);
  if (!ok) process.exitCode = 1;
} finally {
  // Deleting the user cascades to its leads and session rows.
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  await prisma.$disconnect();
}

// Leave explicitly: the Prisma engine and Next's request stack can keep
// handles open, which makes Node's implicit exit code unreliable.
process.exit(process.exitCode ?? 0);
