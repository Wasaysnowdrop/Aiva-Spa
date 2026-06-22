import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"

export type SystemHealth = {
  status: "ok" | "degraded" | "down"
  database: "ok" | "degraded" | "down"
  realtime: "ok" | "degraded" | "down"
  llm: "ok" | "degraded" | "down"
  uptimeSeconds: number
  openaiConfigured: boolean
  resendConfigured: boolean
  twilioConfigured: boolean
  customCalendarConfigured: boolean
  totals: {
    users: number
    leads: number
    chatSessions: number
    apiKeys: number
    webhooks: number
    subscriptions: number
  }
  trends: {
    leads: number[]
    activeVisitors: number[]
    llmLatencyMs: number[]
    tokenUsage: number[]
    errorRate: number[]
  }
  lastUpdated: string
}

const BOOT_TIME = Date.now()

function emptyTrends(): SystemHealth["trends"] {
  return {
    leads: [],
    activeVisitors: [],
    llmLatencyMs: [],
    tokenUsage: [],
    errorRate: [],
  }
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString()
}

function minutesAgo(m: number): string {
  return new Date(Date.now() - m * 60 * 1000).toISOString()
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const admin = createAdminClient()
  const trends = emptyTrends()
  const status: SystemHealth["status"] = "ok"
  const checks = {
    database: "ok" as "ok" | "degraded" | "down",
    realtime: "ok" as "ok" | "degraded" | "down",
    llm: "ok" as "ok" | "degraded" | "down",
  }

  let totals: SystemHealth["totals"] = {
    users: 0,
    leads: 0,
    chatSessions: 0,
    apiKeys: 0,
    webhooks: 0,
    subscriptions: 0,
  }

  try {
    const safeCount = async (table: string): Promise<number> => {
      try {
        const { count } = await admin
          .from(table)
          .select("*", { count: "exact", head: true })
        return count ?? 0
      } catch {
        return 0
      }
    }
    const countAllUsers = async (): Promise<number> => {
      try {
        let total = 0
        let page = 1
        const perPage = 200
        // Paginate through all users; the admin API caps each response.
        while (true) {
          const { data } = await admin.auth.admin.listUsers({ page, perPage })
          const users = data?.users ?? []
          total += users.length
          if (users.length < perPage) break
          page += 1
          if (page > 1000) break // safety stop
        }
        return total
      } catch {
        return 0
      }
    }
    const [users, leads, sessions, apiKeys, webhooks, subs] = await Promise.all([
      countAllUsers(),
      safeCount("leads"),
      safeCount("chat_sessions"),
      safeCount("api_keys"),
      safeCount("webhooks"),
      safeCount("subscriptions"),
    ])
    totals = { users, leads, chatSessions: sessions, apiKeys, webhooks, subscriptions: subs }
  } catch {
    checks.database = "down"
  }

  // 24h hourly lead trend
  try {
    const last24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data } = await admin
      .from("leads")
      .select("created_at")
      .gte("created_at", last24)
      .limit(5000)
    if (Array.isArray(data)) {
      const buckets = new Array(24).fill(0)
      for (const row of data as { created_at: string }[]) {
        const t = new Date(row.created_at).getTime()
        const idx = Math.min(23, Math.max(0, Math.floor((Date.now() - t) / (60 * 60 * 1000))))
        const pos = 23 - idx
        buckets[pos] = (buckets[pos] ?? 0) + 1
      }
      trends.leads = buckets
    }
  } catch {
    /* ignore */
  }

  // Active visitors in last 5 minutes, sampled every minute for 15 minutes
  try {
    const samples: number[] = []
    for (let i = 14; i >= 0; i--) {
      const start = new Date(Date.now() - (i + 1) * 60_000).toISOString()
      const end = new Date(Date.now() - i * 60_000).toISOString()
      const { count } = await admin
        .from("chat_sessions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .gte("last_message_at", start)
        .lt("last_message_at", end)
      samples.push(count ?? 0)
    }
    trends.activeVisitors = samples
  } catch {
    /* ignore */
  }

  // LLM activity proxies from chat_sessions:
  //   messageIntervals — number of chats whose (updated_at - last_message_at) fell into each 5-second bucket
  //   tokenUsage       — same series scaled by a per-message estimate (250 tokens/turn), shown for context
  try {
    const last60 = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data } = await admin
      .from("chat_sessions")
      .select("updated_at, last_message_at, lead_captured, after_hours")
      .gte("last_message_at", last60)
      .limit(2000)
    if (Array.isArray(data)) {
      const intervals: number[] = []
      for (let i = 0; i < 30; i++) intervals.push(0)
      for (const row of data as { updated_at?: string; last_message_at?: string }[]) {
        if (!row.updated_at || !row.last_message_at) continue
        const diff =
          (new Date(row.updated_at).getTime() - new Date(row.last_message_at).getTime()) / 1000
        const idx = Math.min(29, Math.max(0, Math.round(diff / 5)))
        intervals[29 - idx] = (intervals[29 - idx] ?? 0) + 1
      }
      trends.llmLatencyMs = intervals
      trends.tokenUsage = intervals.map((v) => v * 250)
    }
  } catch {
    /* ignore */
  }

  // Error rate from webhook_deliveries (success vs failed) over the last hour
  try {
    const { data } = await admin
      .from("webhook_deliveries")
      .select("success, created_at")
      .gte("created_at", hoursAgo(1))
      .limit(2000)
    if (Array.isArray(data)) {
      const buckets = new Array(12).fill(0)
      const failures = new Array(12).fill(0)
      for (const row of data as { success?: boolean; created_at: string }[]) {
        const idx = Math.min(11, Math.max(0, Math.floor((Date.now() - new Date(row.created_at).getTime()) / (5 * 60_000))))
        const pos = 11 - idx
        buckets[pos] = (buckets[pos] ?? 0) + 1
        if (!row.success) failures[pos] = (failures[pos] ?? 0) + 1
      }
      trends.errorRate = buckets.map((total, i) => (total > 0 ? (failures[i] / total) * 100 : 0))
    }
  } catch {
    /* ignore */
  }

  const llmConfigured = Boolean(process.env.OPENAI_API_KEY?.trim())
  if (!llmConfigured) checks.llm = "down"

  return {
    status,
    database: checks.database,
    realtime: checks.realtime,
    llm: checks.llm,
    uptimeSeconds: Math.floor((Date.now() - BOOT_TIME) / 1000),
    openaiConfigured: llmConfigured,
    resendConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
    twilioConfigured: Boolean(
      process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim() && process.env.TWILIO_FROM_NUMBER?.trim(),
    ),
    customCalendarConfigured: Boolean(
      process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() &&
        process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() &&
        process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim(),
    ),
    totals,
    trends,
    lastUpdated: new Date().toISOString(),
  }
}

export async function getRecentLeads(limit = 50) {
  const admin = createAdminClient()
  const { data } = await admin
    .from("leads")
    .select(
      "id, name, phone, email, service, status, source, source_url, after_hours, created_at, last_activity_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit)
  return (data ?? []) as Record<string, unknown>[]
}

export async function getRecentChats(limit = 30) {
  const admin = createAdminClient()
  const { data } = await admin
    .from("chat_sessions")
    .select("session_id, visitor_name, status, lead_captured, lead_id, last_message_at, source_url, spa_id, created_at")
    .order("last_message_at", { ascending: false })
    .limit(limit)
  return (data ?? []) as Record<string, unknown>[]
}

export async function getRecentWebhookDeliveries(limit = 50) {
  const admin = createAdminClient()
  const { data } = await admin
    .from("webhook_deliveries")
    .select("id, webhook_id, event, success, response_status, duration_ms, error, attempt, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
  return (data ?? []) as Record<string, unknown>[]
}

export async function getRecentNotificationLogs(limit = 50) {
  const admin = createAdminClient()
  const { data } = await admin
    .from("notification_logs")
    .select("id, lead_id, lead_name, channel, recipient, status, sent_at")
    .order("sent_at", { ascending: false })
    .limit(limit)
  return (data ?? []) as Record<string, unknown>[]
}

export async function getAdminSettings() {
  const admin = createAdminClient()
  const { data } = await admin.from("admin_settings").select("*")
  const result: Record<string, unknown> = {}
  for (const row of (data ?? []) as { key: string; value: unknown }[]) {
    result[row.key] = row.value
  }
  return result
}

export async function getUserList() {
  const admin = createAdminClient()
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
  return (data?.users ?? []).map((u) => {
    const app = (u.app_metadata ?? {}) as Record<string, unknown>
    return {
      id: u.id,
      email: u.email ?? null,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      appMetadata: app,
      userMetadata: (u.user_metadata ?? {}) as Record<string, unknown>,
      isAdmin: Boolean(app.is_admin),
      banned: Boolean(app.banned),
      bannedAt: typeof app.banned_at === "string" ? app.banned_at : null,
      banReason: typeof app.ban_reason === "string" ? app.ban_reason : null,
    }
  })
}

export async function getDatabaseHealth() {
  const admin = createAdminClient()
  const tables = [
    "leads",
    "chat_sessions",
    "widget_config",
    "widget_installs",
    "spa_settings",
    "subscriptions",
    "api_keys",
    "webhooks",
    "webhook_deliveries",
    "notification_channels",
    "notification_logs",
    "team_members",
    "knowledge_services",
    "knowledge_faqs",
    "knowledge_guardrails",
    "audit_logs",
    "calendar_settings",
    "calendar_bookings",
    "calendar_reminders",
    "admin_audit_log",
    "admin_settings",
  ]
  const rows = await Promise.all(
    tables.map(async (table) => {
      try {
        const { count, error } = await admin
          .from(table)
          .select("*", { count: "exact", head: true })
        return { table, count: count ?? 0, error: error?.message ?? null }
      } catch (e) {
        return { table, count: 0, error: e instanceof Error ? e.message : String(e) }
      }
    }),
  )
  return rows
}

export { hoursAgo, minutesAgo }
