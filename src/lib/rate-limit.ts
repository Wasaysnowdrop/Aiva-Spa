type Bucket = {
  count: number
  windowStart: number
  expiresAt: number
}

const buckets = new Map<string, Bucket>()

export type RateLimitOptions = {
  maxRequests: number
  windowMs: number
}

export function getRateLimit(
  key: string,
  options: RateLimitOptions,
  now: number = Date.now(),
): { limited: boolean; remaining: number; retryAfterMs: number } {
  const bucket = buckets.get(key)
  if (!bucket) {
    return { limited: false, remaining: options.maxRequests, retryAfterMs: 0 }
  }
  if (bucket.expiresAt <= now) {
    buckets.delete(key)
    return { limited: false, remaining: options.maxRequests, retryAfterMs: 0 }
  }
  if (bucket.count >= options.maxRequests) {
    return { limited: true, remaining: 0, retryAfterMs: bucket.expiresAt - now }
  }
  return {
    limited: false,
    remaining: options.maxRequests - bucket.count,
    retryAfterMs: 0,
  }
}

export function recordRateLimitHit(
  key: string,
  options: RateLimitOptions,
  now: number = Date.now(),
): void {
  const existing = buckets.get(key)
  if (!existing || existing.expiresAt <= now) {
    buckets.set(key, {
      count: 1,
      windowStart: now,
      expiresAt: now + options.windowMs,
    })
    return
  }
  existing.count += 1
}

export function clearRateLimit(key: string): void {
  buckets.delete(key)
}

export function isRateLimited(
  key: string,
  cooldownMs: number,
  now: number = Date.now(),
): { limited: boolean; retryAfterMs: number } {
  const bucket = buckets.get(key)
  if (!bucket) {
    return { limited: false, retryAfterMs: 0 }
  }
  if (bucket.expiresAt <= now) {
    buckets.delete(key)
    return { limited: false, retryAfterMs: 0 }
  }
  return { limited: true, retryAfterMs: bucket.expiresAt - now }
}

export function recordRequest(
  key: string,
  cooldownMs: number,
  now: number = Date.now(),
): void {
  buckets.set(key, { count: 1, windowStart: now, expiresAt: now + cooldownMs })
}
