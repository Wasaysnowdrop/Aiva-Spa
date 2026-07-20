import { beforeEach, describe, expect, it, vi } from "vitest"

import { installSupabaseMocks } from "./helpers/mock-supabase"

vi.mock("@/lib/admin/control-centre", () => ({
  getPlatformHealth: vi.fn(async () => [{
    key: "database",
    service: "Supabase database",
    status: "operational",
    latencyMs: 12,
    lastCheckedAt: new Date().toISOString(),
    message: "Database query succeeded",
  }]),
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
    const body = (await res.json()) as { status: string; services: { key: string }[] }
    expect(body.status).toBe("operational")
    expect(body.services[0]?.key).toBe("database")
  })
})
