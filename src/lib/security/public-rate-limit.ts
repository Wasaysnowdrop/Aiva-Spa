import "server-only"

import {
  consume,
  getRequestIp,
  peek,
  type NamedLimit,
} from "./limiter"
import type { RateLimitDecision } from "./rate-limit"

export type PublicEndpointLimit = NamedLimit

export type PublicRateLimitResult = RateLimitDecision & {
  bucket: string
  key: string
}

export function checkPublicRateLimit(
  request: Request,
  limit: PublicEndpointLimit,
  identity?: string,
): PublicRateLimitResult {
  return peek(limit, { ip: getRequestIp(request), identity })
}

export function consumePublicRateLimit(
  request: Request,
  limit: PublicEndpointLimit,
  identity?: string,
): PublicRateLimitResult {
  return consume(limit, { ip: getRequestIp(request), identity })
}
