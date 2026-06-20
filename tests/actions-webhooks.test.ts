import { beforeEach, describe, expect, it, vi } from "vitest"

import { installSupabaseMocks } from "./helpers/mock-supabase"

beforeEach(() => {
  vi.resetModules()
})

const baseHook = {
  id: "wh_1",
  user_id: "u_1",
  url: "https://example.com/h",
  secret: "whsec_test",
  events: ["lead.created"],
  active: true,
  description: "Test hook",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
}

describe("createWebhookAction", () => {
  it("rejects a localhost URL", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })

    const form = new FormData()
    form.set("url", "http://localhost:3000/hook")
    form.append("events", "lead.created")

    const { createWebhookAction } = await import("@/app/actions/webhooks")
    const result = await createWebhookAction(form)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/valid public/i)
    }
  })

  it("rejects when no events are selected", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })

    const form = new FormData()
    form.set("url", "https://example.com/h")

    const { createWebhookAction } = await import("@/app/actions/webhooks")
    const result = await createWebhookAction(form)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/at least one event/i)
    }
  })

  it("inserts the webhook with a generated secret", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    server.setResult("webhooks", "insert", {
      data: [{ id: "wh_new" }],
      error: null,
    })
    server.setResult("audit_logs", "insert", { data: null, error: null })

    const form = new FormData()
    form.set("url", "https://example.com/h")
    form.set("description", "Production hook")
    form.append("events", "lead.created")
    form.append("events", "lead.updated")

    const { createWebhookAction } = await import("@/app/actions/webhooks")
    const result = await createWebhookAction(form)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.webhookId).toBe("wh_new")
    }

    const inserts = server
      .getCalls()
      .filter((c) => c.table === "webhooks" && c.op === "insert")
    expect(inserts.length).toBe(1)
    const payload = inserts[0].args[0] as {
      url: string
      events: string[]
      secret: string
      active: boolean
    }
    expect(payload.url).toBe("https://example.com/h")
    expect(payload.events).toEqual(["lead.created", "lead.updated"])
    expect(payload.secret).toMatch(/^whsec_[a-f0-9]{48}$/)
    expect(payload.active).toBe(true)
  })
})

describe("toggleWebhookAction", () => {
  it("toggles active and updates the row", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    server.setResult("webhooks", "update", { data: null, error: null })

    const { toggleWebhookAction } = await import("@/app/actions/webhooks")
    const result = await toggleWebhookAction("wh_1", false)
    expect(result.ok).toBe(true)
    const update = server
      .getCalls()
      .find((c) => c.table === "webhooks" && c.op === "update")
    expect(update).toBeDefined()
    const payload = update!.args[0] as { active: boolean }
    expect(payload.active).toBe(false)
  })
})

describe("deleteWebhookAction", () => {
  it("deletes the webhook by id", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    server.setResult("webhooks", "delete", { data: null, error: null })

    const { deleteWebhookAction } = await import("@/app/actions/webhooks")
    const result = await deleteWebhookAction("wh_1")
    expect(result.ok).toBe(true)
    const del = server
      .getCalls()
      .find((c) => c.table === "webhooks" && c.op === "delete")
    expect(del).toBeDefined()
  })
})

describe("testWebhookAction", () => {
  it("returns ok=true on a 2xx response and logs the delivery", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    server.setResult("webhooks", "select", { data: [baseHook], error: null })
    server.setResult("webhooks", "select", { data: [baseHook], error: null })
    server.setResult("webhook_deliveries", "insert", { data: null, error: null })

    const realFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response("ok", { status: 200 })) as unknown as typeof fetch
    try {
      const { testWebhookAction } = await import("@/app/actions/webhooks")
      const result = await testWebhookAction("wh_1")
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.status).toBe(200)
        expect(typeof result.durationMs).toBe("number")
      }
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it("returns ok=false on a 4xx response and logs the failure", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    server.setResult("webhooks", "select", { data: [baseHook], error: null })
    server.setResult("webhook_deliveries", "insert", { data: null, error: null })

    const realFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response("nope", { status: 404 })) as unknown as typeof fetch
    try {
      const { testWebhookAction } = await import("@/app/actions/webhooks")
      const result = await testWebhookAction("wh_1")
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBe(404)
        expect(result.error).toMatch(/404/)
      }
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it("returns ok=false when the webhook does not exist", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    server.setResult("webhooks", "select", { data: [], error: null })

    const { testWebhookAction } = await import("@/app/actions/webhooks")
    const result = await testWebhookAction("wh_404")
    expect(result.ok).toBe(false)
  })
})

describe("rotateWebhookSecretAction", () => {
  it("issues a new whsec_ secret", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    server.setResult("webhooks", "update", { data: null, error: null })

    const { rotateWebhookSecretAction } = await import("@/app/actions/webhooks")
    const result = await rotateWebhookSecretAction("wh_1")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.secret).toMatch(/^whsec_[a-f0-9]{48}$/)
    }
    const update = server
      .getCalls()
      .find((c) => c.table === "webhooks" && c.op === "update")
    const payload = update!.args[0] as { secret: string }
    expect(payload.secret).toMatch(/^whsec_/)
  })
})
