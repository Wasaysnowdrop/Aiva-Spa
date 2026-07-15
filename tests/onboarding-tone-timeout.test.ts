import { beforeEach, describe, expect, it, vi } from "vitest"

import { isComplianceResultStale } from "@/lib/ai/onboarding-compliance"
import {
  emptyKnowledgeBase,
  getNextIncompleteOnboardingField,
  syncOnboardingProgress,
} from "@/lib/ai/setup-assistant-schema"
import { runSetupAssistantTurn } from "@/lib/ai/setup-assistant"
import {
  parseToneInput,
  toneInputHash,
  validateToneInput,
} from "@/lib/ai/tone-input"
import { installSupabaseMocks } from "./helpers/mock-supabase"

const acceptanceTone = "Use a warm, professional, calm, and reassuring tone. Keep responses clear and concise, avoid medical claims, never pressure visitors, and politely guide them toward booking a consultation when appropriate."

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
})

describe("Brand Voice deterministic parsing", () => {
  it("accepts and preserves the exact acceptance input", () => {
    expect(validateToneInput(acceptanceTone).valid).toBe(true)
    expect(parseToneInput(acceptanceTone)).toMatchObject({
      tone: "warm",
      customTone: acceptanceTone,
      avoidPhrases: expect.arrayContaining(["medical claims", "pressure tactics"]),
    })
  })

  it.each(["", "ok", "yes", "...", "no"])("rejects meaningless tone input: %s", (input) => {
    expect(validateToneInput(input).valid).toBe(false)
  })
})

describe("Brand Voice timeout-safe onboarding flow", () => {
  it("advances without calling AI when the provider times out", async () => {
    const aiFetch = vi.fn(async () => { throw new DOMException("timed out", "AbortError") })
    vi.stubGlobal("fetch", aiFetch)
    const result = await runSetupAssistantTurn({
      history: [],
      userMessage: acceptanceTone,
      currentSection: "brand_voice",
      draft: emptyKnowledgeBase(),
      submissionId: "tone-timeout-1",
      messageId: "tone-message-1",
    })
    expect(aiFetch).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      action: "advance",
      nextSection: "notifications",
      selectionReason: "brand_voice_deterministic_fallback_completed",
      normalizationStatus: "fallback",
      fallbackApplied: true,
    })
    expect(result.draft.brand_voice?.customTone).toBe(acceptanceTone)
    expect(result.completedFields).toContain("brand_voice")
  })

  it("uses original wording when AI would return malformed JSON", async () => {
    const aiFetch = vi.fn(async () => new Response("not-json"))
    vi.stubGlobal("fetch", aiFetch)
    const result = await runSetupAssistantTurn({
      history: [], userMessage: acceptanceTone, currentSection: "brand_voice",
      draft: emptyKnowledgeBase(),
    })
    expect(aiFetch).not.toHaveBeenCalled()
    expect(result.draft.brand_voice?.customTone).toBe(acceptanceTone)
    expect(result.reply).toMatch(/original wording/i)
  })

  it("increments invalid attempts only for invalid tone input", async () => {
    const result = await runSetupAssistantTurn({
      history: [], userMessage: "okay", currentSection: "brand_voice",
      draft: emptyKnowledgeBase(),
    })
    expect(result).toMatchObject({
      action: "ask",
      selectionReason: "brand_voice_validation_failed",
      normalizationStatus: "not_applicable",
    })
    expect(result.draft.status.invalidAttempts.brand_voice).toBe(1)
  })

  it("resumes at Notifications after refresh", async () => {
    const result = await runSetupAssistantTurn({
      history: [], userMessage: acceptanceTone, currentSection: "brand_voice",
      draft: emptyKnowledgeBase(),
    })
    const restored = syncOnboardingProgress(result.draft)
    expect(getNextIncompleteOnboardingField(restored, "brand_voice")).toBe("notifications")
  })

  it("marks a late Brand Voice response stale after navigation", () => {
    const inputHash = toneInputHash(acceptanceTone)
    expect(isComplianceResultStale(
      { step: "brand_voice", submissionId: "tone-old", messageId: "message-old", inputHash },
      {
        currentStep: "notifications",
        latestSubmissionId: "notification-new",
        latestInputHash: toneInputHash("owner@example.com"),
        mounted: true,
      },
    )).toBe(true)
  })
})

describe("Setup assistant temporary AI retries", () => {
  it("retries 429 responses at most twice before succeeding", async () => {
    const previousKey = process.env.NARA_API_KEY
    process.env.NARA_API_KEY = "test-nara-key"
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(new Response("still busy", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        model: "mistral-medium-3-5",
        choices: [{
          message: {
            content: JSON.stringify({
              reply: "I saved Glow Aesthetics. What is your website?",
              section: "business",
              action: "ask",
              captured: { business: { name: "Glow Aesthetics" } },
              concerns: [],
            }),
          },
        }],
      }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    try {
      const result = await runSetupAssistantTurn({
        history: [], userMessage: "Our business is Glow Aesthetics.",
        currentSection: "business", draft: emptyKnowledgeBase(),
      })
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(result.provider).toBe("nara")
      expect(result.draft.business?.name).toBe("Glow Aesthetics")
    } finally {
      if (previousKey === undefined) delete process.env.NARA_API_KEY
      else process.env.NARA_API_KEY = previousKey
      vi.unstubAllGlobals()
    }
  })
})

describe("POST /api/onboarding/setup-assistant Brand Voice contract", () => {
  function request(body: Record<string, unknown>) {
    return new Request("http://localhost:3000/api/onboarding/setup-assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  it("persists the tone once and advances to Notifications", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser({ id: "tone-valid", email: "owner@example.com", user_metadata: {} })
    const { POST } = await import("@/app/api/onboarding/setup-assistant/route")
    const response = await POST(request({
      history: [], userMessage: acceptanceTone, currentSection: "brand_voice",
      draft: emptyKnowledgeBase(), submissionId: "tone-submit-valid-1", messageId: "tone-message-valid-1",
    }) as never)
    const body = await response.json() as Record<string, unknown>
    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      success: true, saved: true, stepCompleted: true, nextStep: "notifications",
      normalizationStatus: "fallback", fallbackApplied: true,
    })
    const calls = admin.callsFor("auth", "updateUserById")
    expect(calls).toHaveLength(1)
    const update = calls[0]?.args[1] as { user_metadata: Record<string, unknown> }
    expect(update.user_metadata).toMatchObject({
      onboarding_last_submission_id: "tone-submit-valid-1",
      onboarding_last_submission_step: "brand_voice",
      onboarding_last_input_hash: toneInputHash(acceptanceTone),
      onboarding_last_message_id: "tone-message-valid-1",
    })
  })

  it("returns SAVE_ERROR and does not claim the tone was saved", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser({ id: "tone-save-error", user_metadata: {} })
    admin.setResult("auth", "updateUserById", {
      data: null, error: { message: "database unavailable" },
    })
    const { POST } = await import("@/app/api/onboarding/setup-assistant/route")
    const response = await POST(request({
      history: [], userMessage: acceptanceTone, currentSection: "brand_voice",
      draft: emptyKnowledgeBase(), submissionId: "tone-save-error-1",
    }) as never)
    const body = await response.json() as Record<string, unknown>
    expect(response.status).toBe(500)
    expect(body).toMatchObject({
      success: false, saved: false, errorType: "SAVE_ERROR",
      message: "We couldn't save your tone preference. Please try again.",
    })
  })

  it("deduplicates the same step and input hash with a new submission ID", async () => {
    const { server, admin } = installSupabaseMocks()
    const stored = emptyKnowledgeBase()
    stored.brand_voice = parseToneInput(acceptanceTone)!
    server.setAuthUser({
      id: "tone-hash-duplicate",
      user_metadata: {
        onboarding_kb_draft: syncOnboardingProgress(stored, ["brand_voice"]),
        onboarding_last_submission_id: "tone-original",
        onboarding_last_submission_step: "brand_voice",
        onboarding_last_input_hash: toneInputHash(acceptanceTone),
      },
    })
    const { POST } = await import("@/app/api/onboarding/setup-assistant/route")
    const response = await POST(request({
      history: [], userMessage: acceptanceTone, currentSection: "brand_voice",
      submissionId: "tone-retry-with-new-id",
    }) as never)
    const body = await response.json() as Record<string, unknown>
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ duplicate: true, nextStep: "notifications" })
    expect(admin.callsFor("auth", "updateUserById")).toHaveLength(0)
  })

  it("deduplicates a repeated submission ID without another write", async () => {
    const { server, admin } = installSupabaseMocks()
    const stored = emptyKnowledgeBase()
    stored.brand_voice = parseToneInput(acceptanceTone)!
    server.setAuthUser({
      id: "tone-id-duplicate",
      user_metadata: {
        onboarding_kb_draft: syncOnboardingProgress(stored, ["brand_voice"]),
        onboarding_last_submission_id: "tone-same-id",
      },
    })
    const { POST } = await import("@/app/api/onboarding/setup-assistant/route")
    const response = await POST(request({
      history: [], userMessage: acceptanceTone, currentSection: "brand_voice",
      submissionId: "tone-same-id",
    }) as never)
    const body = await response.json() as Record<string, unknown>
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ duplicate: true, nextStep: "notifications" })
    expect(admin.callsFor("auth", "updateUserById")).toHaveLength(0)
  })
})
