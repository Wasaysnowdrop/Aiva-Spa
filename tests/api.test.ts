import { describe, expect, it } from "vitest"

import { isValidEmail, isValidPhone } from "@/lib/ai/validation"

describe("api validation rules", () => {
  it("email regex catches common shapes", () => {
    expect(isValidEmail("a@b.com")).toBe(true)
    expect(isValidEmail("first.last+tag@sub.domain.io")).toBe(true)
    expect(isValidEmail("a@b")).toBe(false)
    expect(isValidEmail("missing@dot")).toBe(false)
  })

  it("phone regex catches short and long numbers", () => {
    expect(isValidPhone("(415) 555-0100")).toBe(true)
    expect(isValidPhone("+1 415 555 0100")).toBe(true)
    expect(isValidPhone("12")).toBe(false)
    expect(isValidPhone("1234567890123456")).toBe(false)
  })
})
