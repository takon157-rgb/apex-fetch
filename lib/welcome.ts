/**
 * Shared state for the first-run welcome experience.
 *
 * The welcome modal and the dashboard both need to know whether the user has
 * already seen (and dismissed) it, so the decision lives in one place instead
 * of being duplicated across components.
 */

export const WELCOME_DISMISSED_KEY = 'jobpilot_welcome_dismissed_v1';

export function welcomeDismissed(): boolean {
  // localStorage is unavailable during SSR and throws in some privacy modes.
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(WELCOME_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissWelcome(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WELCOME_DISMISSED_KEY, '1');
  } catch {
    // Storage denied — the modal will show again next visit, which is
    // acceptable and better than crashing.
  }
}
