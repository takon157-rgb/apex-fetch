import { NextRequest, NextResponse } from 'next/server';
import { getJobs, updateJobStatus } from '../../../lib/db';

export async function GET() {
  try {
    const data = await getJobs();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Failed fetching database items.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body;
    if (!id || !status) {
      return NextResponse.json({ error: 'Missing parameters payload.' }, { status: 400 });
    }
    const updated = await updateJobStatus(id, status);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: 'Failed modification pipeline execution.' }, { status: 500 });
  }
}