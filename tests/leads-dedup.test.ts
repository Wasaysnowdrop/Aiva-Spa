import { describe, expect, it } from "vitest"

import {
  normalizeContact,
  normalizeEmail,
  normalizePhone,
} from "@/lib/leads/dedup-shared"

describe("lead deduplication normalization", () => {
  describe("normalizePhone", () => {
    it("strips formatting and keeps the last 10 digits", () => {
      expect(normalizePhone("(415) 555-0100")).toBe("4155550100")
      expect(normalizePhone("+1 415 555 0100")).toBe("4155550100")
      expect(normalizePhone("415.555.0100")).toBe("4155550100")
      expect(normalizePhone(" 415-555-0100 ")).toBe("4155550100")
    })

    it("returns empty for nullish, empty, or too-short values", () => {
      expect(normalizePhone("")).toBe("")
      expect(normalizePhone(null)).toBe("")
      expect(normalizePhone(undefined)).toBe("")
      expect(normalizePhone("123")).toBe("")
      expect(normalizePhone("12")).toBe("")
    })

    it("truncates long numbers to the last 10 digits", () => {
      // International prefix + extension — the actual phone is the rightmost 10 digits.
      expect(normalizePhone("+1-415-555-0100 ext 22")).toBe("5555010022")
      expect(normalizePhone("+1 (415) 555-0100")).toBe("4155550100")
    })

    it("treats differently-formatted phones as the same key", () => {
      const a = normalizePhone("(415) 555-0100")
      const b = normalizePhone("+1 415 555 0100")
      const c = normalizePhone("4155550100")
      expect(a).toBe(b)
      expect(b).toBe(c)
    })
  })

  describe("normalizeEmail", () => {
    it("lowercases and trims whitespace", () => {
      expect(normalizeEmail("  Jane.Doe@GlowMedspa.com  ")).toBe("jane.doe@glowmedspa.com")
      expect(normalizeEmail("JANE@GLOW.COM")).toBe("jane@glow.com")
    })

    it("returns empty for nullish/empty", () => {
      expect(normalizeEmail("")).toBe("")
      expect(normalizeEmail(null)).toBe("")
      expect(normalizeEmail(undefined)).toBe("")
    })
  })

  describe("normalizeContact", () => {
    it("returns both normalized fields", () => {
      const c = normalizeContact({ phone: "(415) 555-0100", email: "JANE@X.COM" })
      expect(c.phone).toBe("4155550100")
      expect(c.email).toBe("jane@x.com")
    })

    it("handles missing fields", () => {
      const c = normalizeContact({ phone: undefined, email: undefined })
      expect(c).toEqual({ phone: "", email: "" })
    })
  })
})
