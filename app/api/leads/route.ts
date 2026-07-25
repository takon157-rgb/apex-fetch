import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function computeRelevance(text: string, targetRoles: string[], coreSkills: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  const checkTerms = [...targetRoles, ...coreSkills].filter(Boolean);
  if (checkTerms.length === 0) return 1;
  for (const term of checkTerms) {
    const words = term.toLowerCase().split(/\s+/);
    const matchedWords = words.filter(w => lower.includes(w));
    if (matchedWords.length > 0) score += matchedWords.length / words.length;
  }
  return score / checkTerms.length;
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ leads: [] });

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
  const skip = (page - 1) * limit;

  const preferences = await prisma.userPreference.findUnique({ where: { userId: user.id } });
  const targetRoles = preferences?.targetRoles ?? [];
  const coreSkills = preferences?.coreSkills ?? [];
  const hasPreferences = targetRoles.length > 0 || coreSkills.length > 0;

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.lead.count({ where: { userId: user.id } }),
  ]);

  let filteredLeads = leads;

  if (hasPreferences) {
    const scored = leads.map(lead => {
      const searchText = `${lead.title} ${lead.description}`;
      const relevance = computeRelevance(searchText, targetRoles, coreSkills);
      return { ...lead, relevanceScore: relevance };
    });
    filteredLeads = scored
      .filter(l => l.relevanceScore >= 0.02)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  return NextResponse.json({
    leads: filteredLeads,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
