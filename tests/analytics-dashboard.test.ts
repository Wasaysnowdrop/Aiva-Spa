import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import {
  calculateAnalyticsTrend,
  isEligibleAnalyticsSession,
  summarizeAnalyticsRows,
} from "@/lib/analytics/server"

const analyticsSource = readFileSync(join(process.cwd(), "src/lib/analytics/server.ts"), "utf8")
const dashboardSource = readFileSync(join(process.cwd(), "src/components/dashboard/analytics-dashboard.tsx"), "utf8")
const routeErrorSource = readFileSync(join(process.cwd(), "app/dashboard/analytics/error.tsx"), "utf8")

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    lead_id: "lead-1",
    lead_captured: true,
    source_url: "https://search.example/landing",
    created_at: "2026-07-18T10:00:00.000Z",
    transcript: [
      { role: "visitor", content: "I want Botox", timestamp: "2026-07-18T10:00:00.000Z" },
      { role: "ai", content: "I can help", timestamp: "2026-07-18T10:00:02.000Z" },
    ],
    ...overrides,
  }
}

describe("analytics calculations", () => {
  it("returns intentional null metrics when no analytics data exists", () => {
    expect(summarizeAnalyticsRows([], [], [])).toEqual({
      visitorConversations: 0,
      qualifiedLeads: 0,
      bookedLeads: 0,
      visitorToLeadRate: null,
      leadToBookingRate: null,
      averageResponseSeconds: null,
      notificationDeliveryRate: null,
    })
    expect(dashboardSource).toContain("No visitor conversation data for this period.")
    expect(dashboardSource).toContain("Service performance appears after leads select a treatment.")
  })

  it("derives real KPIs, response time, and email-only delivery rate", () => {
    const summary = summarizeAnalyticsRows(
      [session(), session({ id: "session-2", lead_id: null, lead_captured: false })],
      [{ id: "lead-1", status: "booked", service: "Botox", source_url: "https://search.example", created_at: "2026-07-18T10:00:00.000Z" }],
      [{ status: "delivered", sent_at: "2026-07-18T10:01:00.000Z" }, { status: "failed", sent_at: "2026-07-18T10:02:00.000Z" }],
    )
    expect(summary).toMatchObject({ visitorConversations: 2, qualifiedLeads: 1, bookedLeads: 1, visitorToLeadRate: 50, leadToBookingRate: 100, averageResponseSeconds: 2, notificationDeliveryRate: 50 })
    expect(isEligibleAnalyticsSession(session())).toBe(true)
    expect(isEligibleAnalyticsSession(session({ transcript: [] }))).toBe(false)
  })

  it("uses canonical production visitor filters and excludes onboarding/test/deleted rows", () => {
    expect(analyticsSource).toContain('.eq("conversation_type", "visitor")')
    expect(analyticsSource).toContain('.eq("channel", "website_widget")')
    expect(analyticsSource).toContain('.eq("environment", "production")')
    expect(analyticsSource).toContain('.eq("is_billable", true)')
    expect(analyticsSource).toContain('.is("deleted_at", null)')
    expect(analyticsSource).toContain('.eq("channel", "Email")')
  })

  it("does not invent a trend when the previous period is zero", () => {
    expect(calculateAnalyticsTrend(8, 0)).toEqual({ value: null, direction: "neutral", label: "No previous-period data" })
  })

  it("keeps the laptop layout responsive without gradients or a full-page empty state", () => {
    expect(dashboardSource).toContain("xl:grid-cols-12")
    expect(dashboardSource).toContain("min-w-0")
    expect(dashboardSource).toContain("overflow-x-auto")
    expect(dashboardSource).not.toMatch(/gradient/i)
    expect(dashboardSource).toContain("Open Install Guide")
    expect(dashboardSource).toContain('"use client"')
    expect(dashboardSource).toContain("h-56")
  })

  it("keeps route and data retries wired to real recovery actions", () => {
    expect(dashboardSource).toContain("router.refresh()")
    expect(dashboardSource).toContain("onClick={retry}")
    expect(routeErrorSource).toContain("onClick={() => reset()}")
    expect(routeErrorSource).toContain("ANALYTICS_ROUTE_ERROR")
  })
})
