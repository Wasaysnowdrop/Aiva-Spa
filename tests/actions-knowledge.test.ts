import { beforeEach, describe, expect, it, vi } from "vitest"

import { installSupabaseMocks } from "./helpers/mock-supabase"

beforeEach(() => {
  vi.resetModules()
})

describe("createServiceAction", () => {
  it("accepts a custom service category like 'Facials'", async () => {
    const { server, browser, admin } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    admin.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    browser.setResult("knowledge_services", "insert", {
      data: [
        {
          id: "svc_facials_1",
          name: "HydraFacial",
          category: "Facials",
          description: "Multi-step facial",
          pricing_rule: "",
          duration: "60 min",
          active: true,
          user_id: "u_1",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      error: null,
    })
    browser.setResult("audit_logs", "insert", { data: null, error: null })

    const { createServiceAction } = await import("@/app/actions/knowledge")
    const result = await createServiceAction({
      name: "HydraFacial",
      category: "Facials",
      description: "Multi-step facial",
      pricingRule: "",
      duration: "60 min",
      active: true,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.id).toBe("svc_facials_1")
    }

    // Confirm the insert payload included the current user's id so RLS
    // (migration 00022_kb_user_scoping.sql) does not reject the write.
    const adminCalls = admin.callsFor("knowledge_services", "insert")
    expect(adminCalls.length).toBeGreaterThan(0)
    const inserted = adminCalls[0]?.args[0] as Record<string, unknown>
    expect(inserted.user_id).toBe("u_1")
    expect(inserted.category).toBe("Facials")
  })

  it("creates a service and writes an audit log entry", async () => {
    const { server, browser, admin } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    admin.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    browser.setResult("knowledge_services", "insert", {
      data: [
        {
          id: "svc_1",
          name: "Botox",
          category: "Injectables",
          description: "x",
          pricing_rule: "",
          duration: "",
          active: true,
          user_id: "u_1",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      error: null,
    })
    browser.setResult("audit_logs", "insert", { data: null, error: null })

    const { createServiceAction } = await import("@/app/actions/knowledge")
    const result = await createServiceAction({
      name: "Botox",
      category: "Injectables",
      description: "Neuromodulator",
      pricingRule: "",
      duration: "",
      active: true,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.id).toBe("svc_1")
    }
  })

  it("surfaces a clear error when the Supabase insert fails", async () => {
    const { server, browser } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    browser.setResult("knowledge_services", "insert", {
      data: null,
      error: { message: "duplicate key value violates unique constraint" },
    })

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { createServiceAction } = await import("@/app/actions/knowledge")
    const result = await createServiceAction({
      name: "Botox",
      category: "Injectables",
      description: "",
      pricingRule: "",
      duration: "",
      active: true,
    })
    expect(result.ok).toBe(false)
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})

describe("createFaqAction", () => {
  it("rejects an unknown faq category", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    const { createFaqAction } = await import("@/app/actions/knowledge")
    const result = await createFaqAction({
      question: "Q?",
      answer: "A.",
      category: "Bogus" as never,
    })
    expect(result.ok).toBe(false)
  })

  it("rejects when the question is empty", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    const { createFaqAction } = await import("@/app/actions/knowledge")
    const result = await createFaqAction({
      question: "",
      answer: "A.",
      category: "General",
    })
    expect(result.ok).toBe(false)
  })
})

describe("updateConsentTextAction", () => {
  it("rejects empty consent text", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    const { updateConsentTextAction } = await import("@/app/actions/knowledge")
    const result = await updateConsentTextAction({ consentText: "" })
    expect(result.ok).toBe(false)
  })

  it("updates widget_config.consent_text and revalidates", async () => {
    const { server, browser } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    // getWidgetConfig() reads via the server client
    server.setResult("widget_config", "select", {
      data: [
        {
          id: "w1",
          brand_name: "Glow",
          consent_text: "old",
          working_hours: { enabled: false, tz: "UTC", schedule: [] },
          welcome_message: "Hi",
          proactive_message: "x",
          primary_color: "#E2E54B",
          position: "bottom-right",
          proactive_enabled: true,
          proactive_delay_seconds: 8,
          show_branding: true,
          collect_email: true,
          collect_phone: true,
          logo_initial: "G",
          extended_kb: {},
        },
      ],
      error: null,
    })
    // updateWidgetConfig() also via the server client; .update().select().single() returns the updated row
    server.setResult("widget_config", "update", {
      data: [
        {
          id: "w1",
          brand_name: "Glow",
          consent_text: "By chatting, you agree…",
          working_hours: { enabled: false, tz: "UTC", schedule: [] },
          welcome_message: "Hi",
          proactive_message: "x",
          primary_color: "#E2E54B",
          position: "bottom-right",
          proactive_enabled: true,
          proactive_delay_seconds: 8,
          show_branding: true,
          collect_email: true,
          collect_phone: true,
          logo_initial: "G",
          extended_kb: {},
        },
      ],
      error: null,
    })
    browser.setResult("audit_logs", "insert", { data: null, error: null })

    const { updateConsentTextAction } = await import("@/app/actions/knowledge")
    const result = await updateConsentTextAction({
      consentText: "By chatting, you agree…",
    })
    expect(result.ok).toBe(true)
  })
})

describe("createGuardrailAction", () => {
  it("inserts a guardrail with rule_type, description, and is_active", async () => {
    const { server, admin, browser } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    admin.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    admin.setResult("knowledge_guardrails", "insert", {
      data: [
        {
          id: "g_med_1",
          user_id: "u_1",
          title: "No medical diagnosis",
          body: "AI must not diagnose medical conditions.",
          description: "AI must not diagnose medical conditions.",
          rule_type: "medical",
          enabled: true,
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      error: null,
    })
    browser.setResult("audit_logs", "insert", { data: null, error: null })

    const { createGuardrailAction } = await import("@/app/actions/knowledge")
    const result = await createGuardrailAction({
      title: "No medical diagnosis",
      body: "AI must not diagnose medical conditions.",
      description: "AI must not diagnose medical conditions.",
      ruleType: "medical",
      enabled: true,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.id).toBe("g_med_1")

    const insertCalls = admin.callsFor("knowledge_guardrails", "insert")
    expect(insertCalls.length).toBeGreaterThan(0)
    const inserted = insertCalls[0]?.args[0] as Record<string, unknown>
    expect(inserted.user_id).toBe("u_1")
    expect(inserted.rule_type).toBe("medical")
    expect(inserted.description).toBe(
      "AI must not diagnose medical conditions.",
    )
    expect(inserted.body).toBe("AI must not diagnose medical conditions.")
    expect(inserted.is_active).toBe(true)
    expect(inserted.enabled).toBe(true)
  })

  it("defaults rule_type to general when missing", async () => {
    const { server, admin, browser } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    admin.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    admin.setResult("knowledge_guardrails", "insert", {
      data: [
        {
          id: "g_default",
          user_id: "u_1",
          title: "Generic rule",
          body: "Be helpful.",
          description: "Be helpful.",
          rule_type: "general",
          enabled: true,
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      error: null,
    })
    browser.setResult("audit_logs", "insert", { data: null, error: null })

    const { createGuardrailAction } = await import("@/app/actions/knowledge")
    const result = await createGuardrailAction({
      title: "Generic rule",
      body: "Be helpful.",
      enabled: true,
    })
    expect(result.ok).toBe(true)
    const inserted = admin.callsFor("knowledge_guardrails", "insert")[0]
      ?.args[0] as Record<string, unknown>
    expect(inserted.rule_type).toBe("general")
  })

  it("rejects an unknown rule_type", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    const { createGuardrailAction } = await import("@/app/actions/knowledge")
    const result = await createGuardrailAction({
      title: "X",
      body: "Y",
      ruleType: "bogus_type" as never,
      enabled: true,
    })
    expect(result.ok).toBe(false)
  })

  it("rejects empty title", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    const { createGuardrailAction } = await import("@/app/actions/knowledge")
    const result = await createGuardrailAction({ title: "", body: "x", enabled: true })
    expect(result.ok).toBe(false)
  })
})

describe("updateGuardrailBodyAction", () => {
  it("updates a guardrail and writes an audit log", async () => {
    const { server, admin, browser } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    admin.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    admin.setResult("knowledge_guardrails", "update", {
      data: [
        {
          id: "g_1",
          user_id: "u_1",
          title: "Emergency warning",
          body: "If user mentions trouble breathing…",
          description: "If user mentions trouble breathing…",
          rule_type: "emergency",
          enabled: true,
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      error: null,
    })
    browser.setResult("audit_logs", "insert", { data: null, error: null })

    const { updateGuardrailBodyAction } = await import("@/app/actions/knowledge")
    const result = await updateGuardrailBodyAction("g_1", {
      title: "Emergency warning",
      body: "If user mentions trouble breathing…",
      ruleType: "emergency",
      enabled: true,
    })
    expect(result.ok).toBe(true)
  })
})

describe("deleteGuardrailAction", () => {
  it("requires an authenticated user", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser(null)
    const { deleteGuardrailAction } = await import("@/app/actions/knowledge")
    const result = await deleteGuardrailAction("g_1")
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/authenticated/i)
  })
})

describe("GUARDRAIL_RULE_TYPES", () => {
  it("exposes all seven rule types required by the editor", async () => {
    const { GUARDRAIL_RULE_TYPES, GUARDRAIL_RULE_TYPE_LABELS } = await import(
      "@/lib/supabase/types"
    )
    expect(GUARDRAIL_RULE_TYPES).toEqual([
      "safety",
      "pricing",
      "medical",
      "booking",
      "out_of_scope",
      "emergency",
      "general",
    ])
    expect(GUARDRAIL_RULE_TYPE_LABELS.emergency).toBe("Emergency")
    expect(GUARDRAIL_RULE_TYPE_LABELS.medical).toBe("Medical")
  })
})
