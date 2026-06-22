import { NextRequest, NextResponse } from 'next/server';
import { readPipelineSettings, writePipelineSettings } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = readPipelineSettings();
    return NextResponse.json(settings, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Unable to read settings.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const careerProfile = typeof payload.careerProfile === 'string' ? payload.careerProfile : undefined;
    const targetUrls = Array.isArray(payload.targetUrls) ? payload.targetUrls.map(String).filter(Boolean) : undefined;

    if (careerProfile === undefined && targetUrls === undefined) {
      return NextResponse.json({ error: 'Missing settings payload.' }, { status: 400 });
    }

    const updated = writePipelineSettings({ careerProfile, targetUrls });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: 'Failed saving settings.' }, { status: 500 });
  }
}
