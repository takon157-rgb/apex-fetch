import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { readScraperStatus } from '../../../lib/db';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const status = readScraperStatus();
    return NextResponse.json(status, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Unable to read scraper status.' }, { status: 500 });
  }
}
