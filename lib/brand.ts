/**
 * Single source of truth for the product's identity.
 *
 * The header, sign-in wall, sign-up wall and welcome modal all used to carry
 * their own copy, which had drifted apart (the app was still called
 * "ApexFetch" in the auth screens while the dashboard said JobPilot). Keeping
 * the strings here means a rename is a one-line change.
 */

export const BRAND = {
  /** Full product name. */
  name: 'JobPilot',
  /** Two-letter mark used in the logo tile. */
  mark: 'JP',
  /** Short promise used under the logo. */
  tagline: 'Job search on autopilot',
  /** One sentence describing what the product does. */
  pitch:
    'Finds real openings across company career boards and remote job boards, ranks them against your resume, and drafts an application for every good match.',
  /** Used in page metadata and the sign-up wall. */
  seo:
    'JobPilot finds real jobs across 30+ job boards, ranks them by resume fit, tailors applications, and sends nothing without your approval.',
} as const;

/**
 * Where a referral code is parked between the sign-up wall and the onboarding
 * flow. It has to be the same key in both places or referrals are silently
 * dropped.
 */
export const REFERRAL_STORAGE_KEY = 'jobpilot_ref';

/**
 * Fired on `window` to reopen the welcome modal after it has been dismissed.
 * The header's help button uses this.
 */
export const OPEN_WELCOME_EVENT = 'jobpilot:open-welcome';

export function openWelcome(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(OPEN_WELCOME_EVENT));
}
