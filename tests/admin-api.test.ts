import { beforeEach, describe, expect, it, vi } from "vitest"

import { installSupabaseMocks } from "./helpers/mock-supabase"

vi.mock("@/lib/admin/queries", () => ({
  getSystemHealth: vi.fn(async () => ({
    status: "ok",
    database: "ok",
    realtime: "ok",
    llm: "ok",
    uptimeSeconds: 0,
    openaiConfigured: true,
    resendConfigured: true,
    customCalendarConfigured: true,
    totals: {
      users: 5,
      leads: 12,
      chatSessions: 9,
      webhooks: 3,
      subscriptions: 4,
    },
    trends: {
      leads: [1, 2, 3],
      activeVisitors: [0, 0, 1, 2],
      llmLatencyMs: [0, 1, 1, 0],
      tokenUsage: [10, 20, 30],
      errorRate: [0, 0, 0, 1.5],
    },
    lastUpdated: new Date().toISOString(),
  })),
}))

beforeEach(() => {
  vi.resetModules()
})

describe("GET /api/admin/system-health", () => {
  it("returns 401 for unauthenticated requests", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser(null)
    const { GET } = await import("@/app/api/admin/system-health/route")
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns 403 for non-admin users", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "user@x.com" })
    const { GET } = await import("@/app/api/admin/system-health/route")
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it("returns 200 + health JSON for admins", async () => {
    process.env.ADMIN_ALLOWED_EMAILS = "admin@x.com"
    const { server } = installSupabaseMocks()
    server.setAuthUser({
      id: "u_admin",
      email: "admin@x.com",
      app_metadata: { is_admin: true },
    })
    const { GET } = await import("@/app/api/admin/system-health/route")
    const res = await GET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string; totals: { leads: number } }
    expect(body.status).toBe("ok")
    expect(body.totals.leads).toBe(12)
  })
})
