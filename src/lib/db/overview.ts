import { createClient } from "@/lib/supabase/server"
import { mapAuditLog, mapLead } from "@/lib/supabase/types"
import type {
  AuditLog,
  Lead,
  ServiceEngagement,
} from "@/lib/supabase/types"

export type OverviewDailyCount = { day: string; value: number; label?: string }
export type OverviewTopReferrer = { host: string; count: number }
export type OverviewFunnel = {
  visitors: number
  newLeads: number
  contacted: number
  booked: number
  lost: number
}
export type OverviewAiPerformance = {
  totalSessions: number
  activeSessions: number
  capturedSessions: number
  abandonedSessions: number
  leadCaptureRate: number
  avgMessagesPerSession: number
  consentRate: number
}
export type OverviewRecentActivity = AuditLog & { kind: "audit" | "lead" }

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function hostFromUrl(url: string | null | undefined): string {
  if (!url) return "Direct / unknown"
  try {
    const u = new URL(url)
    return u.host.replace(/^www\./, "") || url
  } catch {
    return url
  }
}

export async function getOverviewRecentLeads(limit = 5): Promise<Lead[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapLead(row as Record<string, unknown>))
}

export async function getOverviewDailyCounts(days = 14): Promise<OverviewDailyCount[]> {
  const supabase = await createClient()
  const today = startOfDay(new Date())
  const cutoff = new Date(today)
  cutoff.setDate(today.getDate() - (days - 1))

  const { data, error } = await supabase
    .from("leads")
    .select("created_at")
    .gte("created_at", cutoff.toISOString())
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as { created_at: string }[]
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(cutoff)
    day.setDate(cutoff.getDate() + index)
    const dayStart = startOfDay(day).getTime()
    const count = rows.filter(
      (r) => startOfDay(new Date(r.created_at)).getTime() === dayStart,
    ).length
    const isToday = dayStart === today.getTime()
    return {
      day: days <= 14
        ? day.toLocaleDateString("en-US", { weekday: "short" })
        : day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: count,
      isToday,
      iso: day.toISOString(),
    }
  })
}

export async function getOverviewLeadsByService(): Promise<ServiceEngagement[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("leads")
    .select("service")
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as { service: string }[]
  const map = new Map<string, number>()
  rows.forEach((r) => {
    const key = r.service || "Other"
    map.set(key, (map.get(key) ?? 0) + 1)
  })

  const colors = [
    "#E2E54B",
    "#5E6AD2",
    "#22D3EE",
    "#34D399",
    "#FF77E9",
    "#F59E0B",
    "#8A8F98",
  ]
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], index) => ({
      name,
      value,
      color: colors[index % colors.length],
    }))
}

export async function getOverviewFunnel(): Promise<OverviewFunnel> {
  const supabase = await createClient()
  const [{ count: sessionCount }, { data: leadRows }] = await Promise.all([
    supabase
      .from("chat_sessions")
      .select("*", { count: "exact", head: true }),
    supabase.from("leads").select("status"),
  ])
  const leads = (leadRows ?? []) as { status: string }[]
  return {
    visitors: sessionCount ?? 0,
    newLeads: leads.filter((l) => l.status === "new").length,
    contacted: leads.filter((l) => l.status === "contacted").length,
    booked: leads.filter((l) => l.status === "booked").length,
    lost: leads.filter((l) => l.status === "lost").length,
  }
}

export async function getOverviewTopReferrers(limit = 5): Promise<OverviewTopReferrer[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("leads")
    .select("source_url")
  if (error) throw new Error(error.message)
  const map = new Map<string, number>()
  ;((data ?? []) as { source_url: string }[]).forEach((r) => {
    const host = hostFromUrl(r.source_url)
    map.set(host, (map.get(host) ?? 0) + 1)
  })
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([host, count]) => ({ host, count }))
}

export async function getOverviewAiPerformance(): Promise<OverviewAiPerformance> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("chat_sessions")
    .select(
      "status, lead_captured, consent_given, message_count, after_hours, last_message_at",
    )
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as {
    status: string
    lead_captured: boolean
    consent_given: boolean
    message_count: number
    after_hours: boolean
  }[]

  const total = rows.length
  const captured = rows.filter((r) => r.lead_captured).length
  const consent = rows.filter((r) => r.consent_given).length
  const totalMessages = rows.reduce((s, r) => s + (r.message_count || 0), 0)

  const fiveMinAgo = Date.now() - 5 * 60 * 1000
  const liveActive = rows.filter(
    (r) =>
      r.status === "active" &&
      new Date((r as { last_message_at?: string }).last_message_at ?? 0).getTime() >=
        fiveMinAgo,
  ).length

  return {
    totalSessions: total,
    activeSessions: liveActive,
    capturedSessions: captured,
    abandonedSessions: rows.filter((r) => r.status === "abandoned").length,
    leadCaptureRate: total > 0 ? Math.round((captured / total) * 100) : 0,
    consentRate: total > 0 ? Math.round((consent / total) * 100) : 0,
    avgMessagesPerSession: total > 0 ? Math.round((totalMessages / total) * 10) / 10 : 0,
  }
}

export async function getOverviewRecentActivity(limit = 6): Promise<OverviewRecentActivity[]> {
  const supabase = await createClient()
  const [auditRes, leadsRes] = await Promise.all([
    supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("leads")
      .select("id, name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
  ])

  const audits: OverviewRecentActivity[] = ((auditRes.data ?? []) as Record<string, unknown>[]).map(
    (row) => ({ ...mapAuditLog(row), kind: "audit" as const }),
  )
  const leadEvents: OverviewRecentActivity[] = ((leadsRes.data ?? []) as {
    id: string
    name: string
    status: string
    created_at: string
  }[]).map((l) => ({
    id: `lead-${l.id}`,
    userName: l.name,
    action:
      l.status === "new"
        ? "submitted their details through the chat widget"
        : `status set to ${l.status}`,
    createdAt: l.created_at,
    kind: "lead" as const,
  }))

  return [...audits, ...leadEvents]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}
