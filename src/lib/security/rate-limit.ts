/**
 * AivaSpa rate limiter.
 *
 * Goals
 * -----
 * 1. Sliding window (more accurate than a fixed window — no burst at the
 *    edge of a window).
 * 2. Memory-bounded. Every bucket has a fixed cap on its history length
 *    and we run LRU eviction when the global store exceeds MAX_BUCKETS.
 * 3. Per-instance. This is intentionally in-process. On Vercel/serverless
 *    each cold instance has its own store, which is the correct trade-off
 *    for a soft security control — the auth/Supabase layer remains the
 *    source of truth for users, and rate limits here stop bursts, not
 *    persistent abuse. Hard abuse is caught by Supabase RLS + audit
 *    logs.
 * 4. Cheap. O(1) hit/expire per request, no background timers, no
 *    external dependencies.
 * 5. Composable. The exported `consume()` returns a `RateLimitDecision`
 *    that callers turn into HTTP 429s, server-action errors, or simply
 *    log warnings.
 *
 * Not a goal
 * ----------
 * Cross-instance coordination. If you need that, swap the backing
 * store for Redis/Upstash; the public API does not change.
 */

import { createHash } from "node:crypto"

const MAX_BUCKETS = 50_000
const MAX_HISTORY_PER_BUCKET = 200

export type RateLimitOptions = {
  /** Max number of requests allowed in the rolling window. */
  maxRequests: number
  /** Window size, in milliseconds. */
  windowMs: number
}

type Bucket = {
  /** Timestamps (ms) of each hit, oldest first. */
  hits: number[]
  /** Last time this bucket was touched — for LRU eviction. */
  lastTouchedAt: number
}

const store = new Map<string, Bucket>()

function pruneExpired(bucket: Bucket, windowMs: number, now: number): void {
  const cutoff = now - windowMs
  // hits are appended in order, so we can drop the prefix in place.
  let i = 0
  while (i < bucket.hits.length && bucket.hits[i]! <= cutoff) i++
  if (i > 0) bucket.hits.splice(0, i)
}

function evictIfNeeded(): void {
  if (store.size <= MAX_BUCKETS) return
  // LRU eviction: drop the 10% least-recently-touched buckets.
  const overflow = store.size - MAX_BUCKETS + Math.floor(MAX_BUCKETS * 0.1)
  const byOldest = [...store.entries()].sort(
    (a, b) => a[1].lastTouchedAt - b[1].lastTouchedAt,
  )
  for (let i = 0; i < overflow && i < byOldest.length; i++) {
    store.delete(byOldest[i]![0])
  }
}

export type RateLimitDecision = {
  /** Did the caller exceed the budget? */
  limited: boolean
  /** How many requests are still allowed in the current window. */
  remaining: number
  /** When the oldest hit will fall out of the window (ms). 0 if not limited. */
  retryAfterMs: number
  /** Total budget — useful for response headers. */
  limit: number
}

/**
 * Inspect the current state of a bucket without recording a hit.
 */
export function peekRateLimit(
  key: string,
  options: RateLimitOptions,
  now: number = Date.now(),
): RateLimitDecision {
  const bucket = store.get(key)
  if (!bucket) {
    return {
      limited: false,
      remaining: options.maxRequests,
      retryAfterMs: 0,
      limit: options.maxRequests,
    }
  }
  pruneExpired(bucket, options.windowMs, now)
  const used = bucket.hits.length
  const limited = used >= options.maxRequests
  const oldest = bucket.hits[0] ?? now
  return {
    limited,
    remaining: Math.max(0, options.maxRequests - used),
    retryAfterMs: limited ? Math.max(0, oldest + options.windowMs - now) : 0,
    limit: options.maxRequests,
  }
}

/**
 * Record a hit and return whether the request is now over budget.
 */
export function consumeRateLimit(
  key: string,
  options: RateLimitOptions,
  now: number = Date.now(),
): RateLimitDecision {
  let bucket = store.get(key)
  if (!bucket) {
    bucket = { hits: [], lastTouchedAt: now }
    store.set(key, bucket)
    evictIfNeeded()
  }
  bucket.lastTouchedAt = now
  pruneExpired(bucket, options.windowMs, now)

  if (bucket.hits.length >= options.maxRequests) {
    const oldest = bucket.hits[0] ?? now
    return {
      limited: true,
      remaining: 0,
      retryAfterMs: Math.max(0, oldest + options.windowMs - now),
      limit: options.maxRequests,
    }
  }

  bucket.hits.push(now)
  // Bound per-bucket history. If a single key is being abused we still
  // want bounded memory — older hits in the same window are not
  // strictly required for accuracy once we know we are over budget.
  if (bucket.hits.length > MAX_HISTORY_PER_BUCKET) {
    bucket.hits.splice(0, bucket.hits.length - MAX_HISTORY_PER_BUCKET)
  }

  return {
    limited: false,
    remaining: options.maxRequests - bucket.hits.length,
    retryAfterMs: 0,
    limit: options.maxRequests,
  }
}

/**
 * Clear a single bucket (e.g. after a successful password reset so the
 * user can request another one if they fat-finger the new password).
 */
export function clearRateLimit(key: string): void {
  store.delete(key)
}

/**
 * Drop every bucket. Test helper.
 */
export function __resetRateLimitForTests(): void {
  store.clear()
}

/**
 * Hash a composite key (e.g. bucket + IP + user-id) into something
 * opaque so we never accidentally log a real IP or user-id to the
 * server console.
 */
export function hashRateLimitKey(parts: string[]): string {
  return createHash("sha256")
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, 32)
}
