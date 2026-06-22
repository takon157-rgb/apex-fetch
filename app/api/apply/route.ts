import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

declare global {
  var globalStorage: any;
  var globalProfile: any;
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({}));
    if (!payload || !payload.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const job = globalThis.globalStorage?.jobs?.find((j: any) => j.id === payload.id);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    // Attach application info
    job.applied = true;
    job.application = {
      appliedAt: new Date().toISOString(),
      profile: globalThis.globalProfile || null,
      note: payload.note || 'Auto-applied via dashboard'
    };

    return NextResponse.json({ success: true, job });
  } catch (err) {
    return NextResponse.json({ error: true, message: (err as Error).message }, { status: 500 });
  }
}
