import { z } from "zod"

import type { AnalyticsPayload, AnalyticsRangeKey, AnalyticsSummary, AnalyticsTrend } from "@/lib/analytics/types"

const RANGE_DAYS: Record<AnalyticsRangeKey, number> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 }
const SUMMARY_KEYS = [
  "visitorConversations",
  "qualifiedLeads",
  "bookedLeads",
  "visitorToLeadRate",
  "leadToBookingRate",
  "averageResponseSeconds",
] as const

type RecordLike = Record<string, unknown>

const asRecord = (value: unknown): RecordLike => value !== null && typeof value === "object" ? value as RecordLike : {}
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : []

function finiteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "bigint") {
    const number = Number(value)
    return Number.isFinite(number) ? number : fallback
  }
  if (typeof value === "string" && value.trim()) {
    const number = Number(value)
    return Number.isFinite(number) ? number : fallback
  }
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const number = finiteNumber(value, Number.NaN)
  return Number.isFinite(number) ? number : null
}

function safeString(value: unknown, fallback: string): string {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? fallback : value.toISOString()
  return typeof value === "string" && value.trim() ? value : fallback
}

function safeIso(value: unknown, fallback: string): string {
  const raw = safeString(value, fallback)
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

function safeTimezone(value: unknown, fallback = "America/Los_Angeles"): string {
  const candidate = safeString(value, fallback)
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date())
    return candidate
  } catch {
    return fallback
  }
}

function pick(record: RecordLike, camelCase: string, snakeCase = camelCase): unknown {
  return record[camelCase] ?? record[snakeCase]
}

const numberSchema = z.number().finite()
const nullableNumberSchema = numberSchema.nullable()
const trendSchema = z.object({
  value: nullableNumberSchema,
  direction: z.enum(["up", "down", "neutral"]),
  label: z.string(),
})
const summarySchema = z.object({
  visitorConversations: numberSchema,
  qualifiedLeads: numberSchema,
  bookedLeads: numberSchema,
  visitorToLeadRate: nullableNumberSchema,
  leadToBookingRate: nullableNumberSchema,
  averageResponseSeconds: nullableNumberSchema,
  notificationDeliveryRate: nullableNumberSchema,
})

export const AnalyticsPayloadSchema = z.object({
  range: z.object({
    key: z.enum(["7d", "30d", "90d", "365d"]),
    start: z.string(),
    end: z.string(),
    timezone: z.string(),
    grouping: z.enum(["daily", "weekly", "monthly"]),
  }),
  summary: summarySchema,
  previous: summarySchema,
  trends: z.object({
    visitorConversations: trendSchema,
    qualifiedLeads: trendSchema,
    bookedLeads: trendSchema,
    visitorToLeadRate: trendSchema,
    leadToBookingRate: trendSchema,
    averageResponseSeconds: trendSchema,
  }),
  timeline: z.array(z.object({ key: z.string(), label: z.string(), conversations: numberSchema, leads: numberSchema, bookings: numberSchema })),
  funnel: z.array(z.object({ stage: z.string(), count: numberSchema, percentage: nullableNumberSchema })),
  services: z.array(z.object({ name: z.string(), count: numberSchema, percentage: numberSchema })),
  hours: z.array(z.object({ hour: numberSchema, label: z.string(), conversations: numberSchema })),
  referrers: z.array(z.object({ domain: z.string(), conversations: numberSchema, leads: numberSchema, conversionRate: nullableNumberSchema })),
  statuses: z.array(z.object({ status: z.enum(["new", "contacted", "booked", "lost"]), count: numberSchema, percentage: numberSchema })),
})

function emptySummary(): AnalyticsSummary {
  return {
    visitorConversations: 0,
    qualifiedLeads: 0,
    bookedLeads: 0,
    visitorToLeadRate: null,
    leadToBookingRate: null,
    averageResponseSeconds: null,
    notificationDeliveryRate: null,
  }
}

function neutralTrend(): AnalyticsTrend {
  return { value: null, direction: "neutral", label: "No previous-period data" }
}

export function createEmptyAnalyticsPayload(
  rangeInput: unknown = "30d",
  timezoneInput: unknown = "America/Los_Angeles",
  now: Date = new Date(),
): AnalyticsPayload {
  const rangeKey = typeof rangeInput === "string" && rangeInput in RANGE_DAYS ? rangeInput as AnalyticsRangeKey : "30d"
  const timezone = safeTimezone(timezoneInput)
  const safeNow = Number.isNaN(now.getTime()) ? new Date() : now
  const end = safeNow.toISOString()
  const start = new Date(safeNow.getTime() - RANGE_DAYS[rangeKey] * 86_400_000).toISOString()
  const grouping = RANGE_DAYS[rangeKey] <= 30 ? "daily" : RANGE_DAYS[rangeKey] <= 90 ? "weekly" : "monthly"
  const trends = Object.fromEntries(SUMMARY_KEYS.map((key) => [key, neutralTrend()])) as AnalyticsPayload["trends"]
  return {
    range: { key: rangeKey, start, end, timezone, grouping },
    summary: emptySummary(),
    previous: emptySummary(),
    trends,
    timeline: [],
    funnel: [],
    services: [],
    hours: [],
    referrers: [],
    statuses: [],
  }
}

function normalizeSummary(value: unknown): AnalyticsSummary {
  const summary = asRecord(value)
  return {
    visitorConversations: finiteNumber(pick(summary, "visitorConversations", "visitor_conversations")),
    qualifiedLeads: finiteNumber(pick(summary, "qualifiedLeads", "qualified_leads")),
    bookedLeads: finiteNumber(pick(summary, "bookedLeads", "booked_leads")),
    visitorToLeadRate: nullableNumber(pick(summary, "visitorToLeadRate", "visitor_to_lead_rate")),
    leadToBookingRate: nullableNumber(pick(summary, "leadToBookingRate", "lead_to_booking_rate")),
    averageResponseSeconds: nullableNumber(pick(summary, "averageResponseSeconds", "average_response_seconds")),
    notificationDeliveryRate: nullableNumber(pick(summary, "notificationDeliveryRate", "notification_delivery_rate")),
  }
}

function normalizeTrend(value: unknown): AnalyticsTrend {
  const trend = asRecord(value)
  const direction = trend.direction === "up" || trend.direction === "down" ? trend.direction : "neutral"
  return {
    value: nullableNumber(trend.value),
    direction,
    label: safeString(trend.label, "No previous-period data"),
  }
}

export type AnalyticsNormalizationResult = {
  data: AnalyticsPayload
  success: boolean
  issues: string[]
}

export function normalizeAnalyticsResponse(
  raw: unknown,
  fallback: AnalyticsPayload = createEmptyAnalyticsPayload(),
): AnalyticsNormalizationResult {
  const root = asRecord(raw)
  const range = asRecord(root.range)
  const keyValue = safeString(range.key, fallback.range.key)
  const key = keyValue in RANGE_DAYS ? keyValue as AnalyticsRangeKey : fallback.range.key
  const timezone = safeTimezone(range.timezone, fallback.range.timezone)
  let start = safeIso(range.start, fallback.range.start)
  let end = safeIso(range.end, fallback.range.end)
  if (new Date(start).getTime() > new Date(end).getTime()) {
    start = fallback.range.start
    end = fallback.range.end
  }
  const groupingValue = safeString(range.grouping, fallback.range.grouping)
  const grouping = groupingValue === "daily" || groupingValue === "weekly" || groupingValue === "monthly" ? groupingValue : fallback.range.grouping
  const rawTrends = asRecord(root.trends)

  const candidate = {
    range: { key, start, end, timezone, grouping },
    summary: normalizeSummary(root.summary),
    previous: normalizeSummary(root.previous),
    trends: Object.fromEntries(SUMMARY_KEYS.map((summaryKey) => [summaryKey, normalizeTrend(pick(rawTrends, summaryKey, summaryKey.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`)))])),
    timeline: asArray(root.timeline).map((value, index) => { const row = asRecord(value); return { key: safeString(row.key ?? row.date, `point-${index}`), label: safeString(row.label ?? row.date, `Point ${index + 1}`), conversations: finiteNumber(row.conversations), leads: finiteNumber(row.leads), bookings: finiteNumber(row.bookings) } }),
    funnel: asArray(root.funnel).map((value, index) => { const row = asRecord(value); return { stage: safeString(row.stage, `Stage ${index + 1}`), count: finiteNumber(row.count), percentage: nullableNumber(row.percentage) } }),
    services: asArray(root.services).map((value, index) => { const row = asRecord(value); return { name: safeString(row.name, `Service ${index + 1}`), count: finiteNumber(row.count), percentage: finiteNumber(row.percentage) } }),
    hours: asArray(root.hours).map((value, index) => { const row = asRecord(value); const hour = finiteNumber(row.hour, index); return { hour, label: safeString(row.label, `${String(hour).padStart(2, "0")}:00`), conversations: finiteNumber(row.conversations) } }),
    referrers: asArray(root.referrers).map((value) => { const row = asRecord(value); return { domain: safeString(row.domain, "Direct / unknown"), conversations: finiteNumber(row.conversations), leads: finiteNumber(row.leads), conversionRate: nullableNumber(pick(row, "conversionRate", "conversion_rate")) } }),
    statuses: asArray(root.statuses).map((value) => { const row = asRecord(value); const status = row.status === "contacted" || row.status === "booked" || row.status === "lost" ? row.status : "new"; return { status, count: finiteNumber(row.count), percentage: finiteNumber(row.percentage) } }),
  }

  const parsed = AnalyticsPayloadSchema.safeParse(candidate)
  if (parsed.success) return { data: parsed.data, success: true, issues: [] }

  const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`)
  console.error("ANALYTICS_DATA_NORMALIZATION_FAILED", { issueCount: issues.length, issues })
  return { data: fallback, success: false, issues }
}
