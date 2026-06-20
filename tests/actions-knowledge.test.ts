import { beforeEach, describe, expect, it, vi } from "vitest"

import { installSupabaseMocks } from "./helpers/mock-supabase"

beforeEach(() => {
  vi.resetModules()
})

describe("createServiceAction", () => {
  it("rejects an unknown service category", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    const { createServiceAction } = await import("@/app/actions/knowledge")
    const result = await createServiceAction({
      name: "Botox",
      category: "Bogus" as never,
      description: "Neuromodulator",
      pricingRule: "",
      duration: "",
      active: true,
    })
    expect(result.ok).toBe(false)
  })

  it("creates a service and writes an audit log entry", async () => {
    const { server, browser } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
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
