// Exercises the resumable scrape pipeline the same way the live API does:
// a bounded slice of sources per "invocation", resuming from where the last
// one stopped. This is the harness that proves the serverless fix works -
// previously the whole pipeline ran as an unawaited background promise and
// every live run died at "running, 0 sources".
//
// Run: node scripts/verify-scrape-batches.mjs
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

// The app's relative imports are extensionless (Next.js resolves them); the
// hook lets Node do the same so this harness can import lib/scraper.ts.
register('./ts-resolve-hook.mjs', import.meta.url);

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const { PrismaClient } = await import('@prisma/client');
const { runScrapePipeline, SOURCES, configureSourceRequests } = await import('../lib/scraper.ts');

const prisma = new PrismaClient();

// Same knobs the API route uses.
const SOURCES_PER_BATCH = Number(process.env.SCRAPE_BATCH_SIZE || 4);
const SOURCE_TIMEOUT_MS = Number(process.env.SCRAPE_SOURCE_TIMEOUT_MS || 6000);
const SOURCE_RETRIES = Number(process.env.SCRAPE_SOURCE_RETRIES || 1);
const BATCH_TIME_BUDGET_MS = Number(process.env.SCRAPE_BATCH_BUDGET_MS || 35000);

configureSourceRequests({ timeoutMs: SOURCE_TIMEOUT_MS, retries: SOURCE_RETRIES });

// A throwaway account so the verification does not pollute a real feed.
const clerkId = `batch-verify-${Date.now()}`;
const user = await prisma.user.create({
  data: { clerkId, email: 'batch-verify@local.test' },
});

console.log(`sources registered: ${SOURCES.length}`);
console.log(`batch size: ${SOURCES_PER_BATCH}   per-source timeout: ${SOURCE_TIMEOUT_MS}ms   retries: ${SOURCE_RETRIES}   batch budget: ${BATCH_TIME_BUDGET_MS}ms\n`);

let offset = 0;
let batch = 0;
let totalCreated = 0;
let totalHealed = 0;
let processed = 0;
const failedSources = [];
const startedAt = Date.now();

try {
  // Phase 1 - the registered boards, sliced.
  while (offset < SOURCES.length) {
    batch++;
    const t0 = Date.now();
    const result = await runScrapePipeline(
      user.id,
      null,
      [],
      'All',
      '',
      async () => {},
      {
        sourceOffset: offset,
        sourceLimit: SOURCES_PER_BATCH,
        timeBudgetMs: BATCH_TIME_BUDGET_MS,
      },
    );
    const elapsed = Date.now() - t0;
    totalCreated += result.leadsCreated;
    totalHealed += result.leadsHealed;
    processed += result.sourceResults.length;
    for (const sr of result.sourceResults) {
      if (!sr.success) failedSources.push(`${sr.source}: ${sr.error}`);
    }
    offset = result.nextOffset;
    console.log(
      `  batch ${String(batch).padStart(2)}  sources ${String(offset).padStart(2)}/${SOURCES.length}  ` +
      `took ${String(elapsed).padStart(5)}ms  created=${String(result.leadsCreated).padStart(3)}  healed=${String(result.leadsHealed).padStart(3)}`,
    );
    if (result.timedOut) console.log('     (stopped early on the time budget - resumed on the next batch)');
    if (elapsed > 55000) {
      console.error(`\nFAIL: batch ${batch} took ${elapsed}ms - that would exceed a 60s serverless limit.`);
      process.exitCode = 1;
      break;
    }
  }

  // Phase 2 - company career-page discovery.
  if (offset >= SOURCES.length) {
    batch++;
    const t0 = Date.now();
    const result = await runScrapePipeline(
      user.id, null, [], 'All', '', async () => {},
      { sourceOffset: SOURCES.length, discovery: true },
    );
    totalCreated += result.leadsCreated;
    processed += result.sourceResults.length;
    console.log(
      `  discovery  took ${String(Date.now() - t0).padStart(5)}ms  created=${result.leadsCreated}`,
    );
  }

  const dbCount = await prisma.lead.count({ where: { userId: user.id } });
  const totalMs = Date.now() - startedAt;

  console.log('\n=== RESULT ===');
  console.log(`  batches:        ${batch}`);
  console.log(`  sources done:   ${processed}/${SOURCES.length + 1}`);
  console.log(`  leads created:  ${totalCreated} (db rows: ${dbCount})`);
  console.log(`  leads healed:   ${totalHealed}`);
  console.log(`  total wall time: ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`  failed sources: ${failedSources.length}`);
  for (const f of failedSources) console.log(`     - ${f}`);

  const ok = processed >= SOURCES.length && dbCount > 0;
  console.log(`\n  ${ok ? 'PASS' : 'FAIL'}: ${processed}/${SOURCES.length + 1} units processed, ${dbCount} leads persisted`);
  if (!ok) process.exitCode = 1;
} finally {
  // Clean up: deleting the user cascades to its leads and session rows.
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  await prisma.$disconnect();
}
