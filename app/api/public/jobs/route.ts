import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cleanHtml } from '@/lib/scraper';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20));
    const skip = (page - 1) * limit;
    const source = url.searchParams.get('source');
    const search = url.searchParams.get('q');

    const where: any = { deleted: false };
    if (source) where.source = source;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          budget: true,
          source: true,
          url: true,
          aiScore: true,
          createdAt: true,
        },
      }),
      prisma.lead.count({ where }),
    ]);

    const sanitized = leads.map(l => ({
      ...l,
      description: cleanHtml(l.description).substring(0, 300),
    }));

    return NextResponse.json({
      jobs: sanitized,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[Public Jobs] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}
