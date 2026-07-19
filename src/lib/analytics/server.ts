import "server-only"

import { createEmptyAnalyticsPayload, normalizeAnalyticsResponse } from "@/lib/analytics/normalize"
import { createClient } from "@/lib/supabase/server"
import type { AnalyticsLoadResult, AnalyticsPayload, AnalyticsRangeKey, AnalyticsSummary, AnalyticsTrend } from "@/lib/analytics/types"

type SessionRow = {
  id: string
  lead_id: string | null
  lead_captured: boolean
  source_url: string
  transcript: unknown
  created_at: string
}

type LeadRow = { id: string; status: "new" | "contacted" | "booked" | "lost"; service: string; source_url: string; created_at: string }
type NotificationRow = { status: string; sent_at: string }

const RANGE_DAYS: Record<AnalyticsRangeKey, number> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 }

export function normalizeAnalyticsRange(value: string | null | undefined): AnalyticsRangeKey {
  return value && value in RANGE_DAYS ? value as AnalyticsRangeKey : "30d"
}

function validTimezone(value: string): string {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date()); return value } catch { return "America/Los_Angeles" }
}

function dateKey(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso))
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`
}

function hourInTimezone(iso: string, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).formatToParts(new Date(iso))
  return Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24
}

function transcriptMessages(value: unknown): { role: string; timestamp?: string; content?: string }[] {
  return Array.isArray(value) ? value.filter((item): item is { role: string; timestamp?: string; content?: string } => Boolean(item && typeof item === "object" && "role" in item)) : []
}

export function isEligibleAnalyticsSession(row: SessionRow): boolean {
  return transcriptMessages(row.transcript).some((message) => message.role === "visitor" && typeof message.content === "string" && message.content.trim().length > 0)
}

export function firstResponseSeconds(transcript: unknown): number | null {
  const messages = transcriptMessages(transcript).filter((message) => message.timestamp && !Number.isNaN(new Date(message.timestamp).getTime())).sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime())
  const visitorIndex = messages.findIndex((message) => message.role === "visitor")
  if (visitorIndex < 0) return null
  const assistant = messages.slice(visitorIndex + 1).find((message) => message.role === "ai" || message.role === "assistant")
  if (!assistant) return null
  const seconds = Math.round((new Date(assistant.timestamp!).getTime() - new Date(messages[visitorIndex].timestamp!).getTime()) / 1000)
  return seconds >= 0 && seconds <= 1800 ? seconds : null
}

function average(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null
}

export function analyticsRate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null
}

export function summarizeAnalyticsRows(sessions: SessionRow[], leads: LeadRow[], notifications: NotificationRow[]): AnalyticsSummary {
  const leadIds = new Set(leads.map((lead) => lead.id))
  const qualifiedIds = new Set(sessions.filter((session) => session.lead_captured && session.lead_id && leadIds.has(session.lead_id)).map((session) => session.lead_id as string))
  const qualifiedLeads = leads.filter((lead) => qualifiedIds.has(lead.id))
  const booked = qualifiedLeads.filter((lead) => lead.status === "booked").length
  const responseTimes = sessions.map((session) => firstResponseSeconds(session.transcript)).filter((value): value is number => value !== null)
  const emailAttempts = notifications.length
  const delivered = notifications.filter((notification) => notification.status === "delivered" || notification.status === "sent").length
  return {
    visitorConversations: sessions.length,
    qualifiedLeads: qualifiedLeads.length,
    bookedLeads: booked,
    visitorToLeadRate: analyticsRate(qualifiedLeads.length, sessions.length),
    leadToBookingRate: analyticsRate(booked, qualifiedLeads.length),
    averageResponseSeconds: average(responseTimes),
    notificationDeliveryRate: analyticsRate(delivered, emailAttempts),
  }
}

export function calculateAnalyticsTrend(current: number | null, previous: number | null): AnalyticsTrend {
  if (current === null || previous === null || previous === 0) return { value: null, direction: "neutral", label: "No previous-period data" }
  const value = Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
  return { value, direction: value > 0 ? "up" : value < 0 ? "down" : "neutral", label: `${value > 0 ? "+" : ""}${value}% vs previous period` }
}

function host(value: string): string {
  try { return new URL(value).hostname.replace(/^www\./, "") || "Direct / unknown" } catch { return "Direct / unknown" }
}

function bucketStart(date: Date, grouping: "daily" | "weekly" | "monthly"): string {
  const next = new Date(date)
  if (grouping === "weekly") next.setUTCDate(next.getUTCDate() - ((next.getUTCDay() + 6) % 7))
  if (grouping === "monthly") next.setUTCDate(1)
  return next.toISOString().slice(0, 10)
}

export async function getAnalyticsResult(rangeInput: string | null | undefined, timezoneInput: string): Promise<AnalyticsLoadResult> {
  const started = Date.now()
  const rangeKey = normalizeAnalyticsRange(rangeInput)
  const timezone = validTimezone(timezoneInput)
  const days = RANGE_DAYS[rangeKey]
  const end = new Date()
  const start = new Date(end.getTime() - days * 86_400_000)
  const previousStart = new Date(start.getTime() - days * 86_400_000)
  const grouping = days <= 30 ? "daily" : days <= 90 ? "weekly" : "monthly"
  const fallback = createEmptyAnalyticsPayload(rangeKey, timezone, end)
  console.info("ANALYTICS_QUERY_STARTED", { range: rangeKey, timezone })

  try {
    const supabase = await createClient()
    const [sessionsResult, leadsResult, notificationsResult] = await Promise.all([
      supabase.from("chat_sessions").select("id, lead_id, lead_captured, source_url, transcript, created_at")
        .eq("conversation_type", "visitor").eq("channel", "website_widget").eq("environment", "production").eq("is_billable", true)
        .is("deleted_at", null).gte("created_at", previousStart.toISOString()).lt("created_at", end.toISOString()),
      supabase.from("leads").select("id, status, service, source_url, created_at").is("deleted_at", null)
        .gte("created_at", previousStart.toISOString()).lt("created_at", end.toISOString()),
      supabase.from("notification_logs").select("status, sent_at").eq("channel", "Email")
        .gte("sent_at", previousStart.toISOString()).lt("sent_at", end.toISOString()),
    ])
    const failedQuery = [
      { queryName: "chat_sessions" as const, error: sessionsResult.error },
      { queryName: "leads" as const, error: leadsResult.error },
      { queryName: "notification_logs" as const, error: notificationsResult.error },
    ].find((query) => query.error)
    if (failedQuery?.error) {
      const failure = {
        stage: "query" as const,
        queryName: failedQuery.queryName,
        code: failedQuery.error.code,
        message: failedQuery.error.message,
        details: failedQuery.error.details,
        hint: failedQuery.error.hint,
      }
      console.error("ANALYTICS_QUERY_FAILED", failure)
      return { payload: fallback, error: failure }
    }
    const allSessions = ((sessionsResult.data ?? []) as SessionRow[]).filter(isEligibleAnalyticsSession)
    const allLeads = (leadsResult.data ?? []) as LeadRow[]
    const allNotifications = (notificationsResult.data ?? []) as NotificationRow[]
    const currentSessions = allSessions.filter((row) => new Date(row.created_at) >= start)
    const previousSessions = allSessions.filter((row) => new Date(row.created_at) >= previousStart && new Date(row.created_at) < start)
    const currentLeads = allLeads.filter((row) => new Date(row.created_at) >= start)
    const previousLeads = allLeads.filter((row) => new Date(row.created_at) >= previousStart && new Date(row.created_at) < start)
    const currentNotifications = allNotifications.filter((row) => new Date(row.sent_at) >= start)
    const previousNotifications = allNotifications.filter((row) => new Date(row.sent_at) >= previousStart && new Date(row.sent_at) < start)
    const summary = summarizeAnalyticsRows(currentSessions, currentLeads, currentNotifications)
    const previous = summarizeAnalyticsRows(previousSessions, previousLeads, previousNotifications)

    const leadById = new Map(currentLeads.map((lead) => [lead.id, lead]))
    const timelineMap = new Map<string, { conversations: number; leads: Set<string>; bookings: Set<string> }>()
    const ensureBucket = (key: string) => { if (!timelineMap.has(key)) timelineMap.set(key, { conversations: 0, leads: new Set(), bookings: new Set() }); return timelineMap.get(key)! }
    for (const session of currentSessions) {
      const key = bucketStart(new Date(dateKey(session.created_at, timezone) + "T12:00:00Z"), grouping)
      const bucket = ensureBucket(key)
      bucket.conversations += 1
      if (session.lead_captured && session.lead_id && leadById.has(session.lead_id)) {
        bucket.leads.add(session.lead_id)
        if (leadById.get(session.lead_id)?.status === "booked") bucket.bookings.add(session.lead_id)
      }
    }
    const timeline = Array.from(timelineMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({
      key,
      label: new Date(key + "T12:00:00Z").toLocaleDateString("en-US", grouping === "monthly" ? { month: "short" } : { month: "short", day: "numeric" }),
      conversations: value.conversations, leads: value.leads.size, bookings: value.bookings.size,
    }))

    const qualifiedIds = new Set(currentSessions.filter((session) => session.lead_captured && session.lead_id && leadById.has(session.lead_id)).map((session) => session.lead_id as string))
    const qualifiedLeads = currentLeads.filter((lead) => qualifiedIds.has(lead.id))
    const detailsCaptured = currentSessions.filter((session) => session.lead_captured).length
    const funnel = [
      { stage: "Visitor conversation", count: currentSessions.length, percentage: currentSessions.length ? 100 : null },
      { stage: "Contact details captured", count: detailsCaptured, percentage: analyticsRate(detailsCaptured, currentSessions.length) },
      { stage: "Qualified lead", count: qualifiedLeads.length, percentage: analyticsRate(qualifiedLeads.length, currentSessions.length) },
      { stage: "Booked consultation", count: summary.bookedLeads, percentage: analyticsRate(summary.bookedLeads, currentSessions.length) },
    ]
    const serviceMap = new Map<string, number>()
    qualifiedLeads.forEach((lead) => { const name = lead.service.trim(); if (name) serviceMap.set(name, (serviceMap.get(name) ?? 0) + 1) })
    const services = Array.from(serviceMap.entries()).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count, percentage: analyticsRate(count, qualifiedLeads.length) ?? 0 }))
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, label: `${String(hour).padStart(2, "0")}:00`, conversations: currentSessions.filter((session) => hourInTimezone(session.created_at, timezone) === hour).length }))
    const referrerMap = new Map<string, { conversations: number; leads: Set<string> }>()
    currentSessions.forEach((session) => { const domain = host(session.source_url); const row = referrerMap.get(domain) ?? { conversations: 0, leads: new Set<string>() }; row.conversations += 1; if (session.lead_id && qualifiedIds.has(session.lead_id)) row.leads.add(session.lead_id); referrerMap.set(domain, row) })
    const referrers = Array.from(referrerMap.entries()).sort((a, b) => b[1].conversations - a[1].conversations).slice(0, 8).map(([domain, value]) => ({ domain, conversations: value.conversations, leads: value.leads.size, conversionRate: analyticsRate(value.leads.size, value.conversations) }))
    const statuses = (["new", "contacted", "booked", "lost"] as const).map((status) => { const count = qualifiedLeads.filter((lead) => lead.status === status).length; return { status, count, percentage: analyticsRate(count, qualifiedLeads.length) ?? 0 } })
    const trends = {
      visitorConversations: calculateAnalyticsTrend(summary.visitorConversations, previous.visitorConversations),
      qualifiedLeads: calculateAnalyticsTrend(summary.qualifiedLeads, previous.qualifiedLeads),
      bookedLeads: calculateAnalyticsTrend(summary.bookedLeads, previous.bookedLeads),
      visitorToLeadRate: calculateAnalyticsTrend(summary.visitorToLeadRate, previous.visitorToLeadRate),
      leadToBookingRate: calculateAnalyticsTrend(summary.leadToBookingRate, previous.leadToBookingRate),
      averageResponseSeconds: calculateAnalyticsTrend(summary.averageResponseSeconds, previous.averageResponseSeconds),
    }
    const normalized = normalizeAnalyticsResponse(
      { range: { key: rangeKey, start: start.toISOString(), end: end.toISOString(), timezone, grouping }, summary, previous, trends, timeline, funnel, services, hours, referrers, statuses },
      fallback,
    )
    console.info("ANALYTICS_DATA_NORMALIZED", { range: rangeKey, success: normalized.success, issueCount: normalized.issues.length })
    console.info("ANALYTICS_QUERY_SUCCESS", { range: rangeKey, durationMs: Date.now() - started, conversations: normalized.data.summary.visitorConversations })
    return {
      payload: normalized.data,
      error: normalized.success ? null : {
        stage: "normalization",
        queryName: "analytics_payload",
        message: "Analytics response did not match the expected schema.",
      },
    }
  } catch (error) {
    const failure = {
      stage: "query" as const,
      queryName: "analytics_payload" as const,
      message: error instanceof Error ? error.message : String(error),
    }
    console.error("ANALYTICS_QUERY_FAILED", { range: rangeKey, ...failure })
    return { payload: fallback, error: failure }
  }
}

export async function getAnalyticsPayload(rangeInput: string | null | undefined, timezoneInput: string): Promise<AnalyticsPayload> {
  return (await getAnalyticsResult(rangeInput, timezoneInput)).payload
}

