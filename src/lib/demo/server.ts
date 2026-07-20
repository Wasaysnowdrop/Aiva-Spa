import "server-only"

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"

import { createAdminClient } from "@/lib/supabase/admin"
import { getRequestIp } from "@/lib/security/limiter"

import { DEMO_COOKIE, DEMO_IDLE_MS, DEMO_MAX_LIFETIME_MS } from "./constants"
import { getDemoScenario, publicScenario, type DemoScenarioId } from "./scenarios"
import type { DemoEventName } from "./schemas"

export type DemoSessionRow = Record<string, unknown> & {
  id: string
  scenario_id: DemoScenarioId
  session_token_hash: string
  anonymous_session_hash: string
  status: "active" | "completed" | "expired" | "blocked"
  message_count: number
  ai_request_count: number
  generated_output_tokens: number
  abuse_count: number
  lead_created: boolean
  sales_lead_created: boolean
  started_at: string
  expires_at: string
  last_activity_at: string
  completion_percentage: number
  current_step: string
  campaign: Record<string, string>
}

export type AuthenticatedDemoSession = {
  row: DemoSessionRow
  tokenHash: string
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

function anonymousHash(request: Request): string {
  const salt = process.env.DEMO_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "aivaspa-demo-local"
  const ip = getRequestIp(request)
  return createHmac("sha256", salt)
    .update(`${ip}|${request.headers.get("user-agent") || "unknown"}`)
    .digest("hex")
}

function parseCookie(request: Request): { id: string; token: string } | null {
  const header = request.headers.get("cookie") || ""
  const entry = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${DEMO_COOKIE}=`))
  if (!entry) return null
  const raw = decodeURIComponent(entry.slice(DEMO_COOKIE.length + 1))
  const separator = raw.indexOf(".")
  if (separator < 1) return null
  const id = raw.slice(0, separator)
  const token = raw.slice(separator + 1)
  if (!/^[0-9a-f-]{36}$/i.test(id) || token.length < 32) return null
  return { id, token }
}

export function demoCookieValue(id: string, token: string): string {
  return `${DEMO_COOKIE}=${encodeURIComponent(`${id}.${token}`)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
}

export function clearDemoCookieValue(): string {
  return `${DEMO_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
}

export async function createDemoSession(input: {
  request: Request
  scenarioId: DemoScenarioId
  referrer: string
  campaign: Record<string, string>
}) {
  const admin = createAdminClient()
  const id = crypto.randomUUID()
  const token = randomBytes(32).toString("base64url")
  const now = new Date()
  const expiresAt = new Date(now.getTime() + DEMO_MAX_LIFETIME_MS)
  const row = {
    id,
    scenario_id: input.scenarioId,
    session_token_hash: sha256(token),
    anonymous_session_hash: anonymousHash(input.request),
    status: "active",
    expires_at: expiresAt.toISOString(),
    last_activity_at: now.toISOString(),
    referrer: input.referrer || null,
    campaign: input.campaign,
    source: "interactive_demo",
    current_step: "scenario",
  }
  const { error } = await admin.from("demo_sessions").insert(row as never)
  if (error) throw new Error(`Unable to start demo session: ${error.message}`)
  await admin.from("demo_events").insert({
    demo_session_id: id,
    event_name: "DEMO_STARTED",
    metadata: { scenario_id: input.scenarioId },
  } as never)
  return { id, token, expiresAt: expiresAt.toISOString() }
}

export async function authenticateDemoSession(request: Request): Promise<AuthenticatedDemoSession | null> {
  const cookie = parseCookie(request)
  if (!cookie) return null
  const tokenHash = sha256(cookie.token)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("demo_sessions")
    .select("*")
    .eq("id", cookie.id)
    .maybeSingle()
  if (error || !data) return null
  const row = data as DemoSessionRow
  const expected = Buffer.from(String(row.session_token_hash), "hex")
  const actual = Buffer.from(tokenHash, "hex")
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null

  const now = Date.now()
  const expired =
    row.status === "expired" ||
    new Date(row.expires_at).getTime() <= now ||
    new Date(row.last_activity_at).getTime() <= now - DEMO_IDLE_MS
  if (expired) {
    await admin.from("demo_sessions").update({ status: "expired", updated_at: new Date().toISOString() } as never).eq("id", row.id)
    return null
  }
  return { row, tokenHash }
}

export async function loadDemoState(session: AuthenticatedDemoSession) {
  const admin = createAdminClient()
  const [{ data: messages }, { data: lead }] = await Promise.all([
    admin.from("demo_messages").select("id,role,content,response_source,created_at").eq("demo_session_id", session.row.id).order("created_at"),
    admin.from("demo_leads").select("*").eq("demo_session_id", session.row.id).maybeSingle(),
  ])
  return {
    session: {
      id: session.row.id,
      status: session.row.status,
      messageCount: session.row.message_count,
      maxMessages: 12,
      leadCreated: session.row.lead_created,
      salesLeadCreated: session.row.sales_lead_created,
      completionPercentage: session.row.completion_percentage,
      currentStep: session.row.current_step,
      expiresAt: session.row.expires_at,
    },
    scenario: publicScenario(getDemoScenario(session.row.scenario_id)),
    messages: ((messages || []) as unknown as Array<Record<string, unknown>>).map((message) => ({
      id: String(message.id),
      role: message.role === "assistant" ? "assistant" : "visitor",
      content: String(message.content),
      source: message.response_source ? String(message.response_source) : undefined,
      createdAt: String(message.created_at),
    })),
    lead: lead || null,
  }
}

export async function recordDemoEvent(
  sessionId: string | null,
  eventName: DemoEventName,
  metadata: Record<string, string | number | boolean | null> = {},
) {
  const admin = createAdminClient()
  const safeMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !/message|email|phone|name|transcript/i.test(key)),
  )
  const { error } = await admin.from("demo_events").insert({
    demo_session_id: sessionId,
    event_name: eventName,
    metadata: safeMetadata,
  } as never)
  if (error && process.env.NODE_ENV !== "test") console.error("[demo-event] insert failed", error.message)
}

export async function markDemoAbuse(session: AuthenticatedDemoSession, reason: string) {
  const admin = createAdminClient()
  const abuseCount = Number(session.row.abuse_count || 0) + 1
  const blocked = abuseCount >= 3
  await admin.from("demo_sessions").update({
    abuse_count: abuseCount,
    status: blocked ? "blocked" : session.row.status,
    updated_at: new Date().toISOString(),
  } as never).eq("id", session.row.id)
  await recordDemoEvent(session.row.id, blocked ? "DEMO_ABUSE_BLOCKED" : "DEMO_MESSAGE_SENT", {
    abuse: true,
    reason,
    abuse_count: abuseCount,
  })
  return { blocked, abuseCount }
}

export function looksAutomated(request: Request): boolean {
  const userAgent = (request.headers.get("user-agent") || "").toLowerCase()
  if (!userAgent) return process.env.NODE_ENV === "production"
  return /(curl|wget|python-requests|scrapy|headlesschrome|phantomjs|selenium|playwright)/i.test(userAgent)
}

export function detectAbuse(message: string): "prompt_exfiltration" | "script_injection" | null {
  if (/<script|javascript:|onerror\s*=|onload\s*=/i.test(message)) return "script_injection"
  if (/(reveal|show|print|repeat|ignore).{0,50}(system prompt|developer message|api key|secret|internal instruction|database)/i.test(message)) {
    return "prompt_exfiltration"
  }
  return null
}

