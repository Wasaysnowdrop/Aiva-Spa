import { describe, expect, it } from "vitest"

import {
  kbAwareFallback,
  isEmergencyMessage,
} from "@/lib/ai/fallback"
import { safeValidate, leadRequestSchema } from "@/lib/ai/validation"
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
    {
      id: "s2",
      userId: null,
      name: "HydraFacial",
      category: "Skin",
      description: "Deep cleansing and hydration.",
      pricingRule: "Per session",
      duration: "50 min",
      active: true,
    },
  ],
  faqs: [
    {
      id: "f1",
      userId: null,
      question: "Do you offer Botox?",
      answer:
        "Yes, we offer Botox for forehead lines, crow's feet, and frown lines. Pricing is per unit and confirmed at consultation by a licensed provider.",
      category: "General",
      updatedAt: "2024-01-01T00:00:00Z",
    },
  ],
  guardrails: [
    {
      id: "g1",
      userId: null,
      title: "No medical advice",
      body: "Refuse to assess conditions or recommend treatments for symptoms.",
      description: "Refuse to assess conditions or recommend treatments for symptoms.",
      ruleType: "medical",
      enabled: true,
      isActive: true,
    },
  ],
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
    workingHours: { enabled: false, tz: "America/Los_Angeles", schedule: [] },
    extendedKb: {},
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  extendedKb: { ...emptyKnowledgeBase(), source: "fresh" },
  fetchedAt: 0,
}

// ----------------------------------------------------------------------------
// PROBLEM #7: Emergency handling — must short-circuit before any other intent
// ----------------------------------------------------------------------------
describe("emergency handling", () => {
  const emergencyMessages = [
    "I'm having trouble breathing",
    "I have shortness of breath",
    "Severe swelling in my throat",
    "I have a severe allergic reaction",
    "I'm having chest pain",
    "I think I'm having a heart attack",
    "I lost consciousness",
    "I fainted",
    "I'm suicidal",
  ]

  for (const msg of emergencyMessages) {
    it(`detects emergency: "${msg}"`, () => {
      expect(isEmergencyMessage(msg)).toBe(true)
    })
  }

  for (const msg of emergencyMessages) {
    it(`returns urgent warning (no lead capture) for: "${msg}"`, () => {
      const reply = kbAwareFallback(msg, baseKb)
      expect(reply).toMatch(/medical emergency/i)
      expect(reply).toMatch(/emergency services/i)
      // The reply must NOT push consultation capture or lead form.
      expect(reply.toLowerCase()).not.toContain("consultation request")
      expect(reply.toLowerCase()).not.toContain("submit a consultation")
      expect(reply.toLowerCase()).not.toContain("book")
    })
  }

  it("emergency detection runs BEFORE off-topic detection", () => {
    // "I have severe swelling" could match medical-advice patterns; emergency must win.
    expect(isEmergencyMessage("severe swelling and trouble breathing")).toBe(true)
    expect(kbAwareFallback("severe swelling and trouble breathing", baseKb)).toMatch(
      /medical emergency/i,
    )
  })
})

// ----------------------------------------------------------------------------
// PROBLEM #1: No fake booking confirmation in any AI response
// ----------------------------------------------------------------------------
describe("no fake booking confirmation", () => {
  const forbidden = [
    "booking confirmed",
    "appointment confirmed",
    "you are booked",
    "you're booked",
    "your appointment is scheduled",
    "we reserved your slot",
    "appointment successfully scheduled",
    "appointment booked",
  ]

  it("the system prompt forbids every fake-confirmation phrase", () => {
    const { system } = buildSystemPrompt(baseKb, "Tomorrow around 2 PM if available")
    for (const phrase of forbidden) {
      // The rule section must explicitly call out the forbidden phrase
      // (so the model knows to never say it). Lowercased check because the
      // prompt lists them in lowercase.
      expect(system.toLowerCase()).toContain(phrase.toLowerCase())
    }
    // The rule section must include the prescribed safe wording.
    expect(system.toLowerCase()).toMatch(/consultation request/)
    expect(system).toMatch(/team will contact you to confirm availability/i)
    expect(system).toMatch(/team member will review availability/i)
  })

  it("the kb-aware fallback never produces a fake confirmation", () => {
    const messages = [
      "Tomorrow around 2 PM if available",
      "Can I book a consultation?",
      "I want to book an appointment for next Tuesday",
      "Please schedule me for 3pm today",
      "Do you have availability on Friday?",
    ]
    for (const m of messages) {
      const reply = kbAwareFallback(m, baseKb)
      const lower = reply.toLowerCase()
      for (const phrase of forbidden) {
        expect(lower, `reply "${reply}" should not contain "${phrase}"`).not.toContain(
          phrase.toLowerCase(),
        )
      }
    }
  })

  it("FAQ-sourced replies about booking are sanitized to request-submitted language", () => {
    const kb: KnowledgeBundle = {
      ...baseKb,
      faqs: [
        {
          id: "fx",
          userId: null,
          question: "Is my appointment scheduled?",
          // Stale FAQ that previously said "Booking confirmed". The fallback
          // must NOT pass this through verbatim.
          answer:
            "Booking confirmed for Sarah Johnson. Your appointment is scheduled for tomorrow at 2pm.",
          category: "Booking",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ],
    }
    const reply = kbAwareFallback("is my appointment scheduled", kb)
    const lower = reply.toLowerCase()
    for (const phrase of forbidden) {
      expect(lower, `reply "${reply}" should not contain "${phrase}"`).not.toContain(
        phrase.toLowerCase(),
      )
    }
  })
})

// ----------------------------------------------------------------------------
// PROBLEM #2: All six required lead fields must be enforced
// ----------------------------------------------------------------------------
describe("lead field completeness", () => {
  it("leadRequestSchema requires email and notes (no optional)", () => {
    const withoutEmail = safeValidate(leadRequestSchema, {
      name: "Jane Doe",
      phone: "(415) 555-0100",
      service: "Botox",
      preferredTime: "Saturday morning",
      notes: "Softening forehead lines",
      // Missing email.
    })
    expect(withoutEmail.ok).toBe(false)
    if (!withoutEmail.ok) {
      expect(withoutEmail.error.toLowerCase()).toMatch(/email/)
    }

    const withoutNotes = safeValidate(leadRequestSchema, {
      name: "Jane Doe",
      phone: "(415) 555-0100",
      email: "jane@example.com",
      service: "Botox",
      preferredTime: "Saturday morning",
      // Missing notes.
    })
    expect(withoutNotes.ok).toBe(false)
    if (!withoutNotes.ok) {
      expect(withoutNotes.error.toLowerCase()).toMatch(/notes/)
    }
  })

  it("leadRequestSchema rejects empty notes and empty email", () => {
    const v = safeValidate(leadRequestSchema, {
      name: "Jane Doe",
      phone: "(415) 555-0100",
      service: "Botox",
      preferredTime: "Saturday morning",
      email: "",
      notes: "",
    })
    expect(v.ok).toBe(false)
  })

  it("leadRequestSchema accepts a fully complete lead", () => {
    const v = safeValidate(leadRequestSchema, {
      name: "Jane Doe",
      phone: "(415) 555-0100",
      email: "jane@example.com",
      service: "Botox",
      preferredTime: "Saturday morning",
      notes: "Want to soften forehead lines",
    })
    expect(v.ok).toBe(true)
  })

  it("the system prompt requires all six lead fields", () => {
    const { system } = buildSystemPrompt(baseKb, "I'd like to book")
    expect(system).toMatch(/Full name/i)
    expect(system).toMatch(/Phone number/i)
    expect(system).toMatch(/Email address/i)
    expect(system).toMatch(/Service/i)
    expect(system).toMatch(/Preferred date\s*\/\s*time/i)
    expect(system).toMatch(/Notes or goals/i)
    expect(system).toMatch(/all six/i)
  })

  it("the system prompt's worked example for booking asks for every field", () => {
    const { system } = buildSystemPrompt(baseKb, "Tomorrow around 2 PM")
    // The worked example for booking must enumerate every required field.
    const example = system.split("Visitor: \"Tomorrow around 2 PM if available.\"")[1] ?? ""
    expect(example).toMatch(/name/i)
    expect(example).toMatch(/phone/i)
    expect(example).toMatch(/email/i)
    expect(example).toMatch(/service/i)
    expect(example).toMatch(/time/i)
    expect(example).toMatch(/goals|notes|concerns/i)
  })
})

// ----------------------------------------------------------------------------
// PROBLEM #3: Out-of-scope services must NOT be denied or invented
// ----------------------------------------------------------------------------
describe("out-of-scope services", () => {
  const unknown = [
    "Do you do teeth whitening?",
    "Do you offer CoolSculpting?",
    "How much is rhinoplasty?",
    "Can you do hair transplant?",
    "Do you do weight loss with semaglutide?",
  ]

  for (const msg of unknown) {
    it(`does not invent or deny for: "${msg}"`, () => {
      const reply = kbAwareFallback(msg, baseKb)
      const lower = reply.toLowerCase()
      // Never deny outright.
      expect(lower).not.toMatch(/^we don't offer/)
      expect(lower).not.toMatch(/^we do not offer/)
      // Never invent a price or confirm availability.
      expect(lower).not.toMatch(/^\$\d/)
      expect(lower).not.toContain("we don't do that")
      // Should mention knowledge base + offer to submit a request.
      expect(lower).toMatch(/knowledge base/)
      expect(lower).toMatch(/consultation request/)
    })
  }
})

// ----------------------------------------------------------------------------
// PROBLEM #4: Strict KB-only mode
// ----------------------------------------------------------------------------
describe("KB-only mode", () => {
  it("the system prompt enforces R1 KB-ONLY and R2 NO HALLUCINATION", () => {
    const { system } = buildSystemPrompt(baseKb, "what's the weather")
    expect(system).toMatch(/R1\.\s*KB-ONLY/i)
    expect(system).toMatch(/R2\.\s*NO HALLUCINATION/i)
  })

  it("retrieval returns empty for completely unrelated queries", () => {
    expect(retrieve("xyzzy foobar quux", baseKb)).toEqual([])
  })

  it("the fallback never quotes a price the KB doesn't have", () => {
    const reply = kbAwareFallback("how much is a chemical peel", baseKb)
    expect(reply).not.toMatch(/\$\d/)
    expect(reply).toMatch(/licensed provider/i)
  })
})

// ----------------------------------------------------------------------------
// PROBLEM #6: Medical safety — no diagnoses, no exact units
// ----------------------------------------------------------------------------
describe("medical safety", () => {
  const unitRequests = [
    "How many units of botox do I need for my forehead?",
    "I want 2cc of lip filler, how much?",
    "What's the right dosage of dysport for me?",
    "How many syringes of juvederm for my cheeks?",
  ]

  for (const msg of unitRequests) {
    it(`refuses exact-unit request: "${msg}"`, () => {
      const reply = kbAwareFallback(msg, baseKb)
      const lower = reply.toLowerCase()
      // Must not invent a number.
      expect(lower).not.toMatch(/you need \d/)
      expect(lower).not.toMatch(/^\d+\s*(units|cc|ml)/)
      // Must defer to a provider.
      expect(reply).toMatch(/licensed provider/i)
    })
  }

  it("refuses pregnancy / breastfeeding questions with no medical advice", () => {
    const reply = kbAwareFallback("I'm pregnant, is botox safe?", baseKb)
    const lower = reply.toLowerCase()
    expect(lower).not.toContain("yes")
    expect(lower).not.toContain("safe")
    expect(reply).toMatch(/licensed provider/i)
    expect(reply).toMatch(/consultation request/i)
  })

  it("the system prompt forbids recommending exact units", () => {
    const { system } = buildSystemPrompt(baseKb, "how many units")
    expect(system).toMatch(/NO EXACT UNITS/i)
    expect(system).toMatch(/R3a/i)
  })
})

// ----------------------------------------------------------------------------
// PROBLEM #8: Pricing — only ranges, never exact; provider confirms
// ----------------------------------------------------------------------------
describe("pricing safety", () => {
  it("the system prompt requires the 'final pricing depends on consultation' disclaimer", () => {
    const { system } = buildSystemPrompt(baseKb, "how much")
    expect(system).toMatch(/Final pricing depends on consultation and provider recommendation/i)
  })

  it("the kb-aware fallback never invents a number for pricing questions", () => {
    const reply = kbAwareFallback("how much does botox cost", baseKb)
    expect(reply).not.toMatch(/\$\d/)
    expect(reply).toMatch(/licensed provider/i)
  })
})
