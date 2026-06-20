import { describe, expect, it } from "vitest"

import { detectHumanGreeting } from "@/lib/ai/greetings"

describe("detectHumanGreeting", () => {
  it.each([
    "hi",
    "hello",
    "hey",
    "hey!",
    "hi there",
    "hello!",
    "hiya",
    "yo",
    "good morning",
    "Good Morning",
    "howdy",
    "hi :)",
    "hello there",
  ])("matches pure greeting: %s", (msg) => {
    const result = detectHumanGreeting(msg, { isFirstReply: true, afterHours: false })
    expect(result.matched).toBe(true)
    if (result.matched) {
      expect(result.reason).toBe("pure_greeting")
      expect(result.reply.length).toBeGreaterThan(8)
    }
  })

  it("does NOT match a greeting combined with a real question (lets the LLM handle it)", () => {
    const result = detectHumanGreeting("hi, do you do botox?", {
      isFirstReply: true,
      afterHours: false,
    })
    expect(result.matched).toBe(false)
  })

  it("does NOT match long messages", () => {
    const long = "hello " + "x".repeat(200)
    const result = detectHumanGreeting(long, { isFirstReply: true, afterHours: false })
    expect(result.matched).toBe(false)
  })

  it("matches thanks-only messages", () => {
    const result = detectHumanGreeting("thanks!", {
      isFirstReply: false,
      afterHours: false,
    })
    expect(result.matched).toBe(true)
    if (result.matched) expect(result.reason).toBe("thanks")
  })

  it("matches small talk about identity", () => {
    const result = detectHumanGreeting("are you a bot?", {
      isFirstReply: true,
      afterHours: false,
    })
    expect(result.matched).toBe(true)
    if (result.matched) expect(result.reason).toBe("small_talk")
  })

  it("matches are-you-there", () => {
    const result = detectHumanGreeting("anyone there?", {
      isFirstReply: true,
      afterHours: false,
    })
    expect(result.matched).toBe(true)
  })

  it("greeting replies vary across calls (different seeds pick different openers)", () => {
    const samples = new Set<string>()
    for (const seed of ["hi", "hello", "hey", "hi!", "hi.", "hi there"]) {
      const result = detectHumanGreeting(seed, {
        isFirstReply: true,
        afterHours: false,
      })
      if (result.matched) samples.add(result.reply.split(" ")[0] ?? "")
    }
    expect(samples.size).toBeGreaterThan(1)
  })

  it("greeting reply never leads with lead-capture language", () => {
    const greetings = ["hi", "hello", "hey", "good morning", "how are you"]
    for (const g of greetings) {
      const result = detectHumanGreeting(g, {
        isFirstReply: true,
        afterHours: false,
      })
      if (result.matched) {
        expect(result.reply.toLowerCase()).not.toMatch(
          /\b(phone|number|details|consult(ation)?|book(ing)?|schedule)\b/,
        )
      }
    }
  })

  it("after-hours mode still greets warmly without pushing booking", () => {
    const result = detectHumanGreeting("hi", {
      isFirstReply: true,
      afterHours: true,
    })
    expect(result.matched).toBe(true)
    if (result.matched) {
      expect(result.reply.toLowerCase()).not.toMatch(/call us|book now|schedule today/)
    }
  })
})
