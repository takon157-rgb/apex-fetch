import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/brand';
import { prisma } from '@/lib/prisma';

/**
 * sitemap.xml
 *
 * Like robots.txt, this route was previously swallowed by the auth middleware
 * and served as the sign-in page. Only routes that are publicly reachable are
 * listed; the rest redirect to sign-in and would only waste crawl budget.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const jobs = await prisma.lead.findMany({
    where: { deleted: false },
    select: { url: true, updatedAt: true, createdAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 500, // Limit to prevent massive sitemap
  });

  const jobUrls = jobs.map((job) => ({
    url: `${BRAND.siteUrl}/jobs/${encodeURIComponent(job.url)}`,
    lastModified: job.updatedAt,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  const routes: MetadataRoute.Sitemap = [
    {
      url: BRAND.siteUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BRAND.siteUrl}/jobs`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${BRAND.siteUrl}/pricing`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BRAND.siteUrl}/sign-up`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${BRAND.siteUrl}/sign-in`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    ...jobUrls,
  ];

  return routes;
}