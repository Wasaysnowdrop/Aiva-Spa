import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { installSupabaseMocks } from "./helpers/mock-supabase"
import { emptyKnowledgeBase } from "@/lib/ai/setup-assistant-schema"

const RPC = "publish_onboarding_knowledge_base"

function onboardingUser(id = "user-onboarding-1") {
  return {
    id,
    email: "owner@example.com",
    user_metadata: { spa_name: "Old Spa", onboarding_kb_draft: { version: 1 } },
  }
}

function configuredDraft() {
  const draft = emptyKnowledgeBase()
  draft.business = { ...draft.business!, name: "Glow Spa", website: "https://glow.example" }
  draft.services = [{
    name: "Botox",
    category: "Injectables",
    description: "Wrinkle relaxing consultation",
    duration: "30 minutes",
  }]
  draft.faqs = [{ question: "How do I book?", answer: "Request a consultation.", category: "Booking" }]
  draft.brand_voice = { ...draft.brand_voice!, avoidPhrases: ["guaranteed"] }
  return draft
}

describe("onboarding knowledge-base persistence", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("publishes all owner data and completion metadata in one RPC transaction", async () => {
    const { server, admin } = installSupabaseMocks()
    const user = onboardingUser()
    server.setAuthUser(user)
    admin.setResult(RPC, "rpc", {
      data: { services: 1, faqs: 1, guardrails: 3, widgetUpdated: true, settingsUpdated: true },
      error: null,
    })

    const { finalizeSetupAssistant } = await import("@/app/actions/setup-assistant")
    const result = await finalizeSetupAssistant(configuredDraft())

    expect(result).toEqual({
      ok: true,
      inserted: { services: 1, faqs: 1, guardrails: 3, widgetUpdated: true, settingsUpdated: true },
    })
    const call = admin.callsFor(RPC, "rpc")[0]
    const payload = call?.args[0] as Record<string, unknown>
    expect(payload).toMatchObject({
      p_user_id: user.id,
      p_services: [{ name: "Botox", category: "Injectables" }],
      p_faqs: [{ question: "How do I book?", category: "Booking" }],
      p_user_metadata: {
        onboarding_completed: true,
        onboarding_kb: { services: [{ name: "Botox", category: "Injectables" }] },
      },
    })
    expect((payload.p_user_metadata as Record<string, unknown>).onboarding_kb_draft).toBeUndefined()
    expect(admin.callsFor("knowledge_services")).toEqual([])
    expect(admin.callsFor("auth", "updateUserById")).toEqual([])
  })

  it("returns a safe error and performs no fallback writes when the transaction fails", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser(onboardingUser("user-onboarding-2"))
    admin.setResult(RPC, "rpc", {
      data: null,
      error: { message: "insert failed midway: internal detail" },
    })

    const { finalizeSetupAssistant } = await import("@/app/actions/setup-assistant")
    const result = await finalizeSetupAssistant(configuredDraft())

    expect(result).toEqual({
      ok: false,
      errorType: "DATABASE_ERROR",
      stage: "publish_rpc",
      code: undefined,
      table: RPC,
      failedService: undefined,
      originalCategory: undefined,
      normalizedCategory: undefined,
      error: "We couldn't publish your knowledge base. Nothing was changed. Please try again.",
    })
    expect(result.error).not.toContain("insert failed")
    expect(admin.callsFor(RPC, "rpc")).toHaveLength(1)
    expect(admin.getCalls().filter((call) => call.op === "insert" || call.op === "delete")).toEqual([])
  })

  it("returns the exact RPC stage and code in development", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser(onboardingUser("user-onboarding-debug"))
    admin.setResult(RPC, "rpc", {
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find the function public.publish_onboarding_knowledge_base",
        details: "Searched for the function in the schema cache",
        hint: "Apply the publish migration",
      },
    })

    const { finalizeSetupAssistant } = await import("@/app/actions/setup-assistant")
    const result = await finalizeSetupAssistant(configuredDraft())

    expect(result).toMatchObject({
      ok: false,
      errorType: "DATABASE_ERROR",
      stage: "publish_rpc",
      code: "PGRST202",
      table: RPC,
      error: "Could not find the function public.publish_onboarding_knowledge_base",
      details: "Searched for the function in the schema cache",
      hint: "Apply the publish migration",
    })
  })
  it("does not expose a Postgres category constraint error", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser(onboardingUser("user-onboarding-3"))
    admin.setResult(RPC, "rpc", {
      data: null,
      error: { message: 'new row violates check constraint "knowledge_services_category_check"' },
    })

    const { finalizeSetupAssistant } = await import("@/app/actions/setup-assistant")
    const result = await finalizeSetupAssistant(configuredDraft())

    expect(result.errorType).toBe("INVALID_SERVICE_CATEGORY")
    expect(result.error).toBe(
      "We couldn't publish one or more services because their categories were not recognised. The issue has been logged. Please try again.",
    )
    expect(result.error).not.toContain("knowledge_services_category_check")
  })

  it("deduplicates normalized service names and remains retry-safe", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser(onboardingUser("user-onboarding-4"))
    admin.setResult(RPC, "rpc", {
      data: { services: 1, faqs: 0, guardrails: 2, widgetUpdated: true, settingsUpdated: true },
      error: null,
    })
    const draft = configuredDraft()
    draft.services.push({
      name: "  botox  ",
      category: "Injectables",
      description: "Duplicate spelling",
      duration: "",
    })

    const { finalizeSetupAssistant } = await import("@/app/actions/setup-assistant")
    const first = await finalizeSetupAssistant(draft)
    const second = await finalizeSetupAssistant(draft)

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(admin.callsFor(RPC, "rpc")).toHaveLength(2)
    for (const call of admin.callsFor(RPC, "rpc")) {
      const services = (call.args[0] as { p_services: Array<{ name: string }> }).p_services
      expect(services).toHaveLength(1)
      expect(services[0]?.name).toBe("Botox")
    }
  })
  it("publishes every current Glow Aesthetics service with a valid category", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser(onboardingUser("user-onboarding-glow"))
    admin.setResult(RPC, "rpc", {
      data: { services: 10, faqs: 0, guardrails: 2, widgetUpdated: true, settingsUpdated: true },
      error: null,
    })
    const draft = {
      ...configuredDraft(),
      services: [
        { name: "Botox Cosmetic", category: "Botox", description: "Details" },
        { name: "Dermal Fillers", category: "fillers", description: "Details" },
        { name: "HydraFacial treatments", category: "Facial Treatments", description: "Details" },
        { name: "Microneedling", category: "Skin Care", description: "Details" },
        { name: "Chemical Peels", category: "chemical_peels", description: "Details" },
        { name: "Laser Hair Removal", category: null, description: "Details" },
        { name: "PRP Facials", category: "facial", description: "Details" },
        { name: "Skin Rejuvenation", category: "Skin", description: "Details" },
        { name: "Acne Treatments", category: "Aesthetic", description: "Details" },
        { name: "Professional Aesthetic Consultations", category: "Consultation", description: "Details" },
      ],
    }

    const { finalizeSetupAssistant } = await import("@/app/actions/setup-assistant")
    const result = await finalizeSetupAssistant(draft)

    expect(result.ok).toBe(true)
    const payload = admin.callsFor(RPC, "rpc")[0]?.args[0] as {
      p_services: Array<{ name: string; category: string }>
    }
    expect(payload.p_services).toHaveLength(10)
    expect(payload.p_services.map(({ name, category }) => [name, category])).toEqual([
      ["Botox Cosmetic", "Injectables"],
      ["Dermal Fillers", "Injectables"],
      ["HydraFacial treatments", "Facials"],
      ["Microneedling", "Skin Rejuvenation"],
      ["Chemical Peels", "Skin Rejuvenation"],
      ["Laser Hair Removal", "Laser Treatments"],
      ["PRP Facials", "Facials"],
      ["Skin Rejuvenation", "Skin Rejuvenation"],
      ["Acne Treatments", "Skin Rejuvenation"],
      ["Professional Aesthetic Consultations", "Other"],
    ])
  })
})
