// Reports the live database's health: schema sync, row counts, and how many
// pooled connections are currently open.
//
// Run: node scripts/db-health.mjs
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
  console.log('=== SCHEMA SYNC ===');
  // The column added for per-account scrape targets. If this query fails,
  // the database is behind the code.
  const prefs = await prisma.userPreference.findMany({ select: { targetUrls: true }, take: 1 });
  console.log(`  UserPreference.targetUrls: present (sample: ${JSON.stringify(prefs[0]?.targetUrls ?? [])})`);

  const columns = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'UserPreference'
    ORDER BY column_name
  `);
  console.log('  UserPreference columns:');
  for (const c of columns) {
    console.log(`    ${String(c.column_name).padEnd(22)} ${String(c.data_type).padEnd(12)} nullable=${c.is_nullable}`);
  }

  console.log('\n=== ROW COUNTS ===');
  const [users, leads, localLeads, sessions, prefs2, blacklists, health] = await Promise.all([
    prisma.user.count(),
    prisma.lead.count(),
    prisma.localLead.count(),
    prisma.scrapeSession.count(),
    prisma.userPreference.count(),
    prisma.blacklistedKeyword.count(),
    prisma.sourceHealth.count(),
  ]);
  console.log(`  users:            ${users}`);
  console.log(`  leads:            ${leads}`);
  console.log(`  local leads:      ${localLeads}`);
  console.log(`  scrape sessions:  ${sessions}`);
  console.log(`  preferences:      ${prefs2}`);
  console.log(`  blacklists:       ${blacklists}`);
  console.log(`  source health:    ${health}`);

  const stuck = await prisma.scrapeSession.count({ where: { status: 'running' } });
  const runningRecently = await prisma.scrapeSession.count({
    where: { status: 'running', startedAt: { gte: new Date(Date.now() - 3600000) } },
  });
  console.log(`  sessions stuck:   ${stuck} (started in the last hour: ${runningRecently})`);

  console.log('\n=== CONNECTIONS ===');
  // Supabase's pooler sits in front of Postgres; these are the client
  // sessions it is currently holding.
  const conns = await prisma.$queryRawUnsafe(`
    SELECT state, count(*)::int AS n
    FROM pg_stat_activity
    WHERE datname = current_database()
    GROUP BY state
    ORDER BY n DESC
  `);
  let total = 0;
  for (const c of conns) {
    console.log(`  ${String(c.state).padEnd(14)} ${c.n}`);
    total += Number(c.n);
  }
  console.log(`  total sessions:   ${total}`);
  console.log('  (Supabase pooler allows 15 for the free tier)');

  const dbSize = await prisma.$queryRawUnsafe(`
    SELECT pg_size_pretty(pg_database_size(current_database())) AS size
  `);
  console.log(`\n  database size:    ${dbSize[0]?.size}`);
} catch (err) {
  console.error('DB health check failed:', err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

process.exit(process.exitCode ?? 0);
