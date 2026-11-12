// Probe: how many distinct jobs are in the Lead table vs total rows, and how
// many rows per distinct URL. This tells us whether per-job detail pages would
// create duplicate content.
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
try {
  const total = await p.lead.count({ where: { deleted: false } });
  const distinct = await p.$queryRawUnsafe(
    'SELECT COUNT(DISTINCT "url")::bigint AS n FROM "Lead" WHERE "deleted" = false',
  );
  const perUser = await p.lead.groupBy({
    by: ['userId'],
    where: { deleted: false },
    _count: { _all: true },
  });
  const top = await p.$queryRawUnsafe(
    'SELECT "url", COUNT(*)::bigint AS n FROM "Lead" WHERE "deleted" = false GROUP BY "url" ORDER BY n DESC LIMIT 3',
  );
  console.log('total rows   :', total);
  console.log('distinct urls:', Number(distinct[0].n));
  console.log('rows per user:', perUser.map((r) => `${r.userId.slice(0, 8)}=${r._count._all}`).join(' '));
  console.log('top dupes    :', top.map((t) => `${t.n}x ${t.url.slice(0, 70)}`).join('\n                '));
} catch (e) {
  console.log('ERR', e.message);
} finally {
  await p.$disconnect();
}
