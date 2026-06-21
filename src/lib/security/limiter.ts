/**
 * Helpers for HTTP-facing rate limiting.
 *
 * This module is the single entry point for applying rate limits in
 * route handlers and server actions. It owns:
 *
 *   - IP extraction that respects a configured trusted-proxy chain
 *   - Key composition (bucket + IP + optional user-id)
 *   - Standard 429 response building
 *
 * Always use these helpers instead of calling the underlying
 * `consumeRateLimit()` directly so we get consistent headers + logging.
 *
 * No `server-only` import: this module is also imported by
 * `tests/*` which runs under vitest's normal node env. Functions
 * here are still safe to call from anywhere — they only operate on
 * `Request` and the rate-limit store.
 */

import { headers } from "next/headers"

import {
  consumeRateLimit,
  hashRateLimitKey,
  peekRateLimit,
  type RateLimitDecision,
  type RateLimitOptions,
} from "./rate-limit"

export type { RateLimitDecision, RateLimitOptions } from "./rate-limit"

/** Header keys to consult, in priority order. */
const IP_HEADER_KEYS = [
  "cf-connecting-ip",
  "true-client-ip",
  "x-real-ip",
  "x-forwarded-for",
] as const

/**
 * `TRUSTED_PROXY_HOPS` is the number of trusted reverse proxies in
 * front of the app. With one hop (Vercel/Cloudflare default), the
 * rightmost x-forwarded-for entry is the real client IP — but only the
 * leftmost is unspoofable. Set this env to the number of proxies you
 * expect (0 disables trust entirely, which is the safest default for
 * self-hosted deployments where you control the edge).
 */
function getTrustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS
  if (!raw) return 1 // Vercel/Cloudflare default
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return 1
  return Math.min(n, 10) // safety cap
}

/**
 * Extract the client IP from a `Request`. Walks the configured
 * trusted-proxy hop count backwards through the x-forwarded-for chain
 * to pick the rightmost entry that is still inside our trust boundary.
 * Returns "unknown" if no usable header is present.
 */
export function getRequestIp(request: Request | null | undefined): string {
  if (!request || !request.headers) return "unknown"
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean)
    const hops = getTrustedProxyHops()
    // If we have N trusted hops, we want the IP at index `parts.length - N - 1`
    // (0-based). The last N entries are our own proxies.
    const idx = Math.max(0, parts.length - 1 - hops)
    if (parts[idx]) return parts[idx]!
  }
  for (const key of IP_HEADER_KEYS) {
    const value = request.headers.get(key)
    if (value) {
      const first = value.split(",")[0]?.trim()
      if (first) return first
    }
  }
  return "unknown"
}

/**
 * Async variant for Server Actions / RSC. Reads from `next/headers`.
 * Returns the request IP if it can be derived from a forwarded header
 * that RSC exposes; otherwise "unknown".
 */
export async function getRequestIpAsync(): Promise<string> {
  try {
    const h = await headers()
    for (const key of IP_HEADER_KEYS) {
      const value = h.get(key)
      if (value) {
        const first = value.split(",")[0]?.trim()
        if (first) return first
      }
    }
    const forwarded = h.get("x-forwarded-for")
    if (forwarded) {
      const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean)
      const hops = getTrustedProxyHops()
      const idx = Math.max(0, parts.length - 1 - hops)
      if (parts[idx]) return parts[idx]!
    }
  } catch {
    // headers() throws outside a request scope — treat as unknown.
  }
  return "unknown"
}

export type NamedLimit = {
  bucket: string
  options: RateLimitOptions
}

export type LimitContext = {
  ip?: string
  identity?: string
}

function makeKey(limit: NamedLimit, ctx: LimitContext): string {
  return hashRateLimitKey([
    limit.bucket,
    `ip=${ctx.ip ?? "unknown"}`,
    `id=${ctx.identity ?? "_"}`,
  ])
}

/**
 * Record a hit against the named limit and return the decision. The
 * caller is responsible for translating `decision.limited` into a
 * 429 response, server-action error, or log warning.
 */
export function consume(
  limit: NamedLimit,
  ctx: LimitContext,
): RateLimitDecision & { bucket: string; key: string } {
  const key = makeKey(limit, ctx)
  return { bucket: limit.bucket, key, ...consumeRateLimit(key, limit.options) }
}

/**
 * Inspect (don't record) the current state of a named limit.
 */
export function peek(
  limit: NamedLimit,
  ctx: LimitContext,
): RateLimitDecision & { bucket: string; key: string } {
  const key = makeKey(limit, ctx)
  return { bucket: limit.bucket, key, ...peekRateLimit(key, limit.options) }
}

/**
 * Build a standard 429 response with rate-limit headers. Use this for
 * any HTTP route handler that decides to reject based on `consume()`.
 */
export function tooManyRequests(
  decision: RateLimitDecision,
  corsHeaders: Record<string, string> = {},
  message = "Too many requests. Please slow down.",
): Response {
  const retryAfter = Math.max(1, Math.ceil(decision.retryAfterMs / 1000))
  return new Response(
    JSON.stringify({
      ok: false,
      error: message,
      retryAfterSeconds: retryAfter,
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "retry-after": String(retryAfter),
        "x-ratelimit-limit": String(decision.limit),
        "x-ratelimit-remaining": String(decision.remaining),
        "x-ratelimit-reset": String(Math.ceil(decision.retryAfterMs / 1000)),
        ...corsHeaders,
      },
    },
  )
}

/**
 * Convenience wrapper for route handlers. Runs the named limit, returns
 * either `null` (caller may proceed) or a ready-to-send 429 response.
 */
export function gate(
  request: Request,
  limit: NamedLimit,
  identity?: string,
  message?: string,
): Response | null {
  const decision = consume(limit, { ip: getRequestIp(request), identity })
  return decision.limited ? tooManyRequests(decision, {}, message) : null
}
