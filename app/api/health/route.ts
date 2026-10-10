import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Public liveness/readiness check for uptime monitoring.
export async function GET() {
  let db: 'up' | 'down' = 'down';
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = 'up';
  } catch {
    db = 'down';
  }

  return NextResponse.json(
    { status: 'ok', db, time: new Date().toISOString() },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
