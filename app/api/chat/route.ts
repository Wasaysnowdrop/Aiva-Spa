import type { NextRequest } from "next/server"

import { recordAudit } from "@/lib/audit"
import {
  runConversationTurn,
  loadKnowledge,
  invalidateKnowledgeCache,
} from "@/lib/ai/conversation"
import { safeValidate, chatRequestSchema } from "@/lib/ai/validation"
import { createPublicLead } from "@/lib/leads/server"
import {
  markSessionLeadCaptured,
  upsertChatSessionTurn,
  chatSessionExists,
} from "@/lib/chat-sessions/server"
import type { TranscriptMessage } from "@/lib/supabase/types"
import { dispatchLeadNotifications } from "@/lib/notifications/dispatch"
import { isAfterHours } from "@/lib/ai/working-hours"
import { checkEmbedAccess } from "@/lib/widget/access"
import { fireEventForAll } from "@/lib/webhooks"
import { incrementConversations } from "@/lib/subscription"
import { buildCorsHeaders } from "@/lib/security/cors"
import {
  consumePublicRateLimit,
} from "@/lib/security/public-rate-limit"
import { isSupportedLanguage, buildLanguageDirective } from "@/lib/i18n"

const DEFAULT_DISCLAIMER =
  "Information provided is general; a licensed provider confirms treatment suitability and pricing."

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CHAT_LIMIT = {
  bucket: "chat",
  options: { maxRequests: 30, windowMs: 60_000 },
}

function cors(request: Request) {
  return buildCorsHeaders(request)
}

function rateLimitResponse(
  retryAfterMs: number,
  request: Request,
): Response {
  const headers = {
    ...cors(request),
    "retry-after": String(Math.ceil(retryAfterMs / 1000)),
  }
  return Response.json(
    { error: "Too many requests. Please slow down." },
    { status: 429, headers },
  )
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) })
}

export async function POST(request: NextRequest) {
  const rl = consumePublicRateLimit(request, CHAT_LIMIT)
  if (rl.limited) return rateLimitResponse(rl.retryAfterMs, request)

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

  // First-time visitor on this sessionId: fire conversation.started
  let isFirstTurn = false
  try {
    isFirstTurn = !(await chatSessionExists(body.sessionId))
  } catch {
    isFirstTurn = true
  }
  if (isFirstTurn) {
    void fireEventForAll("conversation.started", {
      sessionId: body.sessionId,
      spaId: body.spaId ?? null,
      sourceUrl: body.sourceUrl ?? null,
      startedAt: new Date().toISOString(),
    })
  }

  try {
    const result = await runConversationTurn({
      sessionId: body.sessionId,
      message: body.message,
      history: body.history,
      language: requestedLang ?? undefined,
    })

    let leadId: string | null = null
    let leadSaved = false

    const hasAnyLeadField = !!(      body.lead?.name ||
      body.lead?.email ||
      body.lead?.phone ||
      body.lead?.service ||
      body.lead?.preferredTime
    )

    const completeEnough =
      body.lead?.name && body.lead?.phone && body.lead?.service && body.consentGiven

    // ----- Live transcript write (real-time dashboard) -----
    // Every turn is appended to chat_sessions so the dashboard can stream
    // the conversation live via Supabase Realtime — not just on lead capture.
    try {
      const visitorMsg: TranscriptMessage = {
        id: `msg_live_v_${Date.now()}`,
        role: "visitor",
        content: body.message,
        timestamp: new Date().toISOString(),
      }
      const aiMsg: TranscriptMessage = {
        id: `msg_live_a_${Date.now()}`,
        role: "ai",
        content: result.reply,
        timestamp: new Date().toISOString(),
      }
      await upsertChatSessionTurn({
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
      })
    } catch (e) {
      console.error("live chat session write failed", e)
    }

    if (completeEnough && body.lead) {
      const lead = body.lead
      try {
        const kb = await loadKnowledge()
        const afterHours = isAfterHours(kb.widget.workingHours)
        const transcript: TranscriptMessage[] = (body.history ?? []).map((m, i) => ({
          id: `msg_in_${i}_${m.role}`,
          role: m.role === "ai" ? "ai" : "visitor",
          content: m.content,
          timestamp: new Date().toISOString(),
        }))
        transcript.push({
          id: "msg_in_last_visitor",
          role: "visitor",
          content: body.message,
          timestamp: new Date().toISOString(),
        })
        transcript.push({
          id: "msg_out_last_ai",
          role: "ai",
          content: result.reply,
          timestamp: new Date().toISOString(),
        })

        const created = await createPublicLead({
          name: lead.name ?? "Visitor",
          phone: lead.phone ?? "",
          email: lead.email || "",
          service: lead.service ?? "Not specified",
          preferredTime: lead.preferredTime || "Not specified",
          sourceUrl: body.sourceUrl,
          transcript,
          consentGiven: true,
          afterHours,
          spaId: body.spaId ?? undefined,
        })
        leadId = created.lead.id
        leadSaved = true
        await markSessionLeadCaptured(body.sessionId, created.lead.id, lead.name ?? null)
        await dispatchLeadNotifications({ lead: created.lead, brandName: kb.widget.brandName })
        await recordAudit({
          userName: "widget",
          action: `chat.captured_lead ${created.lead.id} (${created.lead.service})`,
        })
        void fireEventForAll("conversation.completed", {
          sessionId: body.sessionId,
          spaId: body.spaId ?? null,
          leadId: created.lead.id,
          leadName: created.lead.name,
          capturedAt: new Date().toISOString(),
        })
        try {
          if (accessUserId) {
            await incrementConversations(accessUserId, 1)
          }
        } catch (e) {
          console.error("incrementConversations failed", e)
        }
      } catch (e) {
        console.error("lead capture failed", e)
      }
    } else if (hasAnyLeadField && body.lead) {
      try {
        const partialTranscript: TranscriptMessage[] = [
          ...(body.history ?? []).map((m, i) => ({
            id: `msg_p_${i}_${m.role}`,
            role: m.role === "ai" ? ("ai" as const) : ("visitor" as const),
            content: m.content,
            timestamp: new Date().toISOString(),
          })),
          { id: "msg_p_last_v", role: "visitor" as const, content: body.message, timestamp: new Date().toISOString() },
          { id: "msg_p_last_ai", role: "ai" as const, content: result.reply, timestamp: new Date().toISOString() },
        ]

        // createPublicLead dedups by phone/email before inserting, so partial
        // data from the widget never creates a parallel row for the same person.
        const created = await createPublicLead({
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
        leadId = created.lead.id
        leadSaved = true
      } catch (e) {
        console.error("partial lead save failed", e)
      }
    }

    invalidateKnowledgeCache()

    return Response.json(
      {
        reply: result.reply,
        model: result.model,
        provider: result.provider,
        durationMs: result.durationMs,
        disclaimerShown: result.disclaimerShown,
        disclaimerText: result.disclaimerShown ? DEFAULT_DISCLAIMER : undefined,
        afterHours: result.afterHours,
        leadSaved,
        leadId,
      },
      { status: 200, headers: cors(request) },
    )
  } catch (err) {
    console.error("[chat] conversation error", err)
    try {
      await loadKnowledge()
      return Response.json(
        {
          reply:
            "I'm having a quick moment — could you rephrase that, or ask me about a treatment, hours, or booking?",
          model: "aiva-fallback",
          provider: "mock",
          durationMs: 0,
          disclaimerShown: false,
          afterHours: false,
          leadSaved: false,
          leadId: null,
          error:
            process.env.NODE_ENV === "production"
              ? undefined
              : err instanceof Error
                ? err.message
                : "chat engine error",
        },
        { status: 200, headers: cors(request) },
      )
    } catch {
      return Response.json(
        {
          reply:
            "I'm having a quick moment — could you rephrase that, or ask me about a treatment, hours, or booking?",
          model: "aiva-fallback",
          provider: "mock",
        },
        { status: 200, headers: cors(request) },
      )
    }
  }
}
