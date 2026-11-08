// Auto-send safety rails.
// Two independent gates must pass before an application email leaves the system:
//   1. A human approved the draft (approvedAt is set).
//   2. The user is under their daily send cap.

export const DAILY_SEND_LIMIT = 3;

export function startOfToday(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function canSendApplication(opts: {
  approved: boolean;
  sentToday: number;
  dailyLimit?: number;
}): { allowed: boolean; reason?: string } {
  const limit = opts.dailyLimit ?? DAILY_SEND_LIMIT;
  if (!opts.approved) {
    return { allowed: false, reason: 'Application must be approved before sending.' };
  }
  if (opts.sentToday >= limit) {
    return {
      allowed: false,
      reason: `Daily limit reached — ${opts.sentToday}/${limit} applications sent today. Try again tomorrow.`,
    };
  }
  return { allowed: true };
}
