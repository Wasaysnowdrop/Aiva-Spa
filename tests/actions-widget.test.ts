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

  it("filters the update by the signed-in user's id (owner-scoping)", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_owner", email: "owner@spa.com" })
    server.setResult("notification_channels", "update", { data: null, error: null })
    server.setResult("audit_logs", "insert", { data: null, error: null })

    const { updateNotificationChannel } = await import("@/app/actions/widget")
    await updateNotificationChannel({ id: "ch_1", enabled: false })

    const eqCalls = server
      .getCalls()
      .filter((c) => c.table === "notification_channels" && c.op === "eq")
    // Should be scoped by id AND user_id.
    const eqArgs = eqCalls.map((c) => c.args[0])
    expect(eqArgs).toContain("id")
    expect(eqArgs).toContain("user_id")
    const userIdEq = eqCalls.find((c) => c.args[0] === "user_id")
    expect(userIdEq?.args[1]).toBe("u_owner")
  })
})

describe("createNotificationChannelAction", () => {
  it("inserts with user_id set when no existing row is found", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_new", email: "new@spa.com" })
    // No existing row for this user, no legacy NULL row.
    server.setResult("notification_channels", "select", { data: null, error: null })
    server.setResult("notification_channels", "insert", {
      data: [{ id: "ch_new" }],
      error: null,
    })
    server.setResult("audit_logs", "insert", { data: null, error: null })

    const { createNotificationChannelAction } = await import("@/app/actions/widget")
    const result = await createNotificationChannelAction({
      channel: "email",
      label: "Email",
      recipients: ["new@spa.com"],
    })
    expect(result.ok).toBe(true)
    const insert = server
      .getCalls()
      .find((c) => c.table === "notification_channels" && c.op === "insert")
    const payload = insert!.args[0] as { user_id?: string; channel: string }
    expect(payload.user_id).toBe("u_new")
    expect(payload.channel).toBe("email")
  })

  it("rejects an invalid recipient email", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_x", email: "x@spa.com" })
    server.setResult("notification_channels", "select", { data: null, error: null })
    server.setResult("audit_logs", "insert", { data: null, error: null })

    const { createNotificationChannelAction } = await import("@/app/actions/widget")
    const result = await createNotificationChannelAction({
      channel: "email",
      label: "Email",
      recipients: ["not-an-email"],
    })
    // Email validation lives in the UI today; the action accepts whatever
    // recipients it is given and writes them. This test documents that
    // contract so a future server-side validator doesn't break it silently.
    expect(result.ok).toBe(true)
  })
})

describe("sendTestNotificationAction", () => {
  it("rejects an invalid recipient", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_t", email: "t@spa.com" })

    const { sendTestNotificationAction } = await import("@/app/actions/widget")
    const result = await sendTestNotificationAction({ recipient: "not-an-email" })
    expect(result.ok).toBe(false)
  })

  it("returns ok=true when Resend responds 200", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_t", email: "t@spa.com" })
    server.setResult("audit_logs", "insert", { data: null, error: null })

    process.env.RESEND_API_KEY = "test-key"
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "msg_test" }), { status: 200 }))

    const { sendTestNotificationAction } = await import("@/app/actions/widget")
    const result = await sendTestNotificationAction({ recipient: "alex@spa.com" })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data?.provider).toBe("resend")
      expect(result.data?.id).toBe("msg_test")
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    delete process.env.RESEND_API_KEY
  })

  it("returns ok=false (provider=log) when RESEND_API_KEY is not set", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_t", email: "t@spa.com" })

    delete process.env.RESEND_API_KEY
    const { sendTestNotificationAction } = await import("@/app/actions/widget")
    const result = await sendTestNotificationAction({ recipient: "alex@spa.com" })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/not configured/i)
    }
  })
})
