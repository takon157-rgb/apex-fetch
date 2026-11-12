/**
 * Single source of truth for the product's identity.
 *
 * The header, sign-in wall, sign-up wall, landing page and welcome modal all
 * used to carry their own copy, which had drifted apart. Keeping the strings
 * here means a rename is a one-line change.
 */

export const BRAND = {
  /** Full product name. */
  name: 'ApexFetch',
  /** Two-letter mark used in the logo tile. */
  mark: 'AF',
  /** Short promise used under the logo. */
  tagline: 'Job search on autopilot',
  /** One sentence describing what the product does. */
  pitch:
    'Finds real openings across company career boards and remote job boards, ranks them against your resume, and drafts an application for every good match.',
  /** Used in page metadata and the sign-up wall. */
  seo:
    'ApexFetch finds real jobs across 30+ job boards, ranks them by resume fit, tailors applications, and sends nothing without your approval.',
  /**
   * Canonical origin of the deployed site.
   *
   * Every absolute URL the site emits (canonical tags, Open Graph images,
   * sitemap entries, JSON-LD) is built from this. It must match the domain
   * Google is told to index, otherwise the two split the ranking signals.
   */
  siteUrl: 'https://apexfetch.vercel.app',
} as const;

/**
 * Where a referral code is parked between the sign-up wall and the onboarding
 * flow. It has to be the same key in both places or referrals are silently
 * dropped.
 *
 * The value is left as-is so codes already parked in a browser under the old
 * key are still picked up; only the product name changed.
 */
export const REFERRAL_STORAGE_KEY = 'jobpilot_ref';

/**
 * Fired on `window` to reopen the welcome modal after it has been dismissed.
 * The header's help button uses this.
 */
export const OPEN_WELCOME_EVENT = 'apexfetch:open-welcome';

export function openWelcome(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(OPEN_WELCOME_EVENT));
}
