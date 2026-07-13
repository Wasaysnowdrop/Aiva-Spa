import { beforeEach, describe, expect, it, vi } from "vitest"

import { installSupabaseMocks } from "./helpers/mock-supabase"
import { emptyKnowledgeBase } from "@/lib/ai/setup-assistant-schema"

describe("onboarding knowledge-base persistence", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("replaces and owner-scopes services, FAQs, and generated guardrails", async () => {
    const { server, admin } = installSupabaseMocks()
    const user = {
      id: "user-onboarding-1",
      email: "owner@example.com",
      user_metadata: { spa_name: "Old Spa" },
    }
    server.setAuthUser(user)
    admin.setAuthUser(user)

    admin.setResult("widget_config", "select", { data: { id: "widget-1" }, error: null })
    admin.setResult("widget_config", "update", { data: null, error: null })
    admin.setResult("spa_settings", "select", { data: { id: "settings-1" }, error: null })
    admin.setResult("spa_settings", "update", { data: null, error: null })
    admin.setResult("knowledge_services", "delete", { data: null, error: null })
    admin.setResult("knowledge_faqs", "delete", { data: null, error: null })
    admin.setResult("knowledge_guardrails", "delete", { data: null, error: null })
    admin.setResult("knowledge_services", "insert", { data: [{ id: "svc-1" }], error: null })
    admin.setResult("knowledge_faqs", "insert", { data: [{ id: "faq-1" }], error: null })
    admin.setResult("knowledge_guardrails", "insert", {
      data: [{ id: "grd-1" }, { id: "grd-2" }, { id: "grd-3" }],
      error: null,
    })

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

    const { finalizeSetupAssistant } = await import("@/app/actions/setup-assistant")
    const result = await finalizeSetupAssistant(draft)

    expect(result).toMatchObject({
      ok: true,
      inserted: { services: 1, faqs: 1, guardrails: 3, widgetUpdated: true },
    })

    const serviceRows = admin.callsFor("knowledge_services", "insert")[0]?.args[0] as Record<string, unknown>[]
    const faqRows = admin.callsFor("knowledge_faqs", "insert")[0]?.args[0] as Record<string, unknown>[]
    const guardrailRows = admin.callsFor("knowledge_guardrails", "insert")[0]?.args[0] as Record<string, unknown>[]
    expect(serviceRows[0]).toMatchObject({ user_id: user.id, name: "Botox" })
    expect(faqRows[0]).toMatchObject({ user_id: user.id, question: "How do I book?" })
    expect(guardrailRows).toHaveLength(3)
    expect(guardrailRows.every((row) => row.user_id === user.id)).toBe(true)
    expect(guardrailRows.map((row) => row.rule_type)).toEqual(["pricing", "medical", "general"])

    const widgetPayload = admin.callsFor("widget_config", "update")[0]?.args[0] as Record<string, unknown>
    expect(widgetPayload.extended_kb).toMatchObject({
      business: { name: "Glow Spa", website: "https://glow.example" },
      services: [{ name: "Botox" }],
      faqs: [{ question: "How do I book?" }],
    })
    const authUpdate = admin.callsFor("auth", "updateUserById")[0]
    expect(authUpdate?.args[0]).toBe(user.id)
    expect(authUpdate?.args[1]).toMatchObject({
      user_metadata: {
        onboarding_completed: true,
        onboarding_kb: { services: [{ name: "Botox" }] },
      },
    })

    for (const table of ["knowledge_services", "knowledge_faqs", "knowledge_guardrails"]) {
      expect(admin.callsFor(table, "eq")).toContainEqual({ table, op: "eq", args: ["user_id", user.id] })
    }
  })

  it("does not report onboarding complete when a KB write fails", async () => {
    const { server, admin } = installSupabaseMocks()
    const user = { id: "user-onboarding-2", email: "owner@example.com", user_metadata: {} }
    server.setAuthUser(user)
    admin.setAuthUser(user)
    admin.setResult("widget_config", "select", { data: { id: "widget-1" }, error: null })
    admin.setResult("widget_config", "update", { data: null, error: null })
    admin.setResult("spa_settings", "select", { data: { id: "settings-1" }, error: null })
    admin.setResult("spa_settings", "update", { data: null, error: null })
    admin.setResult("knowledge_services", "delete", { data: null, error: null })
    admin.setResult("knowledge_faqs", "delete", { data: null, error: null })
    admin.setResult("knowledge_guardrails", "delete", { data: null, error: null })
    admin.setResult("knowledge_services", "insert", { data: null, error: { message: "write failed" } })
    admin.setResult("knowledge_guardrails", "insert", { data: [{ id: "grd-1" }, { id: "grd-2" }], error: null })

    const draft = emptyKnowledgeBase()
    draft.services = [{ name: "Botox", category: "Injectables", description: "Consultation", duration: "" }]

    const { finalizeSetupAssistant } = await import("@/app/actions/setup-assistant")
    const result = await finalizeSetupAssistant(draft)

    expect(result.ok).toBe(false)
    expect(result.error).toContain("knowledge_services")
    expect(admin.callsFor("auth")).toEqual([])
  })
})