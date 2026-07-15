import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  normalizeServicesInput,
  parseServicesInput,
  validateServicesInput,
} from "@/lib/ai/services-input"
import {
  emptyKnowledgeBase,
  getNextIncompleteOnboardingField,
  syncOnboardingProgress,
} from "@/lib/ai/setup-assistant-schema"
import { runSetupAssistantTurn } from "@/lib/ai/setup-assistant"
import { installSupabaseMocks } from "./helpers/mock-supabase"

const acceptanceAnswer =
  "We offer Botox Cosmetic, Dermal Fillers, HydraFacial treatments, Microneedling, Chemical Peels, Laser Hair Removal, PRP Facials, Skin Rejuvenation, Acne Treatments, and Professional Aesthetic Consultations."

beforeEach(() => {
  vi.resetModules()
})

describe("services input normalization and parsing", () => {
  it("accepts comma-separated service names", () => {
    expect(validateServicesInput("Botox, Dermal Fillers, HydraFacial").valid).toBe(true)
    expect(parseServicesInput("Botox, Dermal Fillers, HydraFacial").map((service) => service.name)).toEqual([
      "Botox",
      "Dermal Fillers",
      "HydraFacial",
    ])
  })

  it("removes natural-language prefixes and safely splits a confident conjunction", () => {
    expect(parseServicesInput("We offer Botox Cosmetic and Laser Hair Removal.").map((service) => service.name)).toEqual([
      "Botox Cosmetic",
      "Laser Hair Removal",
    ])
    expect(normalizeServicesInput("  We offer  Botox\n\n  Fillers  ")).toBe("We offer Botox\nFillers")
  })

  it("captures semicolon descriptions without requiring them", () => {
    expect(parseServicesInput("Botox - wrinkle reduction; Dermal Fillers - facial volume restoration")).toMatchObject([
      { name: "Botox", description: "wrinkle reduction" },
      { name: "Dermal Fillers", description: "facial volume restoration" },
    ])
  })

  it("keeps an ambiguous conjunction together", () => {
    expect(parseServicesInput("Body and Facial Contouring")).toMatchObject([
      { name: "Body and Facial Contouring" },
    ])
  })

  it.each(["okay", "yes", "none", "I don't know", "...", "  "])(
    "rejects meaningless services input: %s",
    (answer) => expect(validateServicesInput(answer).valid).toBe(false),
  )

  it("accepts and parses the exact acceptance answer", () => {
    const names = parseServicesInput(acceptanceAnswer).map((service) => service.name)
    expect(names).toEqual([
      "Botox Cosmetic",
      "Dermal Fillers",
      "HydraFacial treatments",
      "Microneedling",
      "Chemical Peels",
      "Laser Hair Removal",
      "PRP Facials",
      "Skin Rejuvenation",
      "Acne Treatments",
      "Professional Aesthetic Consultations",
    ])
  })
})

describe("services onboarding turn", () => {
  it("uses deterministic parsing even when AI would return malformed output", async () => {
    const aiFetch = vi.fn(async () => { throw new Error("malformed AI JSON") })
    vi.stubGlobal("fetch", aiFetch)
    const result = await runSetupAssistantTurn({
      history: [{ role: "assistant", content: "What services do you offer?" }],
      userMessage: acceptanceAnswer,
      currentSection: "services",
      draft: emptyKnowledgeBase(),
    })

    expect(aiFetch).not.toHaveBeenCalled()
    expect(result.action).toBe("advance")
    expect(result.nextSection).toBe("booking_policy")
    expect(result.draft.services).toHaveLength(10)
    expect(result.draft.status.invalidAttempts.services).toBe(0)
    expect(result.reply).not.toMatch(/valid services|attempt/i)
    vi.unstubAllGlobals()
  })

  it("increments only genuine invalid attempts, caps the help copy, and resets on success", async () => {
    let draft = emptyKnowledgeBase()
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await runSetupAssistantTurn({
        history: [],
        userMessage: "okay",
        currentSection: "services",
        draft,
      })
      draft = result.draft
      expect(result.selectionReason).toBe("services_validation_failed")
      expect(draft.status.invalidAttempts.services).toBe(attempt)
      if (attempt === 3) expect(result.reply).toMatch(/Botox.*Dermal Fillers.*HydraFacial/i)
    }

    const accepted = await runSetupAssistantTurn({
      history: [],
      userMessage: "Botox and Laser Hair Removal",
      currentSection: "services",
      draft,
    })
    expect(accepted.draft.status.invalidAttempts.services).toBe(0)
    expect(accepted.completedFields).toContain("services")
  })

  it("restores at the next incomplete step after a successful save", async () => {
    const result = await runSetupAssistantTurn({
      history: [],
      userMessage: "Botox, Dermal Fillers, HydraFacial",
      currentSection: "services",
      draft: emptyKnowledgeBase(),
    })
    const restored = syncOnboardingProgress(result.draft)
    expect(getNextIncompleteOnboardingField(restored, "services")).toBe("booking_policy")
  })
})

describe("POST /api/onboarding/setup-assistant services contract", () => {
  function request(body: Record<string, unknown>) {
    return new Request("http://localhost:3000/api/onboarding/setup-assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  it("persists valid services once and returns the explicit next-step contract", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser({ id: "user-services", email: "owner@example.com", user_metadata: {} })
    const { POST } = await import("@/app/api/onboarding/setup-assistant/route")
    const response = await POST(request({
      history: [],
      userMessage: acceptanceAnswer,
      currentSection: "services",
      draft: emptyKnowledgeBase(),
      submissionId: "services-submit-1",
    }) as never)
    const body = await response.json() as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ success: true, stepCompleted: true, nextStep: "booking_policy" })
    expect(body.services).toHaveLength(10)
    expect(admin.callsFor("auth", "updateUserById")).toHaveLength(1)
    const update = admin.callsFor("auth", "updateUserById")[0].args[1] as { user_metadata: Record<string, unknown> }
    expect(update.user_metadata).toMatchObject({
      onboarding_setup_section: "booking_policy",
      onboarding_last_submission_id: "services-submit-1",
    })
  })

  it("returns VALIDATION_ERROR and increments attempts once for meaningless input", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser({ id: "user-invalid", user_metadata: {} })
    const { POST } = await import("@/app/api/onboarding/setup-assistant/route")
    const response = await POST(request({
      history: [], userMessage: "okay", currentSection: "services",
      draft: emptyKnowledgeBase(), submissionId: "services-invalid-1",
    }) as never)
    const body = await response.json() as { errorType: string; invalidAttemptCount: number }
    expect(response.status).toBe(422)
    expect(body).toMatchObject({ errorType: "VALIDATION_ERROR", invalidAttemptCount: 1 })
    expect(admin.callsFor("auth", "updateUserById")).toHaveLength(1)
  })

  it("returns SAVE_ERROR without treating valid services as invalid", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser({ id: "user-save-error", user_metadata: {} })
    admin.setResult("auth", "updateUserById", { data: null, error: { message: "database unavailable" } })
    const { POST } = await import("@/app/api/onboarding/setup-assistant/route")
    const response = await POST(request({
      history: [], userMessage: "Botox and Laser Hair Removal", currentSection: "services",
      draft: emptyKnowledgeBase(), submissionId: "services-save-error-1",
    }) as never)
    const body = await response.json() as { errorType: string; message: string }
    expect(response.status).toBe(500)
    expect(body.errorType).toBe("SAVE_ERROR")
    expect(body.message).toMatch(/valid.*couldn't save/i)
  })

  it("ignores a repeated persisted submission without another write", async () => {
    const { server, admin } = installSupabaseMocks()
    const stored = emptyKnowledgeBase()
    stored.services = parseServicesInput("Botox")
    server.setAuthUser({
      id: "user-duplicate",
      user_metadata: {
        onboarding_kb_draft: syncOnboardingProgress(stored, ["services"]),
        onboarding_last_submission_id: "services-duplicate-1",
      },
    })
    const { POST } = await import("@/app/api/onboarding/setup-assistant/route")
    const response = await POST(request({
      history: [], userMessage: "Botox", currentSection: "services",
      submissionId: "services-duplicate-1",
    }) as never)
    const body = await response.json() as { duplicate: boolean; nextStep: string }
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ duplicate: true, nextStep: "booking_policy" })
    expect(admin.callsFor("auth", "updateUserById")).toHaveLength(0)
  })
})
