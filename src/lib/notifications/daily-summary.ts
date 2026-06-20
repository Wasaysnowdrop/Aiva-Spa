import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { buildDailySummaryEmail, sendEmail, type DailySummaryLead } from "./email"

const DEFAULT_TIMEZONE = "America/Los_Angeles"

type ChannelRow = {
  id: string
  channel: string
  enabled: boolean
  recipients: string[]
}

async function getDailySummaryChannels(): Promise<ChannelRow[]> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("notification_channels")
      .select("id, channel, enabled, recipients")
      .eq("channel", "daily_summary")
    if (error || !data) return []
    return (data as unknown[]).map((r) => {
      const row = r as Record<string, unknown>
      const recipients = Array.isArray(row.recipients)
        ? (row.recipients as unknown[]).map((x) => String(x))
        : []
      return {
        id: String(row.id),
        channel: String(row.channel),
        enabled: Boolean(row.enabled),
        recipients,
      }
    })
  } catch {
    return []
  }
}

function yesterdayInTz(tz: string): { startUtc: Date; endUtc: Date; label: string } {
  const now = new Date()
  // Format YYYY-MM-DD in the target tz, then subtract 1 day.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const todayStr = fmt.format(now) // YYYY-MM-DD
  const [yStr, mStr, dStr] = todayStr.split("-")
  const y = Number(yStr)
  const m = Number(mStr)
  const d = Number(dStr)
  // Build yesterday's local date as YYYY-MM-DD.
  const yesterdayDate = new Date(Date.UTC(y, m - 1, d - 1))
  const yesterdayStr = `${yesterdayDate.getUTCFullYear()}-${String(yesterdayDate.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterdayDate.getUTCDate()).padStart(2, "0")}`

  // Convert the local midnight boundaries to UTC by formatting the same instant
  // at each local midnight and inspecting its UTC components. We use a more
  // robust approach: derive the UTC instant that, when formatted in `tz`,
  // produces "YYYY-MM-DD HH:00:00".
  const startUtc = localMidnightToUtc(yesterdayStr, "00:00", tz)
  const endUtc = localMidnightToUtc(yesterdayStr, "23:59:59.999", tz)

  // Human label e.g. "Mon, Jun 16"
  const labelFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  })
  const labelDate = new Date(startUtc.getTime())
  const label = labelFmt.format(labelDate)

  return { startUtc, endUtc, label }
}

function localMidnightToUtc(dateStr: string, time: string, tz: string): Date {
  // Binary search / trial: find the UTC instant whose formatted local date+time
  // in `tz` equals the target.
  const [hh, mm, rest] = time.split(":")
  const [ss, msStr] = (rest ?? "00").split(".")
  const target = `${dateStr} ${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:${ss.padStart(2, "0")}.${(msStr ?? "000").padEnd(3, "0")}`
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  // Start with a guess from treating the date as UTC.
  let guess = new Date(`${dateStr}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:${ss.padStart(2, "0")}.${(msStr ?? "000").padEnd(3, "0")}Z`).getTime()
  for (let i = 0; i < 6; i++) {
    const formatted = fmt.format(new Date(guess))
    const diff = compareFormatted(formatted, target)
    if (diff === 0) return new Date(guess)
    // Each ms of adjustment is ~1ms. We adjust by the difference in total
    // seconds between formatted and target times.
    const seconds = diff / 1000
    guess += seconds * 1000
  }
  return new Date(guess)
}

function compareFormatted(a: string, b: string): number {
  // Both are "YYYY-MM-DD HH:MM:SS.mmm" — compare lexicographically.
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

export type DailySummaryResult = {
  recipients: number
  sent: number
  failed: number
  skipped: number
  metrics: {
    totalLeads: number
    newLeads: number
    contacted: number
    booked: number
    conversations: number
    afterHours: number
    topService: string | null
  } | null
}

export async function runDailySummary(
  options: { timezone?: string; now?: Date } = {},
): Promise<DailySummaryResult> {
  const tz = options.timezone || process.env.DAILY_SUMMARY_TZ || DEFAULT_TIMEZONE
  const { startUtc, endUtc, label } = yesterdayInTz(tz)
  void options.now

  const admin = createAdminClient()

  // Load leads created in window.
  const { data: leadRows, error: leadsErr } = await admin
    .from("leads")
    .select("id, name, service, preferred_time, source, status, after_hours, created_at")
    .gte("created_at", startUtc.toISOString())
    .lte("created_at", endUtc.toISOString())
    .order("created_at", { ascending: false })
    .limit(200)

  const leads: DailySummaryLead[] = leadsErr || !leadRows
    ? []
    : (leadRows as unknown[]).map((row) => {
        const r = row as Record<string, unknown>
        return {
          name: typeof r.name === "string" ? r.name : "Visitor",
          service: typeof r.service === "string" ? r.service : "Not specified",
          preferredTime:
            typeof r.preferred_time === "string" ? r.preferred_time : "Not specified",
          source: typeof r.source === "string" ? r.source : "Website Chat",
          status: typeof r.status === "string" ? r.status : "new",
          createdAt: typeof r.created_at === "string" ? r.created_at : "",
        }
      })

  // Conversation count: chat_sessions whose first message lands in window.
  const { count: conversationsCount } = await admin
    .from("chat_sessions")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startUtc.toISOString())
    .lte("created_at", endUtc.toISOString())

  // Brand name + owner name.
  const { data: widgetRow } = await admin
    .from("widget_config")
    .select("brand_name")
    .limit(1)
    .maybeSingle()
  const brandName =
    (widgetRow as { brand_name?: string } | null)?.brand_name?.trim() || "Glow Med Spa"

  const { data: spaRow } = await admin
    .from("spa_settings")
    .select("owner_name")
    .limit(1)
    .maybeSingle()
  const ownerName =
    (spaRow as { owner_name?: string } | null)?.owner_name?.trim() || null

  const newLeads = leads.filter((l) => l.status === "new").length
  const contacted = leads.filter((l) => l.status === "contacted").length
  const booked = leads.filter((l) => l.status === "booked").length
  const afterHours = leads.filter((l) => (l as unknown as { afterHours?: boolean }).afterHours ? true : false).length || leads.length
  const serviceCounts = new Map<string, number>()
  for (const l of leads) {
    serviceCounts.set(l.service, (serviceCounts.get(l.service) ?? 0) + 1)
  }
  let topService: string | null = null
  let topServiceCount = 0
  for (const [name, count] of serviceCounts) {
    if (count > topServiceCount) {
      topService = name
      topServiceCount = count
    }
  }

  const metrics = {
    totalLeads: leads.length,
    newLeads,
    contacted,
    booked,
    conversations: conversationsCount ?? 0,
    afterHours,
    topService,
  }

  const channels = await getDailySummaryChannels()
  const enabled = channels.filter((c) => c.enabled && c.recipients.length > 0)

  if (enabled.length === 0) {
    return {
      recipients: 0,
      sent: 0,
      failed: 0,
      skipped: 1,
      metrics,
    }
  }

  const { subject, text, html } = buildDailySummaryEmail({
    brandName,
    recipientName: ownerName,
    date: label,
    totalLeads: metrics.totalLeads,
    newLeads: metrics.newLeads,
    contacted: metrics.contacted,
    booked: metrics.booked,
    conversations: metrics.conversations,
    afterHours: metrics.afterHours,
    topService: metrics.topService,
    leads,
  })

  let sent = 0
  let failed = 0
  let recipients = 0

  for (const ch of enabled) {
    for (const recipient of ch.recipients) {
      recipients++
      const result = await sendEmail({ to: recipient, subject, text, html })
      if (result.ok) sent++
      else failed++
    }
  }

  return { recipients, sent, failed, skipped: 0, metrics }
}