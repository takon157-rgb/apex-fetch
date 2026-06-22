import { NextRequest, NextResponse } from 'next/server';
import { getStoredLeads, saveStoredLead, removeStoredLead } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const leads = getStoredLeads();
    return NextResponse.json({ success: true, leads });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, businessName, phoneNumber, strategy, niche, city } = body;
    if (!businessName) return NextResponse.json({ success: false, error: 'Missing businessName' }, { status: 400 });

    const lead = {
      id: id || `stored_${Date.now()}`,
      businessName,
      phoneNumber: phoneNumber || '',
      strategy: strategy || '',
      niche: niche || '',
      city: city || '',
      savedAt: new Date().toISOString(),
    };

    const leads = saveStoredLead(lead);
    return NextResponse.json({ success: true, leads });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });

    const leads = removeStoredLead(id);
    return NextResponse.json({ success: true, leads });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
