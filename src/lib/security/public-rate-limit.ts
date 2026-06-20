import "server-only"
import { createHash } from "node:crypto"

import {
  getRateLimit,
  recordRateLimitHit,
  type RateLimitOptions,
} from "../rate-limit"

export type PublicEndpointLimit = {
  bucket: string
  options: RateLimitOptions
}

const IP_HEADER_KEYS = [
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
  "true-client-ip",
] as const

export function getRequestIp(request: Request): string {
  for (const key of IP_HEADER_KEYS) {
    const value = request.headers.get(key)
    if (value) {
      const first = value.split(",")[0]?.trim()
      if (first) return first
    }
  }
  return "unknown"
}

function hashKey(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24)
}

export function checkPublicRateLimit(
  request: Request,
  limit: PublicEndpointLimit,
): {
  limited: boolean
  retryAfterMs: number
  remaining: number
  bucket: string
  key: string
} {
  const ip = getRequestIp(request)
  const key = hashKey([limit.bucket, ip])
  const result = getRateLimit(key, limit.options)
  return { ...result, bucket: limit.bucket, key }
}

export function consumePublicRateLimit(
  request: Request,
  limit: PublicEndpointLimit,
): ReturnType<typeof checkPublicRateLimit> {
  const ip = getRequestIp(request)
  const key = hashKey([limit.bucket, ip])
  const result = getRateLimit(key, limit.options)
  if (!result.limited) recordRateLimitHit(key, limit.options)
  return { ...result, bucket: limit.bucket, key }
}
