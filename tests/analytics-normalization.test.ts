import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import {
  AnalyticsPayloadSchema,
  createEmptyAnalyticsPayload,
  normalizeAnalyticsResponse,
} from "@/lib/analytics/normalize"
import { normalizeAnalyticsRange } from "@/lib/analytics/server"

const now = new Date("2026-07-19T12:00:00.000Z")

describe("analytics payload normalization", () => {
  it("accepts a full valid payload", () => {
    const payload = createEmptyAnalyticsPayload("7d", "America/New_York", now)
    payload.summary.visitorConversations = 4
    payload.timeline = [{ key: "2026-07-19", label: "Jul 19", conversations: 4, leads: 2, bookings: 1 }]

    const result = normalizeAnalyticsResponse(payload, payload)

    expect(result.success).toBe(true)
    expect(AnalyticsPayloadSchema.safeParse(result.data).success).toBe(true)
    expect(result.data.summary.visitorConversations).toBe(4)
    expect(result.data.timeline).toHaveLength(1)
  })

  it("converts null and missing arrays to safe empty arrays", () => {
    const fallback = createEmptyAnalyticsPayload("30d", "UTC", now)
    const result = normalizeAnalyticsResponse({
      range: fallback.range,
      summary: null,
      timeline: null,
      funnel: null,
      services: null,
      hours: null,
      referrers: null,
      statuses: null,
    }, fallback)

    expect(result.data.timeline).toEqual([])
    expect(result.data.services).toEqual([])
    expect(result.data.funnel).toEqual([])
    expect(result.data.hours).toEqual([])
    expect(result.data.referrers).toEqual([])
    expect(result.data.statuses).toEqual([])
  })

  it("normalizes snake_case fields and numeric strings", () => {
    const fallback = createEmptyAnalyticsPayload("30d", "UTC", now)
    const result = normalizeAnalyticsResponse({
      range: fallback.range,
      summary: {
        visitor_conversations: "12",
        qualified_leads: "3",
        booked_leads: "1",
        visitor_to_lead_rate: "25",
        lead_to_booking_rate: "33.3",
        average_response_seconds: "2",
        notification_delivery_rate: "98.5",
      },
      timeline: [{ date: "2026-07-19", conversations: "12", leads: "3", bookings: "1" }],
      referrers: [{ domain: "example.com", conversations: "12", leads: "3", conversion_rate: "25" }],
    }, fallback)

    expect(result.data.summary).toMatchObject({
      visitorConversations: 12,
      qualifiedLeads: 3,
      bookedLeads: 1,
      visitorToLeadRate: 25,
      averageResponseSeconds: 2,
    })
    expect(result.data.timeline[0]).toMatchObject({ conversations: 12, leads: 3, bookings: 1 })
    expect(result.data.referrers[0].conversionRate).toBe(25)
  })

  it("sanitizes NaN, Infinity, and NaN-like strings", () => {
    const fallback = createEmptyAnalyticsPayload("30d", "UTC", now)
    const result = normalizeAnalyticsResponse({
      range: fallback.range,
      summary: {
        visitorConversations: Number.NaN,
        qualifiedLeads: Number.POSITIVE_INFINITY,
        bookedLeads: "NaN",
        visitorToLeadRate: "Infinity",
      },
      services: [{ name: "Botox", count: Number.NaN, percentage: Number.NEGATIVE_INFINITY }],
    }, fallback)

    expect(result.data.summary.visitorConversations).toBe(0)
    expect(result.data.summary.qualifiedLeads).toBe(0)
    expect(result.data.summary.bookedLeads).toBe(0)
    expect(result.data.summary.visitorToLeadRate).toBeNull()
    expect(result.data.services[0]).toMatchObject({ count: 0, percentage: 0 })
  })

  it("serializes Date and BigInt values safely", () => {
    const fallback = createEmptyAnalyticsPayload("30d", "UTC", now)
    const result = normalizeAnalyticsResponse({
      range: { ...fallback.range, start: new Date("2026-07-01T00:00:00.000Z"), end: new Date("2026-07-19T00:00:00.000Z") },
      summary: { visitorConversations: BigInt(9), qualifiedLeads: BigInt(2) },
      funnel: [{ stage: "Visitor conversation", count: BigInt(9), percentage: BigInt(100) }],
    }, fallback)

    expect(result.data.range.start).toBe("2026-07-01T00:00:00.000Z")
    expect(result.data.summary.visitorConversations).toBe(9)
    expect(result.data.funnel[0].count).toBe(9)
  })

  it("falls back for missing timezone and reversed or invalid dates", () => {
    const fallback = createEmptyAnalyticsPayload("30d", "America/Los_Angeles", now)
    const result = normalizeAnalyticsResponse({
      range: {
        key: "30d",
        timezone: "",
        start: "not-a-date",
        end: "also-not-a-date",
        grouping: "daily",
      },
    }, fallback)
    const reversed = normalizeAnalyticsResponse({
      range: {
        ...fallback.range,
        start: "2026-08-01T00:00:00.000Z",
        end: "2026-07-01T00:00:00.000Z",
      },
    }, fallback)

    expect(result.data.range).toMatchObject({
      timezone: "America/Los_Angeles",
      start: fallback.range.start,
      end: fallback.range.end,
    })
    expect(reversed.data.range.start).toBe(fallback.range.start)
    expect(reversed.data.range.end).toBe(fallback.range.end)
  })

  it("uses the default range for malformed query values", () => {
    expect(normalizeAnalyticsRange(undefined)).toBe("30d")
    expect(normalizeAnalyticsRange("not-a-range")).toBe("30d")
    expect(normalizeAnalyticsRange("7d")).toBe("7d")
  })

  it("never invents analytics data for an empty payload", () => {
    const payload = createEmptyAnalyticsPayload("90d", "UTC", now)

    expect(payload.summary.visitorConversations).toBe(0)
    expect(payload.timeline).toEqual([])
    expect(payload.services).toEqual([])
    expect(payload.range.grouping).toBe("weekly")
  })
})
