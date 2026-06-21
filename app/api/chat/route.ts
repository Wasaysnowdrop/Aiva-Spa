import type { NextRequest } from "next/server"
import type { z } from "zod"

import { recordAudit } from "@/lib/audit"
import {
  runConversationTurn,
  streamConversationTurn,
} from "@/lib/ai/conversation"
import { safeValidate, chatRequestSchema } from "@/lib/ai/validation"
import { createPublicLead } from "@/lib/leads/server"
import {
  markSessionLeadCaptured,
  upsertChatSessionTurn,
  chatSessionExists,
} from "@/lib/chat-sessions/server"
import { loadKnowledge } from "@/lib/ai/conversation"
import type { TranscriptMessage } from "@/lib/supabase/types"
import { dispatchLeadNotifications } from "@/lib/notifications/dispatch"
import { checkEmbedAccess } from "@/lib/widget/access"
import { fireEventForAll } from "@/lib/webhooks"
import { incrementConversations } from "@/lib/subscription"
import { buildCorsHeaders } from "@/lib/security/cors"
import {
  consumePublicRateLimit,
} from "@/lib/security/public-rate-limit"
import { LIMITS } from "@/lib/security/limits"
import { tooManyRequests, type RateLimitDecision } from "@/lib/security/limiter"
import { isSupportedLanguage, buildLanguageDirective } from "@/lib/i18n"

type ChatRequest = z.infer<typeof chatRequestSchema>

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CHAT_LIMIT = LIMITS.chat

function cors(request: Request) {
  return buildCorsHeaders(request)
}

function rateLimitResponse(decision: RateLimitDecision, request: Request): Response {
  return tooManyRequests(decision, cors(request))
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) })
}

export async function POST(request: NextRequest) {
  const rl = consumePublicRateLimit(request, CHAT_LIMIT)
  if (rl.limited) return rateLimitResponse(rl, request)

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return Response.json(
      { error: "Body must be valid JSON" },
      { status: 400, headers: cors(request) },
    )
  }

  const parsed = safeValidate(chatRequestSchema, raw)
  if (!parsed.ok) {
    return Response.json(
      { error: parsed.error },
      { status: 400, headers: cors(request) },
    )
  }

  const body = parsed.data
  const rawBody = raw as { language?: unknown }
  const requestedLang =
    isSupportedLanguage(rawBody.language) && rawBody.language
      ? (rawBody.language as Parameters<typeof buildLanguageDirective>[0])
      : null

  let accessUserId: string | null = null
  if (body.spaId) {
    const access = await checkEmbedAccess(body.spaId)
    if (!access.ok) {
      console.warn(
        `[chat] embed access denied for spaId=${body.spaId} reason=${access.reason}`,
      )
      return Response.json(
        {
          error: "Chat is currently unavailable.",
          reason: access.reason,
        },
        { status: 403, headers: cors(request) },
      )
    }
    accessUserId = access.userId
  } else {
    return Response.json(
      { error: "spaId is required." },
      { status: 400, headers: cors(request) },
    )
  }

  const wantsStream = (request.headers.get("accept") || "").includes(
    "text/event-stream",
  )

  if (wantsStream) {
    return handleStreamingChat(request, body, requestedLang, accessUserId)
  }
  return handleBufferedChat(request, body, requestedLang, accessUserId)
}

// ---------------------------------------------------------------------------
// Streaming handler (widget) — emits Server-Sent Events so the visitor sees
// text start forming within ~1s instead of waiting the full LLM latency.
// Lead capture, transcript persistence, and notifications all run
// fire-and-forget after the stream closes so they never block the response.
// ---------------------------------------------------------------------------
async function handleStreamingChat(
  request: NextRequest,
  body: ChatRequest,
  requestedLang: Parameters<typeof buildLanguageDirective>[0] | null,
  accessUserId: string | null,
): Promise<Response> {
  const enc = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(
            enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          )
        } catch {
          // controller already closed
        }
      }

      try {
        // Load KB once for brand name (needed for lead-notification email).
        // The conversation turn uses its own (cached) KB load internally.
        const brandNameP = loadKnowledge()
          .then((kb) => kb.widget.brandName)
          .catch(() => "AivaSpa")

        // First-turn detection (cheap, runs in parallel with the LLM stream).
        const firstTurnP = chatSessionExists(body.sessionId)
          .catch(() => false)
          .then((exists) => !exists)

        const result = await streamConversationTurn({
          sessionId: body.sessionId,
          message: body.message,
          history: body.history,
          language: requestedLang ?? undefined,
          onChunk: (text) => send("chunk", { text }),
        })

        const [isFirstTurn, brandName] = await Promise.all([firstTurnP, brandNameP])

        send("meta", {
          model: result.model,
          provider: result.provider,
          isFirstReply: result.isFirstReply,
          afterHours: result.afterHours,
          durationMs: result.durationMs,
        })

        if (isFirstTurn) {
          void fireEventForAll(accessUserId ?? "__anon__", "conversation.started", {
            sessionId: body.sessionId,
            spaId: body.spaId ?? null,
            sourceUrl: body.sourceUrl ?? null,
            startedAt: new Date().toISOString(),
          })
        }

        // Fire-and-forget: persist transcript + lead capture + notifications.
        // None of this should block the response — the visitor already got
        // their reply streamed above.
        void persistTurn({
          body,
          reply: result.reply,
          result,
          accessUserId,
          brandName,
        })

        send("done", {
          reply: result.reply,
          leadSaved: false,
          leadId: null,
        })
      } catch (err) {
        console.error("[chat] streaming conversation error", err)
        send("error", {
          message:
            "I'm having a quick moment — could you rephrase that, or ask me about a treatment, hours, or booking?",
        })
      } finally {
        closed = true
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      ...cors(request),
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  })
}

// ---------------------------------------------------------------------------
// Buffered (JSON) handler — used by the dashboard sandbox and any other
// non-streaming client. Same engine, but waits for the full reply before
// responding. Lead capture still happens inline because the JSON client
// needs the leadId back to update its UI.
// ---------------------------------------------------------------------------
async function handleBufferedChat(
  request: NextRequest,
  body: ChatRequest,
  requestedLang: Parameters<typeof buildLanguageDirective>[0] | null,
  accessUserId: string | null,
): Promise<Response> {
  try {
    const result = await runConversationTurn({
      sessionId: body.sessionId,
      message: body.message,
      history: body.history,
      language: requestedLang ?? undefined,
    })

    // First-turn webhook (fire-and-forget).
    try {
      const exists = await chatSessionExists(body.sessionId)
      if (!exists) {
        void fireEventForAll(accessUserId ?? "__anon__", "conversation.started", {
          sessionId: body.sessionId,
          spaId: body.spaId ?? null,
          sourceUrl: body.sourceUrl ?? null,
          startedAt: new Date().toISOString(),
        })
      }
    } catch {
      // best-effort
    }

    const { leadSaved, leadId } = await persistTurn({
      body,
      reply: result.reply,
      result,
      accessUserId,
      inline: true,
    }).catch((e) => {
      console.error("[chat] inline persist failed", e)
      return { leadSaved: false, leadId: null }
    })

    return Response.json(
      {
        reply: result.reply,
        model: result.model,
        provider: result.provider,
        durationMs: result.durationMs,
        afterHours: result.afterHours,
        leadSaved,
        leadId,
      },
      { status: 200, headers: cors(request) },
    )
  } catch (err) {
    console.error("[chat] conversation error", err)
    return Response.json(
      {
        reply:
          "I'm having a quick moment — could you rephrase that, or ask me about a treatment, hours, or booking?",
        model: "aiva-fallback",
        provider: "mock",
        durationMs: 0,
        afterHours: false,
        leadSaved: false,
        leadId: null,
        error:
          process.env.NODE_ENV === "production"
            ? undefined
            : "chat engine error",
      },
      { status: 200, headers: cors(request) },
    )
  }
}

// ---------------------------------------------------------------------------
// Shared persistence (transcript + lead + notifications + audit + quota).
// In streaming mode this is fire-and-forget; in buffered mode the caller
// awaits it so the JSON response can include leadSaved / leadId.
// ---------------------------------------------------------------------------
type PersistArgs = {
  body: ChatRequest
  reply: string
  result: {
    afterHours: boolean
    isFirstReply: boolean
  }
  accessUserId: string | null
  inline?: boolean
}

async function persistTurn(
  args: PersistArgs & { brandName?: string },
): Promise<{
  leadSaved: boolean
  leadId: string | null
}> {
  const { body, reply, result, accessUserId, brandName } = args
  const work = async (): Promise<{
    leadSaved: boolean
    leadId: string | null
  }> => {
    const hasAnyLeadField = !!(
      body.lead?.name ||
      body.lead?.email ||
      body.lead?.phone ||
      body.lead?.service ||
      body.lead?.preferredTime
    )
    const completeEnough =
      body.lead?.name && body.lead?.phone && body.lead?.service && body.consentGiven

    let leadId: string | null = null
    let leadSaved = false

    const visitorMsg: TranscriptMessage = {
      id: `msg_live_v_${Date.now()}`,
      role: "visitor",
      content: body.message,
      timestamp: new Date().toISOString(),
    }
    const aiMsg: TranscriptMessage = {
      id: `msg_live_a_${Date.now()}`,
      role: "ai",
      content: reply,
      timestamp: new Date().toISOString(),
    }

    // Transcript write + lead capture run in parallel — they're independent.
    const tasks: Array<Promise<unknown>> = [
      upsertChatSessionTurn({
        sessionId: body.sessionId,
        spaId: body.spaId,
        visitorMessage: visitorMsg,
        aiMessage: aiMsg,
        sourceUrl: body.sourceUrl,
        afterHours: result.afterHours,
        consentGiven: Boolean(body.consentGiven),
        visitorName: body.lead?.name ?? null,
        leadCaptured: false,
        leadId: null,
        status: "active",
      }).catch((e) => {
        console.error("live chat session write failed", e)
      }),
    ]

    if (completeEnough && body.lead) {
      const lead = body.lead
      const transcript: TranscriptMessage[] = [
        ...(body.history ?? []).map((m, i) => ({
          id: `msg_in_${i}_${m.role}`,
          role: m.role === "ai" ? ("ai" as const) : ("visitor" as const),
          content: m.content,
          timestamp: new Date().toISOString(),
        })),
        {
          id: "msg_in_last_visitor",
          role: "visitor",
          content: body.message,
          timestamp: new Date().toISOString(),
        },
        {
          id: "msg_out_last_ai",
          role: "ai",
          content: reply,
          timestamp: new Date().toISOString(),
        },
      ]

      const createdP = createPublicLead({
        name: lead.name ?? "Visitor",
        phone: lead.phone ?? "",
        email: lead.email || "",
        service: lead.service ?? "Not specified",
        preferredTime: lead.preferredTime || "Not specified",
        sourceUrl: body.sourceUrl,
        transcript,
        consentGiven: Boolean(body.consentGiven),
        afterHours: result.afterHours,
        spaId: body.spaId ?? undefined,
      })
        .then(async (created) => {
          leadId = created.lead.id
          leadSaved = true
          // Mark session + fire notifications + audit + quota all in parallel.
          await Promise.allSettled([
            markSessionLeadCaptured(
              body.sessionId,
              created.lead.id,
              lead.name ?? null,
            ).catch((e) => console.error("markSessionLeadCaptured failed", e)),
            recordAudit({
              userName: "widget",
              action: `chat.captured_lead ${created.lead.id} (${created.lead.service})`,
            }).catch((e) => console.error("recordAudit failed", e)),
            dispatchLeadNotifications({
              lead: created.lead,
              brandName: brandName ?? "AivaSpa",
              ownerUserId: accessUserId ?? null,
            }).catch((e) => console.error("dispatchLeadNotifications failed", e)),
            accessUserId
              ? incrementConversations(accessUserId, 1).catch((e) =>
                  console.error("incrementConversations failed", e),
                )
              : Promise.resolve(),
            fireEventForAll(accessUserId ?? "__anon__", "conversation.completed", {
              sessionId: body.sessionId,
              spaId: body.spaId ?? null,
              leadId: created.lead.id,
              leadName: created.lead.name,
              capturedAt: new Date().toISOString(),
            }),
          ])
        })
        .catch((e) => console.error("lead capture failed", e))
      tasks.push(createdP)
    } else if (hasAnyLeadField && body.lead) {
      const partialTranscript: TranscriptMessage[] = [
        ...(body.history ?? []).map((m, i) => ({
          id: `msg_p_${i}_${m.role}`,
          role: m.role === "ai" ? ("ai" as const) : ("visitor" as const),
          content: m.content,
          timestamp: new Date().toISOString(),
        })),
        {
          id: "msg_p_last_v",
          role: "visitor" as const,
          content: body.message,
          timestamp: new Date().toISOString(),
        },
        {
          id: "msg_p_last_ai",
          role: "ai" as const,
          content: reply,
          timestamp: new Date().toISOString(),
        },
      ]

      const createdP = createPublicLead({
        name: body.lead.name || "Partial lead",
        phone: body.lead.phone || "",
        email: body.lead.email || "",
        service: body.lead.service || "Not specified",
        preferredTime: body.lead.preferredTime || "Not specified",
        sourceUrl: body.sourceUrl,
        transcript: partialTranscript,
        consentGiven: Boolean(body.consentGiven),
        afterHours: result.afterHours,
        spaId: body.spaId ?? undefined,
      })
        .then((created) => {
          leadId = created.lead.id
          leadSaved = true
        })
        .catch((e) => console.error("partial lead save failed", e))
      tasks.push(createdP)
    }

    await Promise.allSettled(tasks)
    return { leadSaved, leadId }
  }

  if (args.inline) {
    return work()
  }
  // Fire-and-forget: log failures but never propagate.
  work().catch((e) => console.error("[chat] background persist failed", e))
  return { leadSaved: false, leadId: null }
}
