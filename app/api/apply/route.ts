import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { scoreJobFit, ResumeProfile } from '@/lib/fit';
import { tailorApplication } from '@/lib/tailor';
import { sendApplicationEmail, validateEmailDraft } from '@/lib/email';
import { resumeToPdf } from '@/lib/pdf';
import { canSendApplication, startOfToday } from '@/lib/autosend';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const VALID_STATUSES = ['found', 'drafted', 'approved', 'sent', 'replied', 'interview', 'rejected', 'manual_apply'];

async function loadResumeProfile(userId: string): Promise<ResumeProfile> {
  const [prefs, profile] = await Promise.all([
    prisma.userPreference.findUnique({ where: { userId } }),
    prisma.careerProfile.findUnique({ where: { userId } }),
  ]);
  return {
    summary: prefs?.parsedResumeSummary || profile?.resumeText || '',
    skills: prefs?.coreSkills || [],
    roles: prefs?.targetRoles || [],
  };
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action : '';
    const leadId = typeof body.leadId === 'string' ? body.leadId : '';

    if (!leadId) return NextResponse.json({ error: 'Missing leadId' }, { status: 400 });

    const lead = await prisma.lead.findFirst({ where: { id: leadId, userId: user.id } });
    if (!lead) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const resume = await loadResumeProfile(user.id);

    // --- Score fit (LLM 0-100 + matched/missing skills + reason) ---
    if (action === 'score') {
      const fit = await scoreJobFit(resume, { title: lead.title, description: lead.description });
      await prisma.lead.update({
        where: { id: leadId },
        data: { fitScore: fit.score, fitMatched: fit.matched, fitMissing: fit.missing, fitReason: fit.reason },
      });
      return NextResponse.json({ success: true, fit });
    }

    // --- Tailor resume + cover email, then verify no fabrication ---
    if (action === 'tailor') {
      const profile = await prisma.careerProfile.findUnique({ where: { userId: user.id } });
      const result = await tailorApplication(
        { name: profile?.name || user.name || undefined, summary: resume.summary, skills: resume.skills, roles: resume.roles },
        { title: lead.title, company: lead.company || undefined, description: lead.description },
      );
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          tailoredResume: result.tailoredResume,
          coverEmail: result.coverEmail,
          applicationStatus: 'drafted',
        },
      });
      return NextResponse.json({ success: true, ...result });
    }

    // --- Send application email (with PDF resume attached) ---
    if (action === 'send') {
      const to = typeof body.to === 'string' ? body.to.trim() : '';
      if (!to) return NextResponse.json({ error: 'Missing recipient email (to)' }, { status: 400 });

      // Safety rails: must be approved by a human, and under the daily cap.
      const sentToday = await prisma.lead.count({
        where: {
          userId: user.id,
          applicationStatus: 'sent',
          sentAt: { gte: startOfToday() },
        },
      });
      const gate = canSendApplication({ approved: !!lead.approvedAt, sentToday });
      if (!gate.allowed) {
        return NextResponse.json({ error: gate.reason, sentToday }, { status: 429 });
      }

      if (!lead.tailoredResume) {
        return NextResponse.json({ error: 'No tailored resume yet — tailor it before sending.' }, { status: 400 });
      }

      const draftCheck = validateEmailDraft(lead.coverEmail || '', { company: lead.company || undefined, role: lead.title });
      if (!draftCheck.ok) {
        return NextResponse.json({ error: 'Draft failed placeholder check', problems: draftCheck.problems }, { status: 400 });
      }

      const profile = await prisma.careerProfile.findUnique({ where: { userId: user.id } });
      const pdf = await resumeToPdf(lead.tailoredResume || resume.summary, profile?.name || user.name || '');
      const subject = `Application: ${lead.title}${lead.company ? ` at ${lead.company}` : ''}`;

      const result = await sendApplicationEmail({
        to,
        subject,
        text: lead.coverEmail || '',
        attachments: pdf ? [{ filename: 'resume.pdf', content: pdf, contentType: 'application/pdf' }] : [],
      });

      if (result.ok) {
        await prisma.lead.update({
          where: { id: leadId },
          data: { applicationStatus: 'sent', sentAt: new Date(), approvedAt: lead.approvedAt || new Date(), applicationEmail: to },
        });
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ success: false, error: result.error }, { status: 502 });
    }

    // --- Update application status ---
    if (action === 'status') {
      const status = typeof body.status === 'string' ? body.status : '';
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
      }
      await prisma.lead.update({
        where: { id: leadId },
        data: { applicationStatus: status, ...(status === 'approved' ? { approvedAt: new Date() } : {}) },
      });
      return NextResponse.json({ success: true, status });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[Apply] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 });
  }
}
