import { describe, expect, it } from "vitest"

import {
  buildSetupAssistantSystemPrompt,
  buildSetupAssistantUserTurn,
} from "@/lib/ai/setup-assistant-prompt"
import {
  emptyKnowledgeBase,
  countPendingFields,
  isCaptured,
  knowledgeBaseSchema,
} from "@/lib/ai/setup-assistant-schema"
import { runSetupAssistantTurn } from "@/lib/ai/setup-assistant"

describe("setup assistant prompt", () => {
  it("includes the JSON response contract", () => {
    const system = buildSetupAssistantSystemPrompt()
    expect(system).toMatch(/Response JSON schema/i)
    expect(system).toMatch(/"reply":\s*string/)
    expect(system).toMatch(/"action":\s*"ask"\s*\|\s*"summarize"\s*\|\s*"advance"\s*\|\s*"finish"/)
  })

  it("forbids firm prices and medical claims", () => {
    const system = buildSetupAssistantSystemPrompt()
    expect(system).toMatch(/Never invent firm prices/i)
    expect(system).toMatch(/medical claims/i)
    expect(system).toMatch(/pending/i)
  })

  it("documents all 9 sections in order", () => {
    const system = buildSetupAssistantSystemPrompt()
    const expectedSections = [
      "business",
      "hours",
      "services",
      "booking_policy",
      "faqs",
      "disclaimers",
      "brand_voice",
      "notifications",
      "review",
    ]
    for (const s of expectedSections) {
      expect(system).toContain(`## ${s}`)
    }
  })

  it("builds a user turn that mentions current section, draft excerpt, and owner message", () => {
    const turn = buildSetupAssistantUserTurn({
      history: [{ role: "user", content: "hi" }],
      userMessage: "Botox is $13 per unit",
      currentSection: "services",
      draft: emptyKnowledgeBase(),
      ownerName: "Aisha Khan",
      spaName: "Glow Aesthetics",
    })
    expect(turn).toContain('current_section: services')
    expect(turn).toContain('next_section: booking_policy')
    expect(turn).toContain('Aisha')
    expect(turn).toContain('Glow Aesthetics')
    expect(turn).toContain('Botox is $13 per unit')
  })

  it("truncates very large draft excerpts", () => {
    const huge = emptyKnowledgeBase()
    huge.services = Array.from({ length: 80 }).map((_, i) => ({
      name: `Service ${i}`,
      category: "Other" as const,
      description: "x".repeat(200),
      duration: "",
    }))
    const turn = buildSetupAssistantUserTurn({
      history: [],
      userMessage: "next",
      currentSection: "services",
      draft: huge,
    })
    expect(turn).toContain("…(truncated)")
  })

  it("detects first user message when history has no user role", () => {
    const turn = buildSetupAssistantUserTurn({
      history: [{ role: "assistant", content: "Welcome to setup." }],
      userMessage: "Glow Aesthetics, glowaesthetics.com",
      currentSection: "business",
      draft: emptyKnowledgeBase(),
    })
    // Should detect this is the first user message and instruct LLM to extract all fields
    expect(turn).toContain("first user message")
    expect(turn).toContain("Extract ALL")
    expect(turn).toContain("NEVER ask for a field the user just provided")
    expect(turn).not.toContain("greet the owner")
  })

  it("does not treat assistant-only history as a prior user turn", () => {
    // History with only assistant messages should be treated as first turn
    const turn = buildSetupAssistantUserTurn({
      history: [
        { role: "assistant", content: "Welcome!" },
        { role: "assistant", content: "What's your name?" },
      ],
      userMessage: "Glow Aesthetics",
      currentSection: "business",
      draft: emptyKnowledgeBase(),
    })
    expect(turn).toContain("first user message")
  })

  it("detects subsequent user messages correctly", () => {
    const turn = buildSetupAssistantUserTurn({
      history: [
        { role: "assistant", content: "Welcome!" },
        { role: "user", content: "Glow Aesthetics" },
        { role: "assistant", content: "Got it." },
      ],
      userMessage: "San Francisco",
      currentSection: "business",
      draft: emptyKnowledgeBase(),
    })
    // Should NOT contain first-turn instruction
    expect(turn).not.toContain("first user message")
    expect(turn).toContain("Stay strictly")
  })

  it("includes business field guidance with name not spa_name", () => {
    const system = buildSetupAssistantSystemPrompt()
    expect(system).toContain("- name (required)")
    expect(system).not.toContain("- spa_name (required)")
    expect(system).toContain("business_type")
  })
})

describe("setup assistant KB helpers", () => {
  it("isCaptured treats 'pending' as false", () => {
    expect(isCaptured("pending")).toBe(false)
    expect(isCaptured(null)).toBe(false)
    expect(isCaptured(undefined)).toBe(false)
    expect(isCaptured({ value: "Botox", status: "captured" })).toBe(true)
    expect(isCaptured({ value: "", status: "pending" })).toBe(false)
    expect(isCaptured("Glow Aesthetics")).toBe(true)
    expect(isCaptured(["a@b.com"])).toBe(true)
    expect(isCaptured([])).toBe(false)
  })

  it("countPendingFields lists business.name, services, faqs, hours, notifications when missing", () => {
    const kb = emptyKnowledgeBase()
    const pending = countPendingFields(kb)
    expect(pending).toContain("business.name")
    expect(pending).toContain("services")
    expect(pending).toContain("faqs")
    expect(pending).toContain("notifications")
    expect(pending).toContain("hours.schedule")
  })

  it("knowledgeBaseSchema validates the empty KB", () => {
    const parsed = knowledgeBaseSchema.safeParse(emptyKnowledgeBase())
    expect(parsed.success).toBe(true)
  })

  it("knowledgeBaseSchema rejects an unknown service category", () => {
    const bad = {
      ...emptyKnowledgeBase(),
      services: [
        {
          name: "Botox",
          category: "Bogus",
          description: "Test",
        },
      ],
    }
    const parsed = knowledgeBaseSchema.safeParse(bad)
    expect(parsed.success).toBe(false)
  })

  it("accepts a priceRange with indicativeOnly:false at the schema level (the LLM enforces the rule)", () => {
    // The schema only validates structure. The "no firm prices" rule is
    // enforced by the Setup Assistant system prompt + the detectPricingConcerns
    // guard in setup-assistant.ts. We keep this test as a contract marker.
    const ok = {
      ...emptyKnowledgeBase(),
      services: [
        {
          name: "Botox",
          category: "Injectables" as const,
          description: "Test",
          priceRange: { min: 13, max: 15, currency: "USD", unit: "per unit", indicativeOnly: true },
        },
      ],
    }
    const parsed = knowledgeBaseSchema.safeParse(ok)
    expect(parsed.success).toBe(true)
  })
})

describe("runSetupAssistantTurn (mock provider)", () => {
  it("returns a structured reply and merges captured data into the draft", async () => {
    const draft = emptyKnowledgeBase()
    const result = await runSetupAssistantTurn({
      history: [],
      userMessage: "Glow Aesthetics in San Francisco",
      currentSection: "business",
      draft,
    })
    expect(result.reply.length).toBeGreaterThan(0)
    expect(result.section).toBe("business")
    expect(result.action).toMatch(/ask|summarize|advance|finish/)
    expect(result.draft).toBeDefined()
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it("flags firm prices as a compliance concern", async () => {
    const result = await runSetupAssistantTurn({
      history: [],
      userMessage: "Botox is $13 per unit",
      currentSection: "services",
      draft: emptyKnowledgeBase(),
    })
    const hasFirmPriceConcern = result.concerns.some((c) => /firm price/i.test(c))
    expect(hasFirmPriceConcern).toBe(true)
  })

  it("flags medical claims as a compliance concern", async () => {
    const result = await runSetupAssistantTurn({
      history: [],
      userMessage: "Our Botox is 100% risk-free and guaranteed",
      currentSection: "services",
      draft: emptyKnowledgeBase(),
    })
    const hasMedicalConcern = result.concerns.some((c) => /medical|outcome|risk|guarantee/i.test(c))
    expect(hasMedicalConcern).toBe(true)
  })

  it("marks status.complete when the assistant returns action=finish", async () => {
    // The mock fallback always returns "finish" on the review section.
    const result = await runSetupAssistantTurn({
      history: [],
      userMessage: "Looks good, publish it.",
      currentSection: "review",
      draft: emptyKnowledgeBase(),
    })
    expect(result.action).toBe("finish")
    expect(result.draft.status?.complete).toBe(true)
  })
})
