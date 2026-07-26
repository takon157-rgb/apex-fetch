const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, maxRequests: number = 30, windowMs: number = 60000): { allowed: boolean; remaining: number } {
  const now = Date.now();
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
