import { NextRequest, NextResponse } from 'next/server';
import { addReviewedJob, getReviewedJobs } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, description } = body;
    if (!id || !title) return NextResponse.json({ success: false, error: 'Missing id or title' }, { status: 400 });

    const jobs = addReviewedJob({
      id,
      title,
      description: description || '',
      reviewedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, jobs });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const jobs = getReviewedJobs();
    return NextResponse.json({ success: true, jobs });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
