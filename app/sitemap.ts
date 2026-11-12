import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/brand';

/**
 * sitemap.xml
 *
 * Like robots.txt, this route was previously swallowed by the auth middleware
 * and served as the sign-in page. Only routes that are publicly reachable are
 * listed; the rest redirect to sign-in and would only waste crawl budget.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

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
  ];

  return routes;
}
