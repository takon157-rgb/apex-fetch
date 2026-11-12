// Shows exactly who is holding the database's pooled connections.
//
// The Supabase free tier pooler allows 15. Local dev, the verification
// scripts and the Vercel deployment all point at the same database, so this
// is how you find out what is eating the pool.
//
// Run: node scripts/db-connections.mjs
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
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      pid,
      state,
      application_name,
      client_addr::text AS client_addr,
      backend_start,
      state_change,
      left(coalesce(query, ''), 70) AS query
    FROM pg_stat_activity
    WHERE datname = current_database()
    ORDER BY state_change DESC NULLS LAST
  `);

  console.log(`=== CONNECTIONS TO "${rows.length ? 'postgres' : 'db'}" (pooler limit 15) ===`);
  console.log('');
  for (const r of rows) {
    const age = r.backend_start ? Math.round((Date.now() - new Date(r.backend_start).getTime()) / 1000) : '?';
    const idleFor = r.state_change ? Math.round((Date.now() - new Date(r.state_change).getTime()) / 1000) : '?';
    const app = r.application_name || '(empty)';
    const from = r.client_addr || 'local';
    console.log(`  pid=${String(r.pid).padEnd(7)} ${String(r.state).padEnd(9)} age=${String(age + 's').padEnd(8)} idle=${String(idleFor + 's').padEnd(8)} app=${app.padEnd(22)} from=${from}`);
    if (r.query) console.log(`         query: ${r.query.replace(/\s+/g, ' ')}`);
  }

  const byApp = {};
  for (const r of rows) {
    const key = r.application_name || '(empty)';
    byApp[key] = (byApp[key] || 0) + 1;
  }
  console.log('\n=== BY CLIENT ===');
  for (const [app, n] of Object.entries(byApp).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(app).padEnd(24)} ${n}`);
  }
  console.log(`\n  TOTAL: ${rows.length} / 15`);
  if (rows.length >= 13) {
    console.log('  WARNING: the pooler is nearly exhausted. The live site will fail to');
    console.log('           connect when this happens.');
  }
} catch (err) {
  console.error('connection diagnostic failed:', err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

process.exit(process.exitCode ?? 0);
