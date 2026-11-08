/**
 * In-memory rate limiting.
 *
 * NOTE: on Vercel each serverless instance keeps its own store, so these
 * limits are per-instance rather than global. They still blunt casual abuse
 * and accidental bursts; a distributed store would be needed for a hard
 * global cap.
 */

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

// Evict expired entries so a long-running server can't grow the map forever.
const MAX_ENTRIES = 10_000;
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < 60_000 && store.size < MAX_ENTRIES) return;
  lastSweep = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
  // Hard cap: if we're still over after sweeping, drop the oldest entries.
  if (store.size > MAX_ENTRIES) {
    const excess = store.size - MAX_ENTRIES;
    let removed = 0;
    for (const key of store.keys()) {
      if (removed >= excess) break;
      store.delete(key);
      removed++;
    }
  }
}

export function rateLimit(key: string, maxRequests: number = 30, windowMs: number = 60000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  sweep(now);

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count };
}

export function rateLimitByIp(req: Request, maxRequests = 30, windowMs = 60000) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  return rateLimit(`ip:${ip}`, maxRequests, windowMs);
}

export function rateLimitByUser(userId: string, maxRequests = 20, windowMs = 60000) {
  return rateLimit(`user:${userId}`, maxRequests, windowMs);
}

/** Test helper: clear all rate-limit state. */
export function resetRateLimits(): void {
  store.clear();
  lastSweep = 0;
}
