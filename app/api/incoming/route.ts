import { NextRequest, NextResponse } from 'next/server';
import { readStoredJobs, writeStoredJobs } from '../../../lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { jobs } = body;

    if (!globalThis.globalStorage) {
      globalThis.globalStorage = { jobs: readStoredJobs() };
    }

    if (jobs && Array.isArray(jobs)) {
      globalThis.globalStorage.jobs = [...jobs, ...globalThis.globalStorage.jobs];
      writeStoredJobs(globalThis.globalStorage.jobs);
      console.log(`[Playwright Ingestion] Successfully synced ${jobs.length} external elements.`);
      return NextResponse.json({ success: true, received: jobs.length });
    }

    return NextResponse.json({ error: 'Malformed array data payload structure' }, { status: 400 });
  } catch (err: any) {
    console.error('[Incoming Bridge Exception]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}