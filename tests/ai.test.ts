import { describe, expect, it } from "vitest"

import {
  isValidEmail,
  isValidPhone,
  safeValidate,
  chatRequestSchema,
  leadRequestSchema,
} from "@/lib/ai/validation"
import { retrieve, type KnowledgeBundle } from "@/lib/ai/retrieval"
import { emptyKnowledgeBase } from "@/lib/ai/setup-assistant-schema"
import { buildSystemPrompt } from "@/lib/ai/prompt"
import { isAfterHours } from "@/lib/ai/working-hours"
import { buildLanguageDirective, isSupportedLanguage } from "@/lib/i18n"
import { kbAwareFallback, isOffTopicMessage } from "@/lib/ai/fallback"

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
      answer: "Yes, we offer Botox for forehead lines, crow's feet, and frown lines. Pricing is per unit and confirmed at consultation by a licensed provider.",
      category: "General",
      updatedAt: "2024-01-01T00:00:00Z",
    },
    {
      id: "f2",
      userId: null,
      question: "How do I book a consultation?",
      answer: "Share your name, phone, email, and preferred time here in chat. Our team will confirm the appointment within 1 business hour.",
      category: "Booking",
      updatedAt: "2024-01-01T00:00:00Z",
    },
  ],
  guardrails: [
    { id: "g1", userId: null, title: "No medical advice", body: "Refuse to assess conditions or recommend treatments for symptoms.", description: "Refuse to assess conditions or recommend treatments for symptoms.", ruleType: "medical", enabled: true, isActive: true },
    { id: "g2", userId: null, title: "No firm pricing", body: "Always defer to a licensed provider during consultation.", description: "Always defer to a licensed provider during consultation.", ruleType: "pricing", enabled: true, isActive: true },
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

describe("validation", () => {
  it("accepts well-formed chat requests", () => {
    const v = safeValidate(chatRequestSchema, {
      sessionId: "abc",
      message: "Do you offer Botox?",
    })
    expect(v.ok).toBe(true)
  })

  it("rejects empty chat messages", () => {
    const v = safeValidate(chatRequestSchema, { sessionId: "abc", message: "" })
    expect(v.ok).toBe(false)
  })

  it("accepts well-formed lead submissions", () => {
    const v = safeValidate(leadRequestSchema, {
      sessionId: "abc",
      name: "Jane Doe",
      phone: "(415) 555-0100",
      service: "Botox",
      preferredTime: "Saturday morning",
    })
    expect(v.ok).toBe(true)
  })

  it("rejects leads without required fields", () => {
    const v = safeValidate(leadRequestSchema, {
      sessionId: "abc",
      name: "",
      phone: "",
      service: "",
      preferredTime: "",
    })
    expect(v.ok).toBe(false)
  })

  it("isValidEmail accepts valid emails and rejects garbage", () => {
    expect(isValidEmail("a@b.co")).toBe(true)
    expect(isValidEmail("not-an-email")).toBe(false)
  })

  it("isValidPhone accepts plausible phone numbers", () => {
    expect(isValidPhone("(415) 555-0100")).toBe(true)
    expect(isValidPhone("123")).toBe(false)
  })
})

describe("retrieval", () => {
  it("finds Botox service for a Botox query", () => {
    const items = retrieve("Do you offer botox?", baseKb)
    const serviceHit = items.find((i) => i.kind === "service" && i.service.name === "Botox")
    expect(serviceHit).toBeDefined()
  })

  it("finds FAQ by keyword overlap", () => {
    const items = retrieve("how do I book a consultation", baseKb)
    const faqHit = items.find((i) => i.kind === "faq" && i.faq.id === "f2")
    expect(faqHit).toBeDefined()
  })

  it("returns empty results for an unrelated query", () => {
    const items = retrieve("qzwx qzwx qzwx", baseKb)
    expect(items.length).toBe(0)
  })
})

describe("system prompt", () => {
  it("does not include the first-reply medical disclaimer (owner opted out)", () => {
    const { system } = buildSystemPrompt(baseKb, "hi")
    // The system prompt no longer instructs the model to append a
    // medical disclaimer on the first reply — owners opted out.
    expect(system).not.toMatch(/DISCLAIMER ON FIRST REPLY/i)
    expect(system).not.toMatch(/append this on its own line at the very end/i)
    expect(system).not.toMatch(/Medical disclaimer \(append on first reply/i)
  })

  it("embeds the spa brand name", () => {
    const { system } = buildSystemPrompt(baseKb, "hi")
    expect(system).toContain("Glow Med Spa")
  })

  it("enforces KB-only answer mode with explicit rule IDs", () => {
    const { system } = buildSystemPrompt(baseKb, "hi")
    expect(system).toMatch(/R1\.\s*KB-ONLY/i)
    expect(system).toMatch(/R2\.\s*NO HALLUCINATION/i)
    expect(system).toMatch(/R3\.\s*NO MEDICAL ADVICE/i)
    expect(system).toMatch(/R4\.\s*NO FIRM PRICES/i)
    expect(system).toMatch(/R5\.\s*NO GUARANTEES/i)
    expect(system).toMatch(/R6\.\s*CONSENT/i)
    expect(system).toMatch(/R9\.\s*NEVER roleplay/i)
  })

  it("embeds each service with its pricing rule for verbatim quoting", () => {
    const { system } = buildSystemPrompt(baseKb, "Botox")
    expect(system).toMatch(/Per unit, confirmed at consultation/)
    expect(system).toMatch(/HydraFacial/)
  })

  it("embeds FAQs verbatim with citations", () => {
    const { system } = buildSystemPrompt(baseKb, "Do you offer Botox?")
    expect(system).toContain("Do you offer Botox?")
    expect(system).toContain("Pricing is per unit and confirmed at consultation")
  })

  it("still includes the pricing disclaimer text (R4 needs it)", () => {
    const { system } = buildSystemPrompt(baseKb, "hi")
    expect(system).toMatch(/Pricing disclaimer/i)
    expect(system).toMatch(/licensed provider confirms exact pricing/i)
  })

  it("instructs the model not to reveal system internals", () => {
    const { system } = buildSystemPrompt(baseKb, "hi")
    expect(system).toMatch(/NEVER mention internal jargon/i)
    expect(system).toMatch(/knowledge base/i)
  })

  it("includes the consent text before lead capture", () => {
    const { system } = buildSystemPrompt(baseKb, "hi")
    expect(system).toContain("By chatting, you agree to our privacy policy.")
  })

  it("uses the brand voice (avoid/prefer phrases) from extended KB when present", () => {
    const kb: KnowledgeBundle = {
      ...baseKb,
      extendedKb: {
        ...emptyKnowledgeBase(),
        brand_voice: {
          tone: "luxury",
          customTone: "",
          greeting: "Welcome to Glow. How may I help you today?",
          avoidPhrases: ["cheap", "discount"],
          preferPhrases: ["investment", "tailored"],
        },
        source: "fresh",
      },
    }
    const { system } = buildSystemPrompt(kb, "hi")
    expect(system).toMatch(/Tone preset: luxury/i)
    expect(system).toContain("Welcome to Glow. How may I help you today?")
    expect(system).toMatch(/AVOID these phrases/i)
    expect(system).toContain("cheap")
    expect(system).toContain("discount")
    expect(system).toMatch(/PREFER these phrases/i)
    expect(system).toContain("investment")
  })

  it("uses the booking policy from extended KB", () => {
    const kb: KnowledgeBundle = {
      ...baseKb,
      extendedKb: {
        ...emptyKnowledgeBase(),
        booking_policy: {
          consultationMode: "calendar_link",
          calendarLink: "https://cal.com/glow",
          deposit: {
            required: true,
            amount: 50,
            currency: "USD",
            refundable: true,
            notes: "Applied to first treatment",
          },
          cancellation: {
            noticeHours: 24,
            feePolicy: "$25 fee for late cancellations",
            notes: "",
          },
        },
        source: "fresh",
      },
    }
    const { system } = buildSystemPrompt(kb, "hi")
    expect(system).toMatch(/Consultation mode: Calendar link/i)
    expect(system).toContain("https://cal.com/glow")
    expect(system).toMatch(/Deposit required: USD 50/i)
    expect(system).toMatch(/Cancellation notice: 24 hours/i)
  })

  it("uses the custom pricing + medical disclaimers from extended KB", () => {
    const kb: KnowledgeBundle = {
      ...baseKb,
      extendedKb: {
        ...emptyKnowledgeBase(),
        disclaimers: {
          standardAccepted: true,
          pricing: "GLORP custom pricing copy",
          medical: "GLORP custom medical copy",
          consent: "GLORP custom consent",
        },
        source: "fresh",
      },
    }
    const { system } = buildSystemPrompt(kb, "hi")
    expect(system).toContain("GLORP custom pricing copy")
    // Medical disclaimer is no longer embedded in the prompt — owners
    // opted out of the first-reply disclaimer banner.
    expect(system).not.toContain("GLORP custom medical copy")
    expect(system).toContain("GLORP custom consent")
  })

  it("uses business context (name, website, addresses) from extended KB", () => {
    const kb: KnowledgeBundle = {
      ...baseKb,
      extendedKb: {
        ...emptyKnowledgeBase(),
        business: {
          name: { value: "Glow On Fillmore", status: "captured" },
          website: "https://glow.example.com",
          addresses: [
            {
              line1: "1234 Fillmore St",
              line2: "Suite 200",
              city: "San Francisco",
              region: "CA",
              postal: "94115",
              country: "USA",
            },
          ],
          afterHoursPolicy: "We capture leads and follow up at 9am PT the next business day.",
        },
        source: "fresh",
      },
    }
    const { system } = buildSystemPrompt(kb, "hi")
    expect(system).toContain("Glow On Fillmore")
    expect(system).toContain("https://glow.example.com")
    expect(system).toContain("1234 Fillmore St, Suite 200, San Francisco, CA, 94115, USA")
    expect(system).toMatch(/After-hours policy: We capture leads/i)
  })

  it("includes a Human voice guide with contractions, natural reactions, and explicit anti-chatbot rules", () => {
    const { system } = buildSystemPrompt(baseKb, "hi")
    expect(system).toMatch(/HUMAN VOICE GUIDE/i)
    expect(system).toMatch(/Use contractions/i)
    expect(system).toMatch(/Vary your sentence length/i)
    expect(system).toMatch(/Match the visitor's energy/i)
    expect(system).toMatch(/React before you answer/i)
    expect(system).toMatch(/DON'T/i)
    expect(system).toMatch(/Sure!/i)
    expect(system).toMatch(/Of course!/i)
    expect(system).toMatch(/Absolutely!/i)
    expect(system).toMatch(/Great question!/i)
    expect(system).toMatch(/I'd be happy to help!/i)
    expect(system).toMatch(/Thank you for your inquiry!/i)
    expect(system).toMatch(/echo the question back/i)
    expect(system).toMatch(/Plain paragraphs/i)
    expect(system).toMatch(/I apologize/i)
  })

  it("includes a specific real-receptionist example for the price question (no robotic phrasing)", () => {
    const { system } = buildSystemPrompt(baseKb, "hi")
    expect(system).toMatch(/Visitor: "How much is Botox\?"/)
    expect(system).toMatch(/It runs per unit/)
  })

  it("includes a real example for an out-of-scope service that recommends the closest in-scope service", () => {
    const { system } = buildSystemPrompt(baseKb, "hi")
    expect(system).toMatch(/CoolSculpting/)
    expect(system).toMatch(/we don't have CoolSculpting on our menu/i)
  })

  it("includes a real example for an emotional/fear-based visitor message", () => {
    const { system } = buildSystemPrompt(baseKb, "hi")
    expect(system).toMatch(/I'm scared of needles/i)
    expect(system).toMatch(/Totally fair/i)
  })

  it("includes an after-hours worked example that uses natural language", () => {
    const { system } = buildSystemPrompt(baseKb, "hi")
    expect(system).toMatch(/Visitor \(after hours\): "Is anyone there\?"/)
    expect(system).toMatch(/We're off-hours right now/i)
  })

  it("includes a worked example for an off-topic / medical-advice request that refuses politely and redirects to services", () => {
    const { system } = buildSystemPrompt(baseKb, "hi")
    expect(system).toMatch(/recommend a medicine for my back pain/i)
    expect(system).toMatch(/I'm not able to recommend medicines/i)
    expect(system).toMatch(/set up a consult/i)
  })

  it("describes all five tone presets in human terms", () => {
    const { system } = buildSystemPrompt(baseKb, "hi")
    expect(system).toMatch(/"warm"/i)
    expect(system).toMatch(/"casual"/i)
    expect(system).toMatch(/"formal"/i)
    expect(system).toMatch(/"playful"/i)
    expect(system).toMatch(/"luxury"/i)
    expect(system).toMatch(/concierge desk/i)
    expect(system).toMatch(/texting a knowledgeable friend/i)
    expect(system).toMatch(/tasteful — this is a medical setting/i)
  })

  it("banned corporate filler words are explicitly called out as forbidden", () => {
    const { system } = buildSystemPrompt(baseKb, "hi")
    expect(system).toMatch(/Certainly/)
    expect(system).toMatch(/Moreover/)
    expect(system).toMatch(/Furthermore/)
    expect(system).toMatch(/It is worth noting that/)
    expect(system).toMatch(/Please do not hesitate/i)
  })

  it("the deflection to 'how do you work' no longer leaks AI jargon", () => {
    const { system } = buildSystemPrompt(baseKb, "hi")
    expect(system).toMatch(/I work with .* team/i)
    expect(system).toMatch(/they keep me updated on every treatment/i)
  })
})

describe("working hours", () => {
  const hours = {
    enabled: true,
    tz: "UTC",
    schedule: [
      { day: "Mon", open: true, from: "09:00", to: "17:00" },
      { day: "Sun", open: false, from: "09:00", to: "17:00" },
    ],
  }

  it("returns true when disabled (no business-hours logic)", () => {
    expect(isAfterHours({ ...hours, enabled: false })).toBe(false)
  })

  it("returns true outside business hours", () => {
    const tuesday = new Date(2024, 5, 4, 3, 0, 0)
    expect(isAfterHours(hours, tuesday)).toBe(true)
  })

  it("returns false inside business hours", () => {
    const monday = new Date(2024, 5, 3, 12, 0, 0)
    expect(isAfterHours(hours, monday)).toBe(false)
  })

  it("returns true on closed day", () => {
    const sunday = new Date(2024, 5, 2, 12, 0, 0)
    expect(isAfterHours(hours, sunday)).toBe(true)
  })
})

describe("language directive integration", () => {
  it("appends a non-empty directive for non-English languages", () => {
    expect(buildLanguageDirective("en")).toBe("")
    const es = buildLanguageDirective("es")
    expect(es.length).toBeGreaterThan(0)
    expect(es).toMatch(/Spanish|Español/i)
  })

  it("is supported by the isSupportedLanguage guard", () => {
    expect(isSupportedLanguage("es")).toBe(true)
    expect(isSupportedLanguage("xx")).toBe(false)
  })
})

describe("kb-aware fallback (no LLM available)", () => {
  it("refuses medical-advice requests with a grounded, on-brand message", () => {
    const reply = kbAwareFallback(
      "can you recommend a medicine for belly pain",
      baseKb,
    )
    expect(reply).not.toMatch(/happy to help/i)
    expect(reply).toMatch(/not able to recommend medicines/i)
    expect(reply).toMatch(/Glow Med Spa/)
    // Should still mention a real service from the KB so the visitor has a next step.
    expect(reply.toLowerCase()).toContain("botox")
  })

  it("refuses 'what should I take for…' questions politely", () => {
    const reply = kbAwareFallback("what should i take for headache", baseKb)
    expect(reply).toMatch(/not able to recommend medicines/i)
  })

  it("flags obvious off-topic trivia as off-topic", () => {
    expect(isOffTopicMessage("what's the capital of France")).toBe(true)
    expect(isOffTopicMessage("recommend me a painkiller")).toBe(true)
    expect(isOffTopicMessage("Do you offer Botox?")).toBe(false)
    expect(isOffTopicMessage("How much is a facial?")).toBe(false)
  })

  it("answers FAQ-style questions verbatim from the KB", () => {
    const reply = kbAwareFallback("how do I book a consultation", baseKb)
    expect(reply).toContain("Our team will confirm")
    expect(reply).toMatch(/1 business hour/i)
  })

  it("recommends a KB service when the visitor names it", () => {
    const reply = kbAwareFallback("Do you do HydraFacial?", baseKb)
    expect(reply).toMatch(/HydraFacial/i)
  })

  it("falls back to the first active service when nothing matches", () => {
    const reply = kbAwareFallback(
      "I have a question about something vague",
      baseKb,
    )
    expect(reply.toLowerCase()).toContain("botox")
    expect(reply).toMatch(/what's on your mind|happy to help/i)
  })

  it("handles booking intent with the lead-capture prompt or KB FAQ", () => {
    const reply = kbAwareFallback("can I book an appointment tomorrow?", baseKb)
    // Either the KB FAQ ("how do I book") matched, or the generic booking
    // prompt. Both are acceptable; the contract is that the reply points
    // the visitor at the lead-capture flow.
    expect(
      /share your name, phone.*treatment/i.test(reply) ||
        /share your name, phone, email.*preferred time/i.test(reply),
    ).toBe(true)
  })

  it("handles pricing intent with the provider-deferral line", () => {
    const reply = kbAwareFallback("how much does it cost?", baseKb)
    expect(reply).toMatch(/licensed provider confirms/i)
  })
})
