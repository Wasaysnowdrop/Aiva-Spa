import type { NextRequest } from "next/server"

import { kbAwareFallback } from "@/lib/ai/fallback"
import { answerDemoMessage, scenarioKnowledgeBundle, type DemoReply } from "@/lib/demo/engine"
import { DEMO_COMPLETE_MESSAGE, DEMO_MAX_MESSAGES, DEMO_MAX_OUTPUT_TOKENS } from "@/lib/demo/constants"
import { demoChatSchema, firstZodError } from "@/lib/demo/schemas"
import {
  authenticateDemoSession,
  detectAbuse,
  markDemoAbuse,
  recordDemoEvent,
} from "@/lib/demo/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { consume, getRequestIp, tooManyRequests } from "@/lib/security/limiter"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CHAT_BURST_LIMIT = { bucket: "public:demo:chat:burst", options: { maxRequests: 8, windowMs: 60_000 } } as const
const CHAT_HOURLY_LIMIT = { bucket: "public:demo:chat:hour", options: { maxRequests: 40, windowMs: 60 * 60_000 } } as const
const privateHeaders = { "cache-control": "no-store, private", "x-robots-tag": "noindex, nofollow, noarchive" }

function limited(reason: "limit_reached" | "expired" | "invalid_session") {
  const status = reason === "limit_reached" ? 429 : 401
  return Response.json({
    ok: false,
    errorType: reason === "limit_reached" ? "DEMO_LIMIT_REACHED" : "INVALID_OR_EXPIRED_SESSION",
    error: reason === "limit_reached" ? DEMO_COMPLETE_MESSAGE : "This demo session has expired. Start a new demo to continue.",
    canRestart: reason === "limit_reached",
  }, { status, headers: privateHeaders })
}

async function globalAiBudgetAvailable(): Promise<boolean> {
  const limit = Math.max(0, Number(process.env.DEMO_GLOBAL_DAILY_AI_REQUEST_LIMIT || 2000))
  if (limit === 0) return false
  const admin = createAdminClient()
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const { data } = await admin.from("demo_sessions").select("ai_request_count").gte("started_at", today.toISOString()).limit(10_000)
  const used = ((data || []) as unknown as Array<Record<string, unknown>>).reduce((sum, row) => sum + Number(row.ai_request_count || 0), 0)
  return used < limit
}

function localBudgetReply(message: string, scenarioId: Parameters<typeof scenarioKnowledgeBundle>[0]): DemoReply {
  const content = kbAwareFallback(message, scenarioKnowledgeBundle(scenarioId))
  return {
    content,
    source: "fallback",
    provider: "local",
    model: "aiva-demo-budget-fallback-1",
    outputTokens: Math.max(1, Math.ceil(content.length / 4)),
    consultationIntent: /\b(book|schedule|appointment|consultation|availability)\b/i.test(message),
    safeRefusal: false,
  }
}

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request)
  const burst = consume(CHAT_BURST_LIMIT, { ip })
  if (burst.limited) return tooManyRequests(burst, privateHeaders, "You're sending messages too quickly. Please wait a moment.")
  const hourly = consume(CHAT_HOURLY_LIMIT, { ip })
  if (hourly.limited) return tooManyRequests(hourly, privateHeaders, "The hourly demo limit has been reached. Please try again later.")

  const session = await authenticateDemoSession(request).catch(() => null)
  if (!session) return limited("invalid_session")
  if (session.row.status === "blocked") return limited("invalid_session")

  const raw = await request.json().catch(() => null)
  const parsed = demoChatSchema.safeParse(raw)
  if (!parsed.success) return Response.json({ ok: false, error: firstZodError(parsed.error) }, { status: 400, headers: privateHeaders })

  const admin = createAdminClient()
  const { data: reservation, error: reserveError } = await admin.rpc("reserve_demo_message", {
    p_session_id: session.row.id,
    p_token_hash: session.tokenHash,
    p_request_id: parsed.data.requestId,
    p_message: parsed.data.message,
    p_max_messages: DEMO_MAX_MESSAGES,
    p_max_output_tokens: DEMO_MAX_OUTPUT_TOKENS,
    p_active_minutes: 10,
  } as never)
  if (reserveError) {
    console.error("[demo-chat] reservation failed", reserveError.message)
    return Response.json({ ok: false, error: "The demo assistant is temporarily unavailable. Try again." }, { status: 503, headers: privateHeaders })
  }
  const reserved = (reservation || {}) as { ok?: boolean; duplicate?: boolean; reason?: "limit_reached" | "expired" | "invalid_session"; message_count?: number }
  if (!reserved.ok) {
    if (reserved.reason === "limit_reached") await recordDemoEvent(session.row.id, "DEMO_LIMIT_REACHED", { message_count: session.row.message_count })
    return limited(reserved.reason || "invalid_session")
  }

  if (reserved.duplicate) {
    const { data } = await admin.from("demo_messages").select("role,content,response_source,created_at").eq("demo_session_id", session.row.id).order("created_at")
    const lastAssistant = [...((data || []) as unknown as Array<Record<string, unknown>>)].reverse().find((item) => item.role === "assistant")
    if (lastAssistant) {
      return Response.json({ ok: true, duplicate: true, reply: String(lastAssistant.content), source: String(lastAssistant.response_source || "fallback"), messageCount: session.row.message_count }, { headers: privateHeaders })
    }
  }

  const abuseReason = detectAbuse(parsed.data.message)
  if (abuseReason) {
    const abuse = await markDemoAbuse(session, abuseReason)
    const reply = abuse.blocked
      ? "This demo session has been paused after repeated unsafe requests. You can still book a walkthrough or start your AivaSpa setup."
      : "I can't share internal instructions, private configuration, or execute code. I can still help with services, consultations, business hours, and treatment FAQs."
    await admin.from("demo_messages").insert({ demo_session_id: session.row.id, role: "assistant", content: reply, response_source: "system", provider: "local", model: "aiva-demo-guard-1", output_tokens: Math.ceil(reply.length / 4) } as never)
    return Response.json({ ok: true, reply, source: "scripted", blocked: abuse.blocked, messageCount: reserved.message_count }, { headers: privateHeaders })
  }

  const { data: historyRows } = await admin.from("demo_messages").select("role,content").eq("demo_session_id", session.row.id).in("role", ["visitor", "assistant"]).order("created_at").limit(24)
  const history = ((historyRows || []) as unknown as Array<Record<string, unknown>>).slice(0, -1).map((item) => ({ role: item.role === "assistant" ? "assistant" as const : "visitor" as const, content: String(item.content) }))

  try {
    const aiAllowed = await globalAiBudgetAvailable().catch(() => false)
    const reply = aiAllowed
      ? await answerDemoMessage({ scenarioId: session.row.scenario_id, message: parsed.data.message, history })
      : localBudgetReply(parsed.data.message, session.row.scenario_id)
    const usedAi = reply.source === "ai" || (reply.source === "fallback" && Boolean(process.env.NARA_API_KEY))
    const nextStep = reply.consultationIntent ? "consultation" : "chat"
    const nextCompletion = reply.consultationIntent ? 45 : 30

    await Promise.all([
      admin.from("demo_messages").insert({
        demo_session_id: session.row.id,
        role: "assistant",
        content: reply.content,
        response_source: reply.source,
        provider: reply.provider,
        model: reply.model,
        output_tokens: reply.outputTokens,
      } as never),
      admin.from("demo_sessions").update({
        ai_request_count: Number(session.row.ai_request_count || 0) + (usedAi ? 1 : 0),
        generated_output_tokens: Number(session.row.generated_output_tokens || 0) + reply.outputTokens,
        current_step: nextStep,
        completion_percentage: Math.max(Number(session.row.completion_percentage || 0), nextCompletion),
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never).eq("id", session.row.id),
      recordDemoEvent(session.row.id, "DEMO_MESSAGE_SENT", { source: reply.source, consultation_intent: reply.consultationIntent, safe_refusal: reply.safeRefusal }),
    ])

    return Response.json({
      ok: true,
      reply: reply.content,
      source: reply.source,
      consultationIntent: reply.consultationIntent,
      messageCount: reserved.message_count,
      remainingMessages: Math.max(0, DEMO_MAX_MESSAGES - Number(reserved.message_count || 0)),
      limitReached: Number(reserved.message_count || 0) >= DEMO_MAX_MESSAGES,
    }, { headers: privateHeaders })
  } catch (error) {
    console.error("[demo-chat] response failed", error)
    const reply = "I can still help with services, consultations, business hours, and treatment FAQs. Try one of the suggested questions."
    await admin.from("demo_messages").insert({ demo_session_id: session.row.id, role: "assistant", content: reply, response_source: "fallback", provider: "local", model: "aiva-demo-emergency-fallback-1", output_tokens: Math.ceil(reply.length / 4) } as never)
    return Response.json({ ok: true, reply, source: "fallback", messageCount: reserved.message_count }, { headers: privateHeaders })
  }
}

