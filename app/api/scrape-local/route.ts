import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { scrapeLocalBusinesses } from '../../../lib/localScraper';
import { analyzeBusinessWithAI } from '../../../lib/localAi';
import { sendLocalLeadDiscordAlert } from '../../../lib/discord';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

interface ScrapeLocalRequest {
  niche?: string;
  city?: string;
  limit?: number;
}

function isAuthorizedCron(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = req.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  let userId: string | null = null;

  if (isAuthorizedCron(req)) {
    // Background cron — can proceed without a user session
  } else {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    userId = session.userId;
  }

  try {
    let leads;
    if (userId) {
      const user = await prisma.user.findUnique({ where: { clerkId: userId } });
      if (!user) {
        return NextResponse.json({ success: true, leads: [] });
      }
      leads = await prisma.localLead.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Cron context — return all leads (admin use)
      leads = await prisma.localLead.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    }

    return NextResponse.json({ success: true, leads });
  } catch (error) {
    console.error('[Scrape Local] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let userId: string | null = null;

  if (isAuthorizedCron(req)) {
    // Background cron — can proceed without a user session
  } else {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    userId = session.userId;
  }

  try {
    const body: ScrapeLocalRequest = await req.json();
    const { niche = 'Plumbing', city = 'New York', limit = 10 } = body;

    console.log(`[Scrape Local] Starting scrape for "${niche}" in "${city}"...`);

    const scrapedBusinesses = await scrapeLocalBusinesses(niche, city, limit);

    if (scrapedBusinesses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No businesses found matching criteria' },
        { status: 400 }
      );
    }

    console.log(`[Scrape Local] Scraped ${scrapedBusinesses.length} businesses`);

    const newLeads: any[] = [];

    for (const business of scrapedBusinesses) {
      // Check if business already exists for this user
      if (userId) {
        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (user) {
          const existing = await prisma.localLead.findFirst({
            where: {
              userId: user.id,
              businessName: { equals: business.name, mode: 'insensitive' },
              city: { equals: business.city, mode: 'insensitive' },
            },
          });
          if (existing) {
            console.log(`[Scrape Local] Skipping duplicate: ${business.name}`);
            continue;
          }
        }
      }

      console.log(`[Scrape Local] Analyzing ${business.name}...`);
      const aiAnalysis = await analyzeBusinessWithAI(business);

      const leadData: any = {
        businessName: business.name,
        niche: business.niche,
        city: business.city,
        phoneNumber: business.phone,
        rating: business.rating,
        reviewCount: business.reviewCount,
        googleMapsUrl: business.mapsUrl,
        opportunityScore: aiAnalysis.opportunityScore,
        aiAnalysis: aiAnalysis.aiAnalysis,
        coldCallScript: aiAnalysis.coldCallScript,
        emailPitch: aiAnalysis.emailPitch,
        status: 'PENDING',
      };

      if (userId) {
        const user = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (user) {
          leadData.userId = user.id;
        }
      }

      const saved = await prisma.localLead.create({ data: leadData });
      newLeads.push(saved);
      console.log(`[Scrape Local] Saved lead: ${business.name} (Score: ${aiAnalysis.opportunityScore}/10)`);

      if (aiAnalysis.opportunityScore >= 8) {
        await sendLocalLeadDiscordAlert(
          {
            id: saved.id,
            businessName: saved.businessName,
            niche: saved.niche,
            city: saved.city,
            address: business.address,
            phoneNumber: saved.phoneNumber || '',
            rating: saved.rating || 0,
            reviewCount: saved.reviewCount || 0,
            googleMapsUrl: saved.googleMapsUrl || '',
            opportunityScore: saved.opportunityScore,
            aiAnalysis: saved.aiAnalysis || '',
            coldCallScript: saved.coldCallScript || '',
            emailPitch: saved.emailPitch || '',
            status: saved.status,
            createdAt: saved.createdAt.toISOString(),
          },
          userId || undefined
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`[Scrape Local] Complete! Added ${newLeads.length} new leads`);

    return NextResponse.json({
      success: true,
      scrapedCount: scrapedBusinesses.length,
      newLeadsCount: newLeads.length,
      leads: newLeads,
    });
  } catch (error) {
    console.error('[Scrape Local] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to scrape and process leads',
      },
      { status: 500 }
    );
  }
}


