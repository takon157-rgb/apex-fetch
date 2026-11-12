import type { MetadataRoute } from 'next';
import { BRAND } from '@/lib/brand';

/**
 * robots.txt
 *
 * Without this file every crawler request for /robots.txt was answered by the
 * auth middleware, which redirected to the sign-in page. Google was served an
 * HTML page where it expected plain text and gave up on the whole domain.
 *
 * Everything a crawler needs to reach is allowed. Only the private, per-user
 * routes are disallowed, and those redirect to sign-in anyway.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/approval-queue',
          '/dashboard/',
          '/local-leads',
          '/onboarding',
          '/profile',
          '/stored-leads',
          '/tracker',
        ],
      },
    ],
    sitemap: `${BRAND.siteUrl}/sitemap.xml`,
    host: BRAND.siteUrl,
  };
}
