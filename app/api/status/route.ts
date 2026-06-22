import { NextResponse } from 'next/server';
import { readScraperStatus } from '../../../lib/db';

export async function GET() {
  try {
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
