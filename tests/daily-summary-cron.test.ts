import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("@/lib/notifications/daily-summary", () => ({
  runDailySummary: vi.fn(),
}))

vi.mock("@/lib/audit", () => ({
  recordAudit: vi.fn(),
}))

import { GET } from "@/app/api/cron/daily-summary/route"
import { runDailySummary } from "@/lib/notifications/daily-summary"

const mockRun = runDailySummary as unknown as ReturnType<typeof vi.fn>

describe("daily-summary cron route auth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRun.mockResolvedValue({
      recipients: 0,
      sent: 0,
      failed: 0,
      skipped: 1,
      metrics: null,
    })
  })

  const setEnv = (key: string, value: string | undefined) => {
    const env = process.env as Record<string, string | undefined>
    if (value === undefined) delete env[key]
    else env[key] = value
  }

  it("rejects requests when CRON_SECRET is set and bearer does not match", async () => {
    setEnv("CRON_SECRET", "topsecret")
    setEnv("NODE_ENV", "production")
    const req = new Request("http://localhost/api/cron/daily-summary", {
      headers: { authorization: "Bearer wrong" },
    })
    const res = await GET(req as never)
    expect(res.status).toBe(401)
    expect(mockRun).not.toHaveBeenCalled()
  })

  it("accepts requests with the correct bearer", async () => {
    setEnv("CRON_SECRET", "topsecret")
    setEnv("NODE_ENV", "production")
    mockRun.mockResolvedValueOnce({
      recipients: 1,
      sent: 1,
      failed: 0,
      skipped: 0,
      metrics: { totalLeads: 0, newLeads: 0, contacted: 0, booked: 0, conversations: 0, afterHours: 0, topService: null },
    })
    const req = new Request("http://localhost/api/cron/daily-summary", {
      headers: { authorization: "Bearer topsecret" },
    })
    const res = await GET(req as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.recipients).toBe(1)
  })

  it("accepts a matching query token", async () => {
    setEnv("CRON_SECRET", "topsecret")
    setEnv("NODE_ENV", "production")
    const req = new Request("http://localhost/api/cron/daily-summary?token=topsecret")
    const res = await GET(req as never)
    expect(res.status).toBe(200)
  })

  it("rejects mismatched query token", async () => {
    setEnv("CRON_SECRET", "topsecret")
    setEnv("NODE_ENV", "production")
    const req = new Request("http://localhost/api/cron/daily-summary?token=nope")
    const res = await GET(req as never)
    expect(res.status).toBe(401)
  })

  it("allows requests in development without a CRON_SECRET", async () => {
    setEnv("CRON_SECRET", undefined)
    setEnv("NODE_ENV", "development")
    const req = new Request("http://localhost/api/cron/daily-summary")
    const res = await GET(req as never)
    expect(res.status).toBe(200)
  })

  it("rejects in production when no CRON_SECRET is configured", async () => {
    setEnv("CRON_SECRET", undefined)
    setEnv("NODE_ENV", "production")
    const req = new Request("http://localhost/api/cron/daily-summary")
    const res = await GET(req as never)
    expect(res.status).toBe(401)
  })
})



