import { describe, expect, it, beforeEach } from "vitest"

import {
  __resetRateLimitForTests,
  consumeRateLimit,
  peekRateLimit,
  hashRateLimitKey,
} from "@/lib/security/rate-limit"

describe("rate-limit primitive", () => {
  beforeEach(() => {
    __resetRateLimitForTests()
  })

  it("allows requests up to the budget and then blocks", () => {
    const opts = { maxRequests: 3, windowMs: 60_000 }
    const key = hashRateLimitKey(["test", "ip=1.2.3.4"])
    expect(consumeRateLimit(key, opts).limited).toBe(false)
    expect(consumeRateLimit(key, opts).limited).toBe(false)
    expect(consumeRateLimit(key, opts).limited).toBe(false)
    const fourth = consumeRateLimit(key, opts)
    expect(fourth.limited).toBe(true)
    expect(fourth.retryAfterMs).toBeGreaterThan(0)
    expect(fourth.remaining).toBe(0)
  })

  it("is sliding — expires old hits out of the window", () => {
    const opts = { maxRequests: 2, windowMs: 1000 }
    const key = hashRateLimitKey(["test", "expire"])
    expect(consumeRateLimit(key, opts, 0).limited).toBe(false)
    expect(consumeRateLimit(key, opts, 100).limited).toBe(false)
    expect(consumeRateLimit(key, opts, 200).limited).toBe(true)
    // After the window, old hits drop out
    expect(consumeRateLimit(key, opts, 1500).limited).toBe(false)
  })

  it("keeps separate buckets for separate keys", () => {
    const opts = { maxRequests: 1, windowMs: 60_000 }
    const a = hashRateLimitKey(["test", "a"])
    const b = hashRateLimitKey(["test", "b"])
    expect(consumeRateLimit(a, opts).limited).toBe(false)
    expect(consumeRateLimit(a, opts).limited).toBe(true)
    expect(consumeRateLimit(b, opts).limited).toBe(false)
  })

  it("peek does not record a hit", () => {
    const opts = { maxRequests: 1, windowMs: 60_000 }
    const key = hashRateLimitKey(["test", "peek"])
    expect(peekRateLimit(key, opts).limited).toBe(false)
    expect(peekRateLimit(key, opts).limited).toBe(false)
    // Real hit consumes the budget
    expect(consumeRateLimit(key, opts).limited).toBe(false)
    expect(peekRateLimit(key, opts).limited).toBe(true)
  })

  it("hashes the key — IP/email not echoed back", () => {
    const k = hashRateLimitKey(["bucket", "ip=1.2.3.4", "id=alice@example.com"])
    expect(k).toMatch(/^[0-9a-f]{32}$/)
    expect(k).not.toContain("1.2.3.4")
    expect(k).not.toContain("alice")
  })
})
