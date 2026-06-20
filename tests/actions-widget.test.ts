import { beforeEach, describe, expect, it, vi } from "vitest"

import { installSupabaseMocks } from "./helpers/mock-supabase"

beforeEach(() => {
  vi.resetModules()
})

const widgetRow = {
  id: "w1",
  brand_name: "Glow Med Spa",
  welcome_message: "Hi",
  proactive_message: "Proactive",
  consent_text: "By chatting…",
  primary_color: "#E2E54B",
  position: "bottom-right",
  proactive_enabled: true,
  proactive_delay_seconds: 8,
  show_branding: true,
  collect_email: true,
  collect_phone: true,
  logo_initial: "G",
  working_hours: { enabled: false, tz: "UTC", schedule: [] },
  extended_kb: {},
}

describe("updateWidgetBranding", () => {
  it("rejects when no widget config exists", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    server.setResult("widget_config", "select", { data: null, error: null })
    const { updateWidgetBranding } = await import("@/app/actions/widget")
    const result = await updateWidgetBranding({ brandName: "New Name" })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/no widget config/i)
    }
  })

  it("updates brandName and writes an audit log", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    server.setResult("widget_config", "select", { data: [widgetRow], error: null })
    server.setResult("widget_config", "update", { data: null, error: null })
    server.setResult("audit_logs", "insert", { data: null, error: null })

    const { updateWidgetBranding } = await import("@/app/actions/widget")
    const result = await updateWidgetBranding({
      brandName: "New Glow Med Spa",
      primaryColor: "#FF00FF",
    })
    expect(result.ok).toBe(true)
    const update = server
      .getCalls()
      .find((c) => c.table === "widget_config" && c.op === "update")
    expect(update).toBeDefined()
    const payload = update!.args[0] as {
      brand_name: string
      primary_color: string
      updated_at: string
    }
    expect(payload.brand_name).toBe("New Glow Med Spa")
    expect(payload.primary_color).toBe("#FF00FF")
    expect(typeof payload.updated_at).toBe("string")
  })
})

describe("updateNotificationChannel", () => {
  it("updates the enabled flag and recipients", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    server.setResult("notification_channels", "update", { data: null, error: null })
    server.setResult("audit_logs", "insert", { data: null, error: null })

    const { updateNotificationChannel } = await import("@/app/actions/widget")
    const result = await updateNotificationChannel({
      id: "ch_1",
      enabled: true,
      recipients: ["alex@spa.com", "priya@spa.com"],
    })
    expect(result.ok).toBe(true)
    const update = server
      .getCalls()
      .find((c) => c.table === "notification_channels" && c.op === "update")
    const payload = update!.args[0] as { enabled: boolean; recipients: string[] }
    expect(payload.enabled).toBe(true)
    expect(payload.recipients).toEqual(["alex@spa.com", "priya@spa.com"])
  })
})
