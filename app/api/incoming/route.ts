import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { writeStoredJobs, readStoredJobs } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    const isCronAuthed = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCronAuthed) {
      const session = await auth();
      if (!session.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const { jobs, userId: clerkId } = body;

    if (jobs && Array.isArray(jobs)) {
      writeStoredJobs([...jobs, ...readStoredJobs()]);

      if (clerkId) {
        try {
          const user = await prisma.user.findUnique({ where: { clerkId } });
          if (user) {
            const leadData = jobs.map((job: any) => ({
              userId: user.id,
              title: job.title || 'Unknown Position',
              description: job.description || '',
              budget: job.budget || 'Open Terms',
              source: job.source || 'External Script',
              url: job.url || '',
              aiScore: job.score || 5,
              proposalDraft: job.proposal || '',
              status: 'active',
            }));
            await prisma.lead.createMany({ data: leadData, skipDuplicates: true });
          }
        } catch (err) {
          console.error('[Incoming] Failed to save to Prisma:', err);
        }
      }

      console.log(`[Incoming] Synced ${jobs.length} external elements.`);
      return NextResponse.json({ success: true, received: jobs.length });
    }

    return NextResponse.json({ error: 'Malformed payload' }, { status: 400 });
  } catch (err: any) {
    console.error('[Incoming] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
