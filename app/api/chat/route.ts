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
  meterChatSession,
  upsertChatSessionTurn,
  chatSessionExists,
} from "@/lib/chat-sessions/server"
import { loadKnowledge } from "@/lib/ai/conversation"
import type { TranscriptMessage } from "@/lib/supabase/types"
import { dispatchLeadNotifications } from "@/lib/notifications/dispatch"
import { checkEmbedAccess } from "@/lib/widget/access"
import { fireEventForAll } from "@/lib/webhooks"
import { classificationIsBillable } from "@/lib/conversations/eligibility"
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

// Specific fallback messages per the failure mode. The visitor always
// gets a usable reply — but the wording tells them (and our logs) what
// actually went wrong so we can debug without guesswork.
const FALLBACK_AI_FAIL =
  "I'm having trouble generating a response right now. Please try again in a moment."

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
  const requestStart = Date.now()
  console.log("[chat-api] incoming chat request", {
    contentType: request.headers.get("content-type"),
    accept: request.headers.get("accept"),
  })

  // Hard outer guard: the entire chat pipeline is wrapped so a failure
  // anywhere (rate limit, validation, KB, LLM, DB write) NEVER leaves the
  // visitor staring at a blank bubble. We always return a usable response.
  try {
    const rl = consumePublicRateLimit(request, CHAT_LIMIT)
    if (rl.limited) {
      console.warn("[chat-api] rate limited", { remaining: rl.remaining })
      return rateLimitResponse(rl, request)
    }

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
      console.warn("[chat-api] validation failed", { error: parsed.error })
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
        return Response.json(
          {
            ok: false,
            error: "This widget is not available.",
            errorType: "SUBSCRIPTION_INACTIVE",
            reason: access.reason,
          },
          { status: 403, headers: cors(request) },
        )
      }
      if (access.subscription.isQuotaExhausted) {
        return Response.json(
          {
            ok: false,
            error: "The monthly conversation limit has been reached.",
            errorType: "QUOTA_EXHAUSTED",
            resource: "monthlyConversations",
            limit: access.subscription.quota,
          },
          { status: 429, headers: cors(request) },
        )
      }
      accessUserId = access.userId
    } else if (
      body.conversationType !== "test" ||
      body.channel !== "dashboard_internal" ||
      body.environment === "production"
    ) {
      return Response.json(
        { error: "spaId is required for customer conversations." },
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
  } catch (err) {
    // Last-resort safety net: any uncaught throw above (e.g. a Supabase
    // outage, an LLM transport glitch we forgot to wrap) lands here. We
    // log it loudly and return a usable fallback reply so the visitor
    // never sees a blank bubble.
    console.error(
      "[chat-api] unhandled error in chat pipeline",
      err instanceof Error ? `${err.message}\n${err.stack}` : err,
    )
    if ((request.headers.get("accept") || "").includes("text/event-stream")) {
      // Emit a single SSE chunk + done so the client can render text.
      const enc = new TextEncoder()
      const fallback = FALLBACK_AI_FAIL
      const stream = new ReadableStream({
        start(controller) {
          try {
            controller.enqueue(
              enc.encode(
                `event: chunk\ndata: ${JSON.stringify({ text: fallback })}\n\n`,
              ),
            )
            controller.enqueue(
              enc.encode(
                `event: done\ndata: ${JSON.stringify({ reply: fallback, leadSaved: false, leadId: null })}\n\n`,
              ),
            )
          } finally {
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
        },
      })
    }
    return Response.json(
      {
        reply: FALLBACK_AI_FAIL,
        model: "aiva-fallback",
        provider: "mock",
        durationMs: Date.now() - requestStart,
        afterHours: false,
        leadSaved: false,
        leadId: null,
      },
      { status: 200, headers: cors(request) },
    )
  }
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
        const brandNameP = loadKnowledge(accessUserId ?? undefined)
          .then((kb) => kb.widget.brandName)
          .catch(() => "AivaSpa")

        // First-turn detection (cheap, runs in parallel with the LLM stream).
        const firstTurnP = chatSessionExists(body.sessionId, accessUserId)
          .catch(() => false)
          .then((exists) => ({ exists, isFirstTurn: !exists }))

        let result
        try {
          result = await streamConversationTurn({
            sessionId: body.sessionId,
            message: body.message,
            history: body.history,
            spaId: body.spaId,
            userId: accessUserId ?? undefined,
            language: requestedLang ?? undefined,
            onChunk: (text) => send("chunk", { text }),
          })
        } catch (turnErr) {
          // The conversation turn has its own try/catch around the LLM call
          // and should never throw. If it does, log loudly and emit a
          // specific AI-failure fallback so the visitor sees something
          // useful and the operator can see what happened.
          console.error(
            "[chat] streamConversationTurn threw, serving AI fallback",
            turnErr instanceof Error
              ? `${turnErr.message}\n${turnErr.stack}`
              : turnErr,
          )
          const fallback = FALLBACK_AI_FAIL
          send("chunk", { text: fallback })
          result = {
            reply: fallback,
            model: "aiva-fallback",
            provider: "mock" as const,
            isFirstReply: false,
            afterHours: false,
            durationMs: 0,
            retrievedIds: [],
          }
        }

        // The conversation engine's built-in fallback returns a
        // KB-aware canned reply (e.g. emergency / out-of-scope / hours)
        // when the LLM is unavailable. We only override with our own
        // fallback when the engine returned nothing at all — otherwise
        // we trust it.

        const [firstTurn, brandName] = await Promise.all([firstTurnP, brandNameP])
        const isFirstTurn = firstTurn.isFirstTurn

        console.log("[chat] Rendering response", {
          replyLength: result.reply.length,
          durationMs: result.durationMs,
          model: result.model,
          provider: result.provider,
        })

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
        console.error(
          "[chat] streaming conversation error",
          err instanceof Error ? `${err.message}\n${err.stack}` : err,
        )
        const fallback = FALLBACK_AI_FAIL
        send("chunk", { text: fallback })
        send("done", {
          reply: fallback,
          leadSaved: false,
          leadId: null,
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
  const start = Date.now()
  try {
    let result
    try {
      result = await runConversationTurn({
        sessionId: body.sessionId,
        message: body.message,
        history: body.history,
        spaId: body.spaId,
        userId: accessUserId ?? undefined,
        language: requestedLang ?? undefined,
      })
    } catch (turnErr) {
      console.error(
        "[chat] runConversationTurn threw, serving AI fallback",
        turnErr instanceof Error
          ? `${turnErr.message}\n${turnErr.stack}`
          : turnErr,
      )
      result = {
        reply: FALLBACK_AI_FAIL,
        model: "aiva-fallback",
        provider: "mock" as const,
        isFirstReply: false,
        afterHours: false,
        durationMs: 0,
        retrievedIds: [],
      }
    }

    // The conversation engine's built-in fallback returns a KB-aware
    // canned reply (e.g. emergency / out-of-scope / hours) when the LLM
    // is unavailable. We only override with our hardcoded fallback when
    // the engine returned literally nothing — otherwise we trust it.

    // First-turn webhook (fire-and-forget).
    try {
      const exists = await chatSessionExists(body.sessionId, accessUserId)
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
    console.error(
      "[chat] buffered conversation error",
      err instanceof Error ? `${err.message}\n${err.stack}` : err,
    )
    return Response.json(
      {
        reply: FALLBACK_AI_FAIL,
        model: "aiva-fallback",
        provider: "mock",
        durationMs: Date.now() - start,
        afterHours: false,
        leadSaved: false,
        leadId: null,
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
    const classification = {
      conversationType: body.conversationType ?? "internal",
      channel: body.channel ?? "dashboard_internal",
      environment: body.environment ?? "test",
    } as const
    const customerEligible = classificationIsBillable(classification)

    const hasAnyLeadField = !!(
      body.lead?.name ||
      body.lead?.email ||
      body.lead?.phone ||
      body.lead?.service ||
      body.lead?.preferredTime ||
      body.lead?.notes
    )
    // All six lead fields must be present before we save anything. This is
    // the safety floor: never write a partial lead, never write a lead
    // without notes/goals, never write a lead without email. The AI is
    // responsible for asking until all six are collected.
    const completeEnough =
      body.lead?.name &&
      body.lead?.phone &&
      body.lead?.email &&
      body.lead?.service &&
      body.lead?.preferredTime &&
      body.lead?.notes &&
      body.consentGiven

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
        userId: accessUserId,
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
        ...classification,
      }).then((session) => {
        if (!session) return null
        return meterChatSession(session.id)
      }).catch((e) => {
        console.error("live chat session write or meter failed", e)
      }),
    ]

    if (completeEnough && body.lead && customerEligible) {
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
        email: lead.email ?? "",
        service: lead.service ?? "Not specified",
        preferredTime: lead.preferredTime ?? "Not specified",
        notes: lead.notes ?? "",
        sourceUrl: body.sourceUrl,
        transcript,
        consentGiven: Boolean(body.consentGiven),
        afterHours: result.afterHours,
        spaId: body.spaId ?? undefined,
        userId: accessUserId ?? undefined,
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
              accessUserId,
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
      // Partial lead data was sent, but we never save partial leads — only
      // the full set (name + phone + email + service + preferred time +
      // notes + consent) triggers a save. The transcript above still
      // captures the conversation so the AI has full context on the next
      // turn. This intentionally avoids creating low-quality rows that the
      // dashboard can't act on.
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
