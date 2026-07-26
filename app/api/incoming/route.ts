import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { writeStoredJobs, readStoredJobs } from '../../../lib/db';
import { rateLimitByIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, 20, 60000);
    if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

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
    const rawJobs = Array.isArray(body.jobs) ? body.jobs.slice(0, 50) : [];
    const clerkId = typeof body.userId === 'string' && body.userId.length < 100 ? body.userId : '';

    if (rawJobs.length > 0) {
      const jobs = rawJobs.map((j: any) => ({
        title: typeof j.title === 'string' ? j.title.substring(0, 300) : 'Unknown Position',
        description: typeof j.description === 'string' ? j.description.substring(0, 2000) : '',
        budget: typeof j.budget === 'string' ? j.budget.substring(0, 100) : 'Open Terms',
        source: typeof j.source === 'string' ? j.source.substring(0, 100) : 'External',
        url: typeof j.url === 'string' ? j.url.substring(0, 1000) : '',
        score: typeof j.score === 'number' ? Math.min(10, Math.max(0, j.score)) : 5,
        proposal: typeof j.proposal === 'string' ? j.proposal.substring(0, 2000) : '',
      }));

      writeStoredJobs([...jobs, ...readStoredJobs()].slice(0, 500));

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
