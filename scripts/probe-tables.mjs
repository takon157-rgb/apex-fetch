// Probe: list the public tables so the landing page's stats query uses the
// real name. Run from the project root so @prisma/client resolves.
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
try {
  const r = await p.$queryRawUnsafe(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
  );
  console.log('tables:', r.map((x) => x.table_name).join(', '));
} catch (e) {
  console.log('ERR', e.message);
} finally {
  await p.$disconnect();
}
