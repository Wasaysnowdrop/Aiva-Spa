import { beforeEach, describe, expect, it, vi } from "vitest"

import { faqInputHash, parseFaqInput, validateFaqInput } from "@/lib/ai/faq-input"
import { isComplianceResultStale } from "@/lib/ai/onboarding-compliance"
import {
  emptyKnowledgeBase,
  getNextIncompleteOnboardingField,
  syncOnboardingProgress,
} from "@/lib/ai/setup-assistant-schema"
import { runSetupAssistantTurn } from "@/lib/ai/setup-assistant"
import { installSupabaseMocks } from "./helpers/mock-supabase"

const acceptanceAnswer = `Question: Do you offer free consultations?
Answer: Yes, we offer an initial consultation to discuss your goals, suitable treatment options, expected results, possible risks, and estimated pricing. Final treatment recommendations and costs are confirmed by our team during the consultation.`

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
})

describe("FAQ deterministic parsing", () => {
  it("accepts the exact acceptance answer", () => {
    const result = validateFaqInput(acceptanceAnswer)
    expect(result.valid).toBe(true)
    expect(result.faqs).toEqual([{
      question: "Do you offer free consultations?",
      answer: expect.stringContaining("estimated pricing"),
      category: "General",
    }])
  })

  it.each([
    ["Q/A labels", "Q: Do you offer consultations?\nA: Yes, contact our team to arrange one."],
    ["pipe delimiter", "Do you offer consultations? | Yes, contact our team to arrange one."],
    ["question then answer", "Do you offer consultations?\nYes, contact our team to arrange one."],
    ["FAQ prefix", "FAQ: Do you offer consultations? Yes, contact our team to arrange one."],
  ])("accepts %s", (_label, input) => {
    expect(parseFaqInput(input)).toHaveLength(1)
    expect(validateFaqInput(input).valid).toBe(true)
  })

  it("accepts multiple numbered, bulleted, semicolon, and JSON FAQ pairs", () => {
    const numbered = `1. Question: Do you offer consultations?
Answer: Yes, contact our team.

2. Question: How do I book?
Answer: Send your preferred time.`
    const bulleted = `- Do you offer consultations?
Yes, contact our team.
- How do I book?
Send your preferred time.`
    const semicolon = "Do you offer consultations? Yes, contact our team.; How do I book? Send your preferred time."
    const json = JSON.stringify([
      { question: "Do you offer consultations?", answer: "Yes, contact our team." },
      { q: "How do I book?", a: "Send your preferred time." },
    ])
    expect(parseFaqInput(numbered)).toHaveLength(2)
    expect(parseFaqInput(bulleted)).toHaveLength(2)
    expect(parseFaqInput(semicolon)).toHaveLength(2)
    expect(parseFaqInput(json)).toHaveLength(2)
  })

  it.each(["yes", "no", "ok", "okay", "skip", "none", "idk", "not sure", "..."])(
    "rejects meaningless FAQ input: %s",
    (input) => expect(validateFaqInput(input).valid).toBe(false),
  )
})

describe("FAQ compliance request scoping", () => {
  it("ignores an old response after the user moves to FAQs", () => {
    const oldInputHash = faqInputHash("We require a $50 deposit.")
    expect(isComplianceResultStale(
      {
        step: "booking_policy",
        submissionId: "booking-submission",
        messageId: "booking-message",
        inputHash: oldInputHash,
      },
      {
        currentStep: "faqs",
        latestSubmissionId: "faq-submission",
        latestInputHash: faqInputHash(acceptanceAnswer),
        mounted: true,
      },
    )).toBe(true)
  })

  it("accepts only the latest mounted response for the same step and input", () => {
    const inputHash = faqInputHash(acceptanceAnswer)
    expect(isComplianceResultStale(
      {
        step: "faqs",
        submissionId: "faq-submission",
        messageId: "faq-message",
        inputHash,
      },
      {
        currentStep: "faqs",
        latestSubmissionId: "faq-submission",
        latestInputHash: inputHash,
        mounted: true,
      },
    )).toBe(false)
  })
})

describe("FAQ onboarding flow", () => {
  it("uses deterministic parsing even if AI is unavailable", async () => {
    const aiFetch = vi.fn(async () => { throw new Error("malformed AI JSON") })
    vi.stubGlobal("fetch", aiFetch)
    const result = await runSetupAssistantTurn({
      history: [],
      userMessage: acceptanceAnswer,
      currentSection: "faqs",
      draft: emptyKnowledgeBase(),
    })
    expect(aiFetch).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      action: "advance",
      nextSection: "disclaimers",
      selectionReason: "faqs_deterministic_validation_passed",
    })
    expect(result.draft.faqs).toHaveLength(1)
    expect(result.draft.status.invalidAttempts.faqs).toBe(0)
    expect(result.reply).not.toMatch(/valid faqs|attempt/i)
  })

  it("increments only genuine invalid attempts and resets after success", async () => {
    let draft = emptyKnowledgeBase()
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await runSetupAssistantTurn({
        history: [],
        userMessage: "okay",
        currentSection: "faqs",
        draft,
      })
      draft = result.draft
      expect(result.selectionReason).toBe("faqs_validation_failed")
      expect(draft.status.invalidAttempts.faqs).toBe(attempt)
      if (attempt === 3) expect(result.reply).toMatch(/Example:/)
    }
    const accepted = await runSetupAssistantTurn({
      history: [],
      userMessage: "How do I book? Send your preferred time and our team will confirm.",
      currentSection: "faqs",
      draft,
    })
    expect(accepted.draft.status.invalidAttempts.faqs).toBe(0)
    expect(accepted.completedFields).toContain("faqs")
  })

  it("does not warn on pricing language without an amount", async () => {
    const result = await runSetupAssistantTurn({
      history: [],
      userMessage: "How much does treatment cost? Pricing is estimated and confirmed during consultation.",
      currentSection: "faqs",
      draft: emptyKnowledgeBase(),
    })
    expect(result.concerns).toEqual([])
  })

  it.each(["$50", "\u00a3100", "USD 75", "200 dollars"])(
    "warns only when the current FAQ contains a specific amount: %s",
    async (amount) => {
      const result = await runSetupAssistantTurn({
        history: [],
        userMessage: `How much is treatment? Treatment costs ${amount}.`,
        currentSection: "faqs",
        draft: emptyKnowledgeBase(),
      })
      expect(result.concerns.join(" ")).toMatch(/Firm price detected/)
    },
  )

  it("does not turn a booking deposit into a stale FAQ pricing warning", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline") }))
    const booking = await runSetupAssistantTurn({
      history: [],
      userMessage: "We require a $50 deposit and 24 hours cancellation notice.",
      currentSection: "booking_policy",
      draft: emptyKnowledgeBase(),
    })
    expect(booking.concerns).toEqual([])
    const faq = await runSetupAssistantTurn({
      history: [],
      userMessage: acceptanceAnswer,
      currentSection: "faqs",
      draft: booking.draft,
    })
    expect(faq.concerns).toEqual([])
  })

  it("restores at disclaimers after a successful FAQ save", async () => {
    const result = await runSetupAssistantTurn({
      history: [],
      userMessage: acceptanceAnswer,
      currentSection: "faqs",
      draft: emptyKnowledgeBase(),
    })
    expect(getNextIncompleteOnboardingField(syncOnboardingProgress(result.draft), "faqs"))
      .toBe("disclaimers")
  })
})

describe("POST /api/onboarding/setup-assistant FAQ contract", () => {
  function request(body: Record<string, unknown>) {
    return new Request("http://localhost:3000/api/onboarding/setup-assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  it("persists a valid FAQ and advances to disclaimers", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser({ id: "faq-valid", email: "owner@example.com", user_metadata: {} })
    const { POST } = await import("@/app/api/onboarding/setup-assistant/route")
    const response = await POST(request({
      history: [],
      userMessage: acceptanceAnswer,
      currentSection: "faqs",
      draft: emptyKnowledgeBase(),
      submissionId: "faq-submit-valid-1",
    }) as never)
    const body = await response.json() as Record<string, unknown>
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ success: true, stepCompleted: true, nextStep: "disclaimers" })
    expect(body.faqs).toHaveLength(1)
    expect(admin.callsFor("auth", "updateUserById")).toHaveLength(1)
  })

  it("returns VALIDATION_ERROR for meaningless input", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "faq-invalid", user_metadata: {} })
    const { POST } = await import("@/app/api/onboarding/setup-assistant/route")
    const response = await POST(request({
      history: [], userMessage: "okay", currentSection: "faqs",
      draft: emptyKnowledgeBase(), submissionId: "faq-invalid-submit-1",
    }) as never)
    const body = await response.json() as { errorType: string; message: string; invalidAttemptCount: number }
    expect(response.status).toBe(422)
    expect(body).toMatchObject({
      errorType: "VALIDATION_ERROR",
      message: "Please provide one visitor question and its approved answer.",
      invalidAttemptCount: 1,
    })
  })

  it("distinguishes a parsing error from meaningless validation", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "faq-parse", user_metadata: {} })
    const { POST } = await import("@/app/api/onboarding/setup-assistant/route")
    const response = await POST(request({
      history: [], userMessage: "Visitors often ask about consultations", currentSection: "faqs",
      draft: emptyKnowledgeBase(), submissionId: "faq-parse-submit-1",
    }) as never)
    const body = await response.json() as { errorType: string }
    expect(response.status).toBe(422)
    expect(body.errorType).toBe("PARSING_ERROR")
  })

  it("returns SAVE_ERROR without incrementing valid FAQ attempts", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser({ id: "faq-save-error", user_metadata: {} })
    admin.setResult("auth", "updateUserById", { data: null, error: { message: "database unavailable" } })
    const { POST } = await import("@/app/api/onboarding/setup-assistant/route")
    const response = await POST(request({
      history: [], userMessage: acceptanceAnswer, currentSection: "faqs",
      draft: emptyKnowledgeBase(), submissionId: "faq-save-error-1",
    }) as never)
    const body = await response.json() as { errorType: string; message: string }
    expect(response.status).toBe(500)
    expect(body).toMatchObject({
      errorType: "SAVE_ERROR",
      message: "Your FAQ is valid, but we couldn't save it. Please try again.",
    })
  })

  it("ignores a repeated persisted FAQ submission without another write", async () => {
    const { server, admin } = installSupabaseMocks()
    const stored = emptyKnowledgeBase()
    stored.faqs = parseFaqInput(acceptanceAnswer)
    server.setAuthUser({
      id: "faq-duplicate",
      user_metadata: {
        onboarding_kb_draft: syncOnboardingProgress(stored, ["faqs"]),
        onboarding_last_submission_id: "faq-duplicate-submit-1",
      },
    })
    const { POST } = await import("@/app/api/onboarding/setup-assistant/route")
    const response = await POST(request({
      history: [], userMessage: acceptanceAnswer, currentSection: "faqs",
      submissionId: "faq-duplicate-submit-1",
    }) as never)
    const body = await response.json() as { duplicate: boolean; nextStep: string }
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ duplicate: true, nextStep: "disclaimers" })
    expect(admin.callsFor("auth", "updateUserById")).toHaveLength(0)
  })
})
