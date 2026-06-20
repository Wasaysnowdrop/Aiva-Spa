import { describe, expect, it } from "vitest"

import {
  ALL_SCOPES,
  API_KEY_PREFIX,
  constantTimeEqual,
  generateApiKey,
  hashApiKey,
  isLikelyApiKey,
} from "@/lib/api/keys"

describe("API key generation + hashing", () => {
  it("generateApiKey produces a 'aiva_live_…' plaintext and matching hash", () => {
    const { full, prefix, hash } = generateApiKey()
    expect(full.startsWith(API_KEY_PREFIX)).toBe(true)
    expect(full.length).toBeGreaterThan(API_KEY_PREFIX.length + 20)
    expect(prefix.endsWith("…")).toBe(true)
    expect(prefix.length).toBe(13)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hashApiKey(full)).toBe(hash)
  })

  it("generateApiKey returns unique keys on each call", () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(a.full).not.toBe(b.full)
    expect(a.hash).not.toBe(b.hash)
  })

  it("hashApiKey is deterministic", () => {
    const key = `${API_KEY_PREFIX}abc`
    expect(hashApiKey(key)).toBe(hashApiKey(key))
  })

  it("hashApiKey differs for different inputs", () => {
    expect(hashApiKey(`${API_KEY_PREFIX}abc`)).not.toBe(hashApiKey(`${API_KEY_PREFIX}xyz`))
  })

  it("isLikelyApiKey accepts the right prefix and rejects others", () => {
    expect(isLikelyApiKey(`${API_KEY_PREFIX}xxx`)).toBe(true)
    expect(isLikelyApiKey("aiva_test_xxx")).toBe(false)
    expect(isLikelyApiKey("Bearer abc")).toBe(false)
  })
})

describe("constantTimeEqual", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true)
    expect(constantTimeEqual("", "")).toBe(true)
  })

  it("returns false for different strings of the same length", () => {
    expect(constantTimeEqual("abc", "abd")).toBe(false)
  })

  it("returns false for different lengths", () => {
    expect(constantTimeEqual("abc", "abcd")).toBe(false)
    expect(constantTimeEqual("a", "")).toBe(false)
  })
})

describe("ALL_SCOPES", () => {
  it("exposes the documented scopes", () => {
    expect(ALL_SCOPES).toEqual(
      expect.arrayContaining(["leads:read", "leads:write", "conversations:read"]),
    )
  })
})
