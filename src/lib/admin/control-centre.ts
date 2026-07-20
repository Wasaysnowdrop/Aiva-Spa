import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { humanizeAction } from "./format"

export type OperationalStatus = "operational" | "degraded" | "outage" | "unknown" | "not_configured"

export type HealthCheck = {
  key: string
  service: string
  status: OperationalStatus
  latencyMs: number | null
  lastCheckedAt: string
  message: string
}

export type AdminMetric = {
  key: string
  label: string
  value: number | null
  previous: number | null
  suffix?: string
  explanation: string
  source: string
}

export type PersistedAdminEvent = {
  id: string
  eventType: string
  category: string
  businessId: string | null
  businessName: string
  status: string
  title: string
  detail: string
  occurredAt: string
  href: string | null
}

type DbRow = Record<string, unknown>
type CountResponse = { count: number | null; error: { message: string } | null }
type CountQuery = PromiseLike<CountResponse> & {
  eq(column: string, value: unknown): CountQuery
  in(column: string, values: readonly unknown[]): CountQuery
  gte(column: string, value: unknown): CountQuery
  is(column: string, value: unknown): CountQuery
  neq(column: string, value: unknown): CountQuery
}

const asRows = (data: unknown): DbRow[] => (Array.isArray(data) ? data as DbRow[] : [])
const str = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback
const num = (value: unknown) => typeof value === "number" ? value : Number(value ?? 0) || 0
const bool = (value: unknown) => value === true

function businessName(user: DbRow | undefined, install?: DbRow): string {
  const metadata = (user?.user_metadata ?? {}) as DbRow
  return str(metadata.spa_name) || str(metadata.business_name) || str(install?.widget_key) || str(user?.email, "Unknown business").split("@")[0]
}

async function allAuthUsers(): Promise<DbRow[]> {
  const admin = createAdminClient()
  const users: DbRow[] = []
  let page = 1
  while (page <= 100) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const batch = (data?.users ?? []) as unknown as DbRow[]
    users.push(...batch)
    if (batch.length < 200) break
    page += 1
  }
  return users
}

async function count(table: string, configure?: (query: CountQuery) => CountQuery): Promise<number> {
  const admin = createAdminClient()
  let query = admin.from(table).select("*", { count: "exact", head: true }) as unknown as CountQuery
  if (configure) query = configure(query)
  const { count: value, error } = await query
  if (error) throw error
  return value ?? 0
}

async function timed(key: string, service: string, check: () => Promise<string>): Promise<HealthCheck> {
  const started = Date.now()
  const lastCheckedAt = new Date().toISOString()
  try {
    const message = await check()
    return { key, service, status: "operational", latencyMs: Date.now() - started, lastCheckedAt, message }
  } catch {
    return { key, service, status: "outage", latencyMs: Date.now() - started, lastCheckedAt, message: "Health check failed" }
  }
}

async function configuredHttpCheck(input: { key: string; service: string; configured: boolean; url: string; headers?: HeadersInit }): Promise<HealthCheck> {
  if (!input.configured) {
    return { key: input.key, service: input.service, status: "not_configured", latencyMs: null, lastCheckedAt: new Date().toISOString(), message: "Credentials are not configured" }
  }
  return timed(input.key, input.service, async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3500)
    try {
      const response = await fetch(input.url, { headers: input.headers, signal: controller.signal, cache: "no-store" })
      if (!response.ok) throw new Error(String(response.status))
      return "Provider API reachable"
    } finally {
      clearTimeout(timeout)
    }
  })
}

export async function getPlatformHealth(): Promise<HealthCheck[]> {
  const admin = createAdminClient()
  const database = timed("database", "Supabase database", async () => {
    const { error } = await admin.from("subscriptions").select("id").limit(1)
    if (error) throw error
    return "Database query succeeded"
  })
  const authentication = timed("auth", "Supabase authentication", async () => {
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (error) throw error
    return "Auth admin API reachable"
  })
  const realtime = timed("realtime", "Supabase realtime", async () => {
    const { error } = await admin.from("admin_events").select("id").limit(1)
    if (error) throw error
    return "Persisted realtime event source reachable"
  })
  const jobs = timed("jobs", "Scheduled jobs", async () => {
    const { error } = await admin.from("calendar_reminders").select("id").limit(1)
    if (error) throw error
    return "Reminder queue reachable"
  })
  const widget = timed("widget", "Website and widget API", async () => {
    const { error } = await admin.from("widget_install_checks").select("id").limit(1)
    if (error) throw error
    return "Widget diagnostics reachable"
  })
  const aiKey = process.env.NARA_API_KEY?.trim()
  const aiBase = (process.env.NARA_API_BASE_URL || "https://router.bynara.id/v1").replace(/\/$/, "")
  const resendKey = process.env.RESEND_API_KEY?.trim()
  const billingConfigured = Boolean(process.env.LEMONSQUEEZY_API_KEY || process.env.STRIPE_SECRET_KEY)

  const checks = await Promise.all([
    database,
    authentication,
    realtime,
    configuredHttpCheck({ key: "ai", service: "AI provider", configured: Boolean(aiKey), url: `${aiBase}/models`, headers: aiKey ? { authorization: `Bearer ${aiKey}` } : undefined }),
    configuredHttpCheck({ key: "email", service: "Resend email", configured: Boolean(resendKey), url: "https://api.resend.com/domains", headers: resendKey ? { authorization: `Bearer ${resendKey}` } : undefined }),
    jobs,
    widget,
  ])
  checks.push({ key: "billing", service: "Billing provider", status: billingConfigured ? "unknown" : "not_configured", latencyMs: null, lastCheckedAt: new Date().toISOString(), message: billingConfigured ? "Configured; no safe read-only probe available" : "Credentials are not configured" })
  checks.push({ key: "deployment", service: "Application deployment", status: process.env.VERCEL_ENV ? "operational" : "unknown", latencyMs: null, lastCheckedAt: new Date().toISOString(), message: process.env.VERCEL_ENV ? `${process.env.VERCEL_ENV} deployment active` : "Deployment metadata unavailable" })
  return checks
}

export async function getAdminOverview() {
  const admin = createAdminClient()
  let raw: DbRow = {}
  const { data } = await admin.rpc("get_admin_overview_metrics" as never)
  if (data && typeof data === "object") raw = data as DbRow
  if (!raw.generatedAt) {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const startIso = start.toISOString()
    const [users, businesses, subscriptions, conversations, leads, bookings, aiRequests, emails, delivered, incidents] = await Promise.all([
      allAuthUsers().then((rows) => rows.length).catch(() => 0),
      count("widget_installs", (q) => q.eq("active", true)).catch(() => 0),
      count("subscriptions", (q) => q.in("status", ["active", "trialing"])).catch(() => 0),
      count("chat_sessions", (q) => q.gte("created_at", startIso).eq("conversation_type", "visitor").eq("environment", "production")).catch(() => 0),
      count("leads", (q) => q.gte("created_at", startIso).is("deleted_at", null)).catch(() => 0),
      count("calendar_bookings", (q) => q.gte("created_at", startIso)).catch(() => 0),
      count("ai_usage", (q) => q.gte("created_at", startIso)).catch(() => 0),
      count("notification_logs", (q) => q.gte("sent_at", startIso).eq("channel", "Email")).catch(() => 0),
      count("notification_logs", (q) => q.gte("sent_at", startIso).eq("channel", "Email").eq("status", "delivered")).catch(() => 0),
      count("admin_incidents", (q) => q.neq("status", "resolved")).catch(() => 0),
    ])
    raw = { generatedAt: new Date().toISOString(), totalUsers: users, activeBusinesses: businesses, activeSubscriptions: subscriptions, conversationsToday: conversations, leadsToday: leads, bookingsToday: bookings, aiRequestsToday: aiRequests, emailsToday: emails, emailsDelivered: delivered, emailDeliveryRate: emails ? delivered * 100 / emails : null, openIncidents: incidents }
  }
  const generatedAt = str(raw.generatedAt, new Date().toISOString())
  const metrics: AdminMetric[] = [
    { key: "businesses", label: "Active businesses", value: num(raw.activeBusinesses), previous: null, explanation: "Businesses with an enabled widget install", source: "widget_installs" },
    { key: "subscriptions", label: "Active subscriptions", value: num(raw.activeSubscriptions), previous: null, explanation: "Active or trialing subscriptions", source: "subscriptions" },
    { key: "conversations", label: "Conversations today", value: num(raw.conversationsToday), previous: num(raw.conversationsPrevious), explanation: "Production visitor conversations only", source: "chat_sessions" },
    { key: "leads", label: "Leads today", value: num(raw.leadsToday), previous: num(raw.leadsPrevious), explanation: "Captured, non-deleted leads", source: "leads" },
    { key: "bookings", label: "Bookings today", value: num(raw.bookingsToday), previous: num(raw.bookingsPrevious), explanation: "Consultations created today", source: "calendar_bookings" },
    { key: "ai", label: "AI requests today", value: num(raw.aiRequestsToday), previous: num(raw.aiRequestsPrevious), explanation: "Recorded provider and fallback requests", source: "ai_usage" },
    { key: "email", label: "Email delivery rate", value: raw.emailDeliveryRate == null ? null : num(raw.emailDeliveryRate), previous: null, suffix: "%", explanation: "Delivered emails divided by sends today", source: "notification_logs" },
    { key: "incidents", label: "Open incidents", value: num(raw.openIncidents), previous: null, explanation: "Open, investigating, or monitoring", source: "admin_incidents" },
  ]
  const [health, events] = await Promise.all([getPlatformHealth(), getAdminEvents(12)])
  return { generatedAt, totalUsers: num(raw.totalUsers), metrics, health, events }
}

function eventCopy(row: DbRow, name: string) {
  const metadata = (row.metadata ?? {}) as DbRow
  const type = str(row.event_type)
  if (type === "lead.created") return { title: `${name} captured a new lead`, detail: str(metadata.service, "Service not specified") }
  if (type === "conversation.started") return { title: `New visitor conversation for ${name}`, detail: str(metadata.conversation_status, "Active") }
  if (type === "booking.created") return { title: `${name} received a consultation booking`, detail: str(metadata.service, "Consultation") }
  if (type === "email.delivery") return { title: `Email ${str(metadata.delivery_status, "updated")}`, detail: `${name} · ${str(metadata.email_type, "notification").replaceAll("_", " ")}` }
  if (type === "subscription.changed") return { title: `${name} subscription changed`, detail: `${str(metadata.previous_plan, "New")} → ${str(metadata.plan, "Unknown")}` }
  if (type === "admin.action") return { title: "Admin action performed", detail: str(metadata.action, "Administrative update").replaceAll(/[._]/g, " ") }
  if (type === "ai.request.failed") return { title: "AI provider request failed", detail: str(metadata.error_code, "Provider error") }
  return { title: type.replaceAll(/[._]/g, " ").replace(/^./, (c) => c.toUpperCase()), detail: str(metadata.summary, "Operational event") }
}

function eventHref(row: DbRow): string | null {
  const target = str(row.target_id)
  if (!target) return null
  const category = str(row.category)
  if (category === "leads") return `/admin/leads?record=${encodeURIComponent(target)}`
  if (category === "conversations") return `/admin/conversations?record=${encodeURIComponent(target)}`
  if (category === "bookings") return `/admin/bookings?record=${encodeURIComponent(target)}`
  if (category === "email") return `/admin/email?record=${encodeURIComponent(target)}`
  return null
}

export async function getAdminEvents(limit = 100): Promise<PersistedAdminEvent[]> {
  const admin = createAdminClient()
  const [{ data, error }, users, installsResult] = await Promise.all([
    admin.from("admin_events").select("id,event_type,category,business_id,status,metadata,target_id,occurred_at").order("occurred_at", { ascending: false }).limit(limit),
    allAuthUsers().catch(() => []),
    admin.from("widget_installs").select("user_id,widget_key").limit(1000),
  ])
  if (error) return []
  const userMap = new Map(users.map((user) => [str(user.id), user]))
  const installMap = new Map(asRows(installsResult.data).map((row) => [str(row.user_id), row]))
  return asRows(data).map((row) => {
    const businessId = str(row.business_id) || null
    const name = businessId ? businessName(userMap.get(businessId), installMap.get(businessId)) : "AivaSpa"
    const copy = eventCopy(row, name)
    return { id: str(row.id), eventType: str(row.event_type), category: str(row.category), businessId, businessName: name, status: str(row.status, "info"), title: copy.title, detail: copy.detail, occurredAt: str(row.occurred_at), href: eventHref(row) }
  })
}

export async function getIncidents() {
  const admin = createAdminClient()
  const { data, error } = await admin.from("admin_incidents").select("*").order("detected_at", { ascending: false }).limit(300)
  if (error) return []
  return asRows(data)
}

export async function getAiUsage(days = 1) {
  const admin = createAdminClient()
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data, error } = await admin.from("ai_usage").select("*").gte("created_at", since).order("created_at", { ascending: true }).limit(10000)
  const rows = error ? [] : asRows(data)
  const requests = rows.length
  const errors = rows.filter((row) => str(row.status) === "error").length
  const fallbacks = rows.filter((row) => str(row.status) === "fallback").length
  const exact = rows.filter((row) => str(row.usage_source) === "exact")
  return {
    generatedAt: new Date().toISOString(), rows,
    metrics: {
      requests,
      promptTokens: rows.reduce((sum, row) => sum + num(row.prompt_tokens), 0),
      completionTokens: rows.reduce((sum, row) => sum + num(row.completion_tokens), 0),
      cost: rows.reduce((sum, row) => sum + num(row.estimated_cost_usd), 0),
      averageLatency: requests ? rows.reduce((sum, row) => sum + num(row.latency_ms), 0) / requests : 0,
      errorRate: requests ? errors * 100 / requests : 0,
      fallbackRate: requests ? fallbacks * 100 / requests : 0,
      exactRate: requests ? exact.length * 100 / requests : 0,
    },
  }
}

async function ownerScopedRows(table: string, columns: string, order: string, limit = 1000) {
  const admin = createAdminClient()
  const { data } = await admin.from(table).select(columns).order(order, { ascending: false }).limit(limit)
  return asRows(data)
}

export async function getBusinesses() {
  const [users, installs, subscriptions, leads, chats, bookings] = await Promise.all([
    allAuthUsers(),
    ownerScopedRows("widget_installs", "id,user_id,widget_key,active,created_at,updated_at", "created_at"),
    ownerScopedRows("subscriptions", "*", "created_at"),
    ownerScopedRows("leads", "user_id,created_at,deleted_at", "created_at", 10000),
    ownerScopedRows("chat_sessions", "user_id,last_message_at,conversation_type,environment,deleted_at", "last_message_at", 10000),
    ownerScopedRows("calendar_bookings", "user_id,created_at", "created_at", 10000),
  ])
  const subMap = new Map(subscriptions.map((row) => [str(row.user_id), row]))
  const userMap = new Map(users.map((row) => [str(row.id), row]))
  const ownerIds = new Set([...installs.map((row) => str(row.user_id)), ...subscriptions.map((row) => str(row.user_id))].filter(Boolean))
  return [...ownerIds].map((id) => {
    const install = installs.find((row) => str(row.user_id) === id)
    const subscription = subMap.get(id)
    const user = userMap.get(id)
    const metadata = (user?.user_metadata ?? {}) as DbRow
    const ownerChats = chats.filter((row) => str(row.user_id) === id && str(row.conversation_type) === "visitor" && str(row.environment) === "production" && !row.deleted_at)
    const lastActive = ownerChats[0]?.last_message_at ?? install?.updated_at ?? user?.last_sign_in_at ?? user?.created_at
    return {
      id,
      name: businessName(user, install),
      ownerEmail: str(user?.email),
      plan: str(subscription?.plan, "none"),
      subscriptionStatus: str(subscription?.status, "none"),
      onboardingStatus: str(metadata.onboarding_setup_section, metadata.onboarding_completed ? "complete" : "incomplete"),
      widgetStatus: bool(install?.active) ? "active" : install ? "inactive" : "not installed",
      conversations: ownerChats.length,
      leads: leads.filter((row) => str(row.user_id) === id && !row.deleted_at).length,
      bookings: bookings.filter((row) => str(row.user_id) === id).length,
      createdAt: str(user?.created_at, str(install?.created_at)),
      lastActive: str(lastActive),
      health: bool((user?.app_metadata as DbRow | undefined)?.banned) ? "suspended" : bool(install?.active) ? "healthy" : "attention",
    }
  }).sort((a, b) => Date.parse(b.lastActive || b.createdAt) - Date.parse(a.lastActive || a.createdAt))
}

export async function getBusinessDetail(id: string) {
  const admin = createAdminClient()
  const [businesses, leads, chats, bookings, emails, usage, services, faqs, team] = await Promise.all([
    getBusinesses(),
    admin.from("leads").select("id,name,service,status,created_at").eq("user_id", id).is("deleted_at", null).order("created_at", { ascending: false }).limit(10),
    admin.from("chat_sessions").select("id,session_id,status,message_count,last_message_at,is_billable").eq("user_id", id).eq("conversation_type", "visitor").order("last_message_at", { ascending: false }).limit(10),
    admin.from("calendar_bookings").select("id,service,status,start_at,visitor_name").eq("user_id", id).order("start_at", { ascending: false }).limit(10),
    admin.from("notification_logs").select("id,status,sent_at,email_type").eq("user_id", id).eq("channel", "Email").order("sent_at", { ascending: false }).limit(10),
    admin.from("ai_usage").select("total_tokens,estimated_cost_usd,status,created_at").eq("business_id", id).order("created_at", { ascending: false }).limit(500),
    count("knowledge_services", (q) => q.eq("user_id", id)).catch(() => 0),
    count("knowledge_faqs", (q) => q.eq("user_id", id)).catch(() => 0),
    count("team_members", (q) => q.eq("user_id", id)).catch(() => 0),
  ])
  const business = businesses.find((row) => row.id === id)
  if (!business) return null
  const usageRows = asRows(usage.data)
  return { business, recent: { leads: asRows(leads.data), chats: asRows(chats.data), bookings: asRows(bookings.data), emails: asRows(emails.data) }, configuration: { services, faqs, team }, ai: { requests: usageRows.length, tokens: usageRows.reduce((sum, row) => sum + num(row.total_tokens), 0), cost: usageRows.reduce((sum, row) => sum + num(row.estimated_cost_usd), 0) } }
}

export async function getUsersDetailed() {
  const [users, businesses] = await Promise.all([allAuthUsers(), getBusinesses()])
  const businessMap = new Map(businesses.map((row) => [row.id, row]))
  return users.map((user) => {
    const app = (user.app_metadata ?? {}) as DbRow
    const metadata = (user.user_metadata ?? {}) as DbRow
    const business = businessMap.get(str(user.id))
    return { id: str(user.id), email: str(user.email), status: bool(app.banned) ? "suspended" : "active", business: business?.name ?? "No business", businessId: business?.id ?? null, role: bool(app.is_admin) ? str(app.admin_role, "super_admin") : business ? "owner" : "user", plan: business?.plan ?? "none", createdAt: str(user.created_at), lastSignInAt: str(user.last_sign_in_at) || null, onboardingStatus: str(metadata.onboarding_setup_section, metadata.onboarding_completed ? "complete" : "incomplete"), securityStatus: bool(app.is_admin) ? "admin" : bool(user.email_confirmed_at) ? "verified" : "unverified", isAdmin: bool(app.is_admin), banned: bool(app.banned) }
  })
}

export async function getSubscriptions(): Promise<DbRow[]> {
  const admin = createAdminClient()
  const [businesses, result] = await Promise.all([getBusinesses(), admin.from("subscriptions").select("*").order("updated_at", { ascending: false }).limit(1000)])
  const businessMap = new Map(businesses.map((row) => [row.id, row]))
  return asRows(result.data).map((row) => ({ ...row, business: businessMap.get(str(row.user_id))?.name ?? "Unknown business", paymentStatus: ["active", "trialing"].includes(str(row.status)) ? "current" : str(row.status), lastBillingEvent: row.updated_at }))
}

export async function getOperationsData(): Promise<{ leads: DbRow[]; conversations: DbRow[]; bookings: DbRow[]; emails: DbRow[] }> {
  const [businesses, leads, conversations, bookings, emails] = await Promise.all([
    getBusinesses(),
    ownerScopedRows("leads", "id,user_id,name,phone,email,service,status,source,created_at,deleted_at", "created_at", 1000),
    ownerScopedRows("chat_sessions", "id,session_id,user_id,conversation_type,channel,status,message_count,transcript,lead_captured,is_billable,created_at,last_message_at,deleted_at", "last_message_at", 1000),
    ownerScopedRows("calendar_bookings", "id,user_id,lead_id,conversation_id,visitor_name,service,status,source,start_at,created_at", "created_at", 1000),
    ownerScopedRows("notification_logs", "id,user_id,lead_id,recipient,status,sent_at,email_type,provider,provider_message_id,delivered_at,latency_ms,error_reason,detail", "sent_at", 1000),
  ])
  const names = new Map(businesses.map((row) => [row.id, row.name]))
  const withBusiness = (row: DbRow) => ({ ...row, business: names.get(str(row.user_id)) ?? "Unknown business" })
  return { leads: leads.map(withBusiness), conversations: conversations.map(withBusiness), bookings: bookings.map(withBusiness), emails: emails.map(withBusiness) }
}

const TABLE_LABELS: Record<string, string> = {
  leads: "Leads", chat_sessions: "Conversation sessions", widget_installs: "Businesses", subscriptions: "Subscriptions", conversation_usage_events: "Conversation usage", calendar_bookings: "Bookings", knowledge_services: "Knowledge services", knowledge_faqs: "FAQs", notification_logs: "Email deliveries", ai_usage: "AI usage", audit_logs: "Workspace audit events", admin_audit_log: "Admin audit events", admin_events: "Operational events", admin_incidents: "Incidents",
}

export async function getDatabaseOperations() {
  const admin = createAdminClient()
  const tables = Object.keys(TABLE_LABELS)
  const started = Date.now()
  const rows = await Promise.all(tables.map(async (table) => {
    try { return { table, label: TABLE_LABELS[table], count: await count(table), status: "healthy" } }
    catch { return { table, label: TABLE_LABELS[table], count: 0, status: "unavailable" } }
  }))
  const { data: migrations } = await admin.from("admin_events").select("id").limit(1)
  return { generatedAt: new Date().toISOString(), reachability: migrations ? "operational" : "degraded", queryLatencyMs: Date.now() - started, rows, rls: rows.some((row) => row.status === "unavailable") ? "warning" : "healthy", realtime: rows.find((row) => row.table === "admin_events")?.status === "healthy" ? "operational" : "degraded", migration: "00037 admin control centre" }
}

export async function getAuditEntries() {
  const admin = createAdminClient()
  const [{ data: adminLogs }, { data: workspaceLogs }] = await Promise.all([
    admin.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(500),
    admin.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500),
  ])
  return [
    ...asRows(adminLogs).map((row) => ({ id: str(row.id), time: str(row.created_at), actor: str(row.admin_email, "System"), action: humanizeAction(str(row.action), row.metadata as DbRow), target: str(row.target, "Platform"), business: "AivaSpa", category: "admin", status: "completed", ip: str(row.ip) || null })),
    ...asRows(workspaceLogs).map((row) => ({ id: str(row.id), time: str(row.created_at), actor: str(row.user_name, "Workspace user"), action: humanizeAction(str(row.action), {}), target: str(row.user_id, "Workspace"), business: "Customer workspace", category: "business", status: "completed", ip: null })),
  ].sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
}
