import type { NextRequest } from "next/server"

import { recordAudit } from "@/lib/audit"
import { isAfterHours } from "@/lib/ai/working-hours"
import { safeValidate, leadRequestSchema } from "@/lib/ai/validation"
import { createPublicLead } from "@/lib/leads/server"
import { markSessionLeadCaptured } from "@/lib/chat-sessions/server"
import { loadKnowledge } from "@/lib/ai/conversation"
import { dispatchLeadNotifications } from "@/lib/notifications/dispatch"
import { fireEventForAll } from "@/lib/webhooks"
import type { TranscriptMessage } from "@/lib/supabase/types"
import { buildCorsHeaders } from "@/lib/security/cors"
import { consumePublicRateLimit } from "@/lib/security/public-rate-limit"
import { LIMITS } from "@/lib/security/limits"
import { tooManyRequests, type RateLimitDecision } from "@/lib/security/limiter"
import { checkEmbedAccess } from "@/lib/widget/access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LEAD_LIMIT = LIMITS.leadsDirect

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
  const rl = consumePublicRateLimit(request, LEAD_LIMIT)
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

  const parsed = safeValidate(leadRequestSchema, raw)
  if (!parsed.ok) {
    return Response.json(
      { error: parsed.error },
      { status: 400, headers: cors(request) },
    )
  }
  const body = parsed.data

  let spaOwnerId: string | null = null
  if (body.spaId) {
    const access = await checkEmbedAccess(body.spaId)
    if (!access.ok) {
      return Response.json(
        { error: "Lead capture is currently unavailable." },
        { status: 403, headers: cors(request) },
      )
    }
    spaOwnerId = access.userId
  }

  try {
    const kb = await loadKnowledge(spaOwnerId ?? undefined)
    const afterHours =
      body.afterHours !== undefined
        ? body.afterHours
        : isAfterHours(kb.widget.workingHours)

    const transcript: TranscriptMessage[] = (body.transcript ?? []).map(
      (m, i) => ({
        id: `msg_${Date.now()}_${i}_${m.role}`,
        role: m.role === "ai" ? "ai" : "visitor",
        content: m.content,
        timestamp: new Date().toISOString(),
      }),
    )

    const result = await createPublicLead({
      name: body.name,
      phone: body.phone,
      email: body.email || "",
      service: body.service,
      preferredTime: body.preferredTime,
      notes: body.notes,
      sourceUrl: body.sourceUrl,
      transcript,
      consentGiven: body.consentGiven ?? true,
      afterHours,
      sessionId: body.sessionId,
      spaId: body.spaId ?? undefined,
      userId: spaOwnerId ?? undefined,
    })
    const lead = result.lead

    // Link the live chat session to the captured lead so the dashboard
    // shows the lead + transcript together in real time.
    if (body.sessionId) {
      try {
        await markSessionLeadCaptured(body.sessionId, lead.id, body.name, spaOwnerId)
      } catch (e) {
        console.error("markSessionLeadCaptured failed", e)
      }
    }

    const dispatch = await dispatchLeadNotifications({
      lead,
      brandName: kb.widget.brandName,
      ownerUserId: spaOwnerId,
      transcriptExcerpt: transcript
        .map((m) => `${m.role === "ai" ? "Aiva" : "Visitor"}: ${m.content}`)
        .join("\n"),
    })

    await recordAudit({
      userName: "widget",
      action: result.merged
        ? `leads.merged_into ${lead.id} (existing)`
        : `leads.captured ${lead.id} (${lead.service})`,
    })

    // Fire webhooks (fire-and-forget; failures are logged in webhook_deliveries).
    // Scope to the spa's owner so we never fan out to other tenants.
    if (spaOwnerId) {
      void fireEventForAll(spaOwnerId, result.merged ? "lead.updated" : "lead.created", {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        service: lead.service,
        preferredTime: lead.preferredTime,
        source: lead.source,
        sourceUrl: lead.sourceUrl,
        afterHours: lead.afterHours,
        createdAt: lead.createdAt,
      })
    }

    return Response.json(
      {
        ok: true,
        leadId: lead.id,
        merged: result.merged,
        notifications: dispatch,
      },
      { status: result.merged ? 200 : 201, headers: cors(request) },
    )
  } catch (err) {
    console.error("leads api error", err)
    return Response.json(
      { error: "Failed to save lead" },
      { status: 500, headers: cors(request) },
    )
  }
}

export async function GET(request: Request) {
  return Response.json(
    { ok: true, info: "POST a lead to this endpoint" },
    { headers: cors(request) },
  )
}
