/**
 * Simple in-memory rate limiter.
 * Production: replace with Redis or external store.
 */
interface LimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, LimitEntry>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

export function rateLimitResponse(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; headers: Record<string, string> } {
  const result = checkRateLimit(key, maxRequests, windowMs);
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(maxRequests),
    "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };

  if (!result.allowed) {
    headers["Retry-After"] = String(Math.ceil((result.resetAt - Date.now()) / 1000));
  }

  return { allowed: result.allowed, headers };
}
