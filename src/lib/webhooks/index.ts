import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

import { createClient } from "@/lib/supabase/server"

import {
  WEBHOOK_EVENTS,
  type DeliveryResult,
  type Webhook,
  type WebhookEvent,
} from "./types"

export { WEBHOOK_EVENTS, isValidWebhookUrl, type Webhook, type WebhookEvent, type DeliveryResult } from "./types"

type RawWebhook = {
  id: string
  user_id: string
  url: string
  secret: string
  events: string[]
  active: boolean
  description: string
  created_at: string
  updated_at: string
}

function mapWebhook(row: RawWebhook): Webhook {
  return {
    id: row.id,
    userId: row.user_id,
    url: row.url,
    secret: row.secret,
    events: (row.events ?? []).filter((e): e is WebhookEvent =>
      (WEBHOOK_EVENTS as readonly string[]).includes(e),
    ),
    active: row.active,
    description: row.description ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function generateWebhookSecret() {
  return "whsec_" + randomBytes(24).toString("hex")
}

export function signPayload(secret: string, body: string, timestamp: string) {
  const hmac = createHmac("sha256", secret)
  hmac.update(`${timestamp}.${body}`, "utf8")
  return hmac.digest("hex")
}

export function verifySignature(
  secret: string,
  body: string,
  timestamp: string,
  signature: string,
): boolean {
  const expected = signPayload(secret, body, timestamp)
  if (expected.length !== signature.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(signature, "utf8"))
  } catch {
    return false
  }
}

export async function listWebhooks(userId: string): Promise<Webhook[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("webhooks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error) return []
  return (data ?? []).map((r) => mapWebhook(r as RawWebhook))
}

export async function listRecentDeliveries(userId: string, limit = 25) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("webhook_deliveries")
    .select("id, webhook_id, event, response_status, success, attempt, duration_ms, delivered_at, created_at, error")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) return []
  return data ?? []
}

export async function deliverToWebhook(
  webhook: Webhook,
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<DeliveryResult> {
  const body = JSON.stringify({
    event,
    delivered_at: new Date().toISOString(),
    data: payload,
  })
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = signPayload(webhook.secret, body, timestamp)
  const start = Date.now()
  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AivaSpa-Event": event,
        "X-AivaSpa-Signature": `t=${timestamp},v1=${signature}`,
        "X-AivaSpa-Webhook-Id": webhook.id,
        "User-Agent": "AivaSpa-Webhooks/1.0",
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })
    const responseBody = await res.text().catch(() => "")
    return {
      ok: res.ok,
      status: res.status,
      body: responseBody.slice(0, 2000),
      durationMs: Date.now() - start,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
      durationMs: Date.now() - start,
    }
  }
}

export async function fireEvent(
  userId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
) {
  const hooks = await listWebhooks(userId)
  const matching = hooks.filter((h) => h.active && h.events.includes(event))
  if (matching.length === 0) return
  const supabase = await createClient()
  await Promise.all(
    matching.map(async (hook) => {
      const result = await deliverToWebhook(hook, event, payload)
      await supabase.from("webhook_deliveries").insert({
        webhook_id: hook.id,
        user_id: userId,
        event,
        payload: { event, data: payload } as never,
        response_status: result.status ?? null,
        response_body: result.body ?? null,
        success: result.ok,
        attempt: 1,
        duration_ms: result.durationMs,
        error: result.error ?? null,
        delivered_at: new Date().toISOString(),
      } as never)
    }),
  )
}

export async function fireEventForAll(
  event: WebhookEvent,
  payload: Record<string, unknown>,
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("webhooks")
    .select("id, user_id, url, secret, events, active, description, created_at, updated_at")
    .eq("active", true)
  if (error || !data) return
  const hooks = (data as RawWebhook[])
    .map(mapWebhook)
    .filter((h) => h.events.includes(event))
  await Promise.all(
    hooks.map(async (hook) => {
      const result = await deliverToWebhook(hook, event, payload)
      await supabase.from("webhook_deliveries").insert({
        webhook_id: hook.id,
        user_id: hook.userId,
        event,
        payload: { event, data: payload } as never,
        response_status: result.status ?? null,
        response_body: result.body ?? null,
        success: result.ok,
        attempt: 1,
        duration_ms: result.durationMs,
        error: result.error ?? null,
        delivered_at: new Date().toISOString(),
      } as never)
    }),
  )
}
