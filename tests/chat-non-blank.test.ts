import { describe, expect, it } from "vitest"

import {
  kbAwareFallback,
  isEmergencyMessage,
} from "@/lib/ai/fallback"
import { buildSystemPrompt } from "@/lib/ai/prompt"
import { retrieve, type KnowledgeBundle } from "@/lib/ai/retrieval"
import { emptyKnowledgeBase } from "@/lib/ai/setup-assistant-schema"

const baseKb: KnowledgeBundle = {
  services: [
    {
      id: "s1",
      userId: null,
      name: "Botox",
      category: "Injectables",
      description: "Neuromodulator for fine lines.",
      pricingRule: "Per unit, confirmed at consultation",
      duration: "20 min",
      active: true,
    },
  ],
  faqs: [
    {
      id: "f_hours",
      userId: null,
      question: "What are your hours?",
      answer: "We're open Mon–Fri 9am to 5pm and Sat 10am to 3pm.",
      category: "Hours",
      updatedAt: "2024-01-01T00:00:00Z",
    },
  ],
  guardrails: [],
  widget: {
    id: "w1",
    brandName: "Glow Med Spa",
    logoInitial: "G",
    bubbleLogoUrl: null,
    primaryColor: "#E2E54B",
    position: "bottom-right",
    welcomeMessage: "Hi! Are you looking to book a consultation or ask about a treatment?",
    proactiveEnabled: true,
    proactiveDelaySeconds: 8,
    proactiveMessage: "Still browsing?",
    showBranding: true,
    collectEmail: true,
    collectPhone: true,
    consentText: "By chatting, you agree to our privacy policy.",
    workingHours: {
      enabled: true,
      tz: "America/Los_Angeles",
      schedule: [
        { day: "Mon", open: true, from: "09:00", to: "17:00" },
        { day: "Tue", open: true, from: "09:00", to: "17:00" },
        { day: "Wed", open: true, from: "09:00", to: "17:00" },
        { day: "Thu", open: true, from: "09:00", to: "17:00" },
        { day: "Fri", open: true, from: "09:00", to: "17:00" },
        { day: "Sat", open: true, from: "10:00", to: "15:00" },
        { day: "Sun", open: false, from: "09:00", to: "17:00" },
      ],
    },
    extendedKb: {},
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  extendedKb: { ...emptyKnowledgeBase(), source: "fresh" },
  fetchedAt: 0,
}

// ----------------------------------------------------------------------------
// TASK 9: Never-blank chat responses
//
// These tests enforce the contract that for every common visitor message
// the AI engine produces a non-empty, non-blank reply. If a future change
// breaks this contract, the chat goes back to showing blank bubbles in
// production — and these tests fail immediately.
// ----------------------------------------------------------------------------
describe("non-blank responses (no silent failures)", () => {
  const scenarios: Array<{ name: string; message: string; mustNotMatch?: RegExp[] }> = [
    {
      name: "pregnancy medical question",
      message: "Can I get filler while pregnant?",
    },
    {
      name: "out-of-scope service",
      message: "Do you do teeth whitening?",
      mustNotMatch: [/^we don't/i, /^we do not/i],
    },
    {
      name: "hours question",
      message: "What are your hours?",
    },
    {
      name: "casual greeting",
      message: "Hello",
    },
    {
      name: "thanks",
      message: "thanks",
    },
    {
      name: "bot identity",
      message: "are you a bot?",
    },
    {
      name: "treatment price",
      message: "How much is Botox?",
    },
    {
      name: "emergency",
      message: "I'm having trouble breathing",
    },
    {
      name: "completely unrelated trivia",
      message: "What's the capital of France?",
    },
  ]

  for (const s of scenarios) {
    it(`returns non-blank reply for: ${s.name}`, () => {
      const reply = kbAwareFallback(s.message, baseKb)
      expect(reply).toBeTruthy()
      expect(typeof reply).toBe("string")
      // The reply must contain actual content — non-blank, non-whitespace,
      // and at least a few characters. This is the core "never silent"
      // contract: any failure that returns "" or whitespace here fails.
      expect(reply.trim().length).toBeGreaterThan(8)
      for (const re of s.mustNotMatch ?? []) {
        expect(reply.toLowerCase()).not.toMatch(re)
      }
    })
  }
})

// ----------------------------------------------------------------------------
// TASK 9: Empty / broken KB does not crash the engine
// ----------------------------------------------------------------------------
describe("empty / broken knowledge base", () => {
  const emptyKb: KnowledgeBundle = {
    services: [],
    faqs: [],
    guardrails: [],
    widget: {
      ...baseKb.widget,
      workingHours: { enabled: false, tz: "UTC", schedule: [] },
    },
    extendedKb: { ...emptyKnowledgeBase(), source: "empty" },
    fetchedAt: 0,
  }

  it("kbAwareFallback never returns blank when KB is empty", () => {
    const messages = [
      "Do you do CoolSculpting?",
      "What are your hours?",
      "Hi",
      "Can I get filler while pregnant?",
      "I'm having chest pain",
      "How much is Botox?",
    ]
    for (const m of messages) {
      const reply = kbAwareFallback(m, emptyKb)
      expect(reply).toBeTruthy()
      expect(reply.trim().length).toBeGreaterThan(0)
    }
  })

  it("buildSystemPrompt never throws on empty KB", () => {
    expect(() => buildSystemPrompt(emptyKb, "anything")).not.toThrow()
    const { system } = buildSystemPrompt(emptyKb, "anything")
    expect(system).toBeTruthy()
    expect(system.length).toBeGreaterThan(0)
  })

  it("retrieve never throws on empty KB and returns empty array", () => {
    expect(() => retrieve("anything", emptyKb)).not.toThrow()
    expect(retrieve("anything", emptyKb)).toEqual([])
  })

  it("buildSystemPrompt survives null/undefined inputs defensively", () => {
    // Defensive test: buildSystemPrompt should accept any partially-broken
    // KB without crashing. We can't actually pass null/undefined (types
    // prevent it) but we can verify the function's behavior on a
    // minimally-valid KB.
    const minimalKb: KnowledgeBundle = {
      services: [],
      faqs: [],
      guardrails: [],
      widget: baseKb.widget,
      extendedKb: emptyKb.extendedKb,
      fetchedAt: 0,
    }
    expect(() => buildSystemPrompt(minimalKb, "x")).not.toThrow()
  })
})

// ----------------------------------------------------------------------------
// TASK 9: Emergency response always fires (never falls through to blank)
// ----------------------------------------------------------------------------
describe("emergency response always fires", () => {
  it("isEmergencyMessage is true for all critical signals", () => {
    expect(isEmergencyMessage("trouble breathing")).toBe(true)
    expect(isEmergencyMessage("severe swelling")).toBe(true)
    expect(isEmergencyMessage("chest pain")).toBe(true)
    expect(isEmergencyMessage("severe allergic reaction")).toBe(true)
    expect(isEmergencyMessage("I lost consciousness")).toBe(true)
  })

  it("emergency fallback never invents a treatment", () => {
    const reply = kbAwareFallback("I'm having trouble breathing", baseKb)
    expect(reply.toLowerCase()).toContain("medical emergency")
    expect(reply.toLowerCase()).toContain("emergency services")
    expect(reply.toLowerCase()).not.toContain("botox")
    expect(reply.toLowerCase()).not.toContain("filler")
    expect(reply.toLowerCase()).not.toContain("consultation request")
  })
})

// ----------------------------------------------------------------------------
// TASK 4: Defensive KB access — even when queries fail, the engine
//         never assumes data exists.
// ----------------------------------------------------------------------------
describe("defensive KB access in retrieval", () => {
  it("retrieve returns empty for queries with no token overlap", () => {
    expect(retrieve("zzz qqq xxx", baseKb)).toEqual([])
  })

  it("retrieve handles queries with only stop words", () => {
    // "do you have" — only stop words; should not crash.
    expect(() => retrieve("do you have", baseKb)).not.toThrow()
    const result = retrieve("do you have", baseKb)
    expect(Array.isArray(result)).toBe(true)
  })

  it("retrieve handles empty query string", () => {
    expect(() => retrieve("", baseKb)).not.toThrow()
  })
})