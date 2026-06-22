import { NextRequest, NextResponse } from 'next/server';
import { getCareerProfile, saveCareerProfile } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({}));
    if (!payload) return NextResponse.json({ error: 'No payload' }, { status: 400 });

    const profile = await saveCareerProfile({
      name: payload.name || payload.fullName || 'Unnamed',
      email: payload.email || '',
      resumeFileName: payload.resumeFileName || '',
      resumeBase64: payload.resumeBase64 || '',
      resumeText: payload.resumeText || '',
    });

    return NextResponse.json({ success: true, profile });
  } catch (err) {
    console.error('[Profile API] Error saving profile:', err);
    return NextResponse.json({ error: true, message: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const profile = await getCareerProfile();
    return NextResponse.json({ profile });
  } catch (err) {
    console.error('[Profile API] Error fetching profile:', err);
    return NextResponse.json({ error: true, message: (err as Error).message }, { status: 500 });
  }
}
