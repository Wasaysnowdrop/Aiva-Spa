import type { NextRequest } from "next/server"

import { authenticateApiKey } from "@/app/actions/api-keys"
import { isAfterHours } from "@/lib/ai/working-hours"
import { loadKnowledge } from "@/lib/ai/conversation"
import { markSessionLeadCaptured } from "@/lib/chat-sessions/server"
import { createPublicLead } from "@/lib/leads/server"
import { dispatchLeadNotifications } from "@/lib/notifications/dispatch"
import { fireEvent } from "@/lib/webhooks"
import { buildCorsHeaders } from "@/lib/security/cors"
import { consumePublicRateLimit } from "@/lib/security/public-rate-limit"
import { LIMITS } from "@/lib/security/limits"
import { tooManyRequests, type RateLimitDecision } from "@/lib/security/limiter"
import { safeValidate, leadRequestSchema } from "@/lib/ai/validation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const API_KEY_LIMIT = LIMITS.v1Leads

function cors(request: Request) {
  return buildCorsHeaders(request, {
    allowHeaders: "content-type, authorization, x-api-key",
  })
}

function jsonError(
  message: string,
  status: number,
  request: Request,
): Response {
  return Response.json(
    { error: message },
    { status, headers: cors(request) },
  )
}

function rateLimitResponse(decision: RateLimitDecision, request: Request): Response {
  return tooManyRequests(decision, cors(request))
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) })
}

export async function GET(request: Request) {
  return Response.json(
    {
      ok: true,
      info: "POST a lead to this endpoint. Authenticate with Authorization: Bearer aiva_live_…",
      events_supported: [
        "lead.created",
        "lead.updated",
        "lead.deleted",
        "conversation.started",
        "conversation.completed",
      ],
    },
    { headers: cors(request) },
  )
}

export async function POST(request: NextRequest) {
  const rl = consumePublicRateLimit(request, API_KEY_LIMIT)
  if (rl.limited) return rateLimitResponse(rl, request)

  const authHeader = request.headers.get("authorization") ?? ""
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null
  const headerKey = request.headers.get("x-api-key")?.trim() ?? null
  const providedKey = bearer || headerKey

  const auth = await authenticateApiKey(providedKey)
  if (!auth.ok) return jsonError(auth.error, auth.status, request)
  if (!auth.scopes.includes("leads:write")) {
    return jsonError("API key is missing the leads:write scope.", 403, request)
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return jsonError("Body must be valid JSON", 400, request)
  }

  const parsed = safeValidate(leadRequestSchema, raw)
  if (!parsed.ok) {
    return jsonError(parsed.error, 400, request)
  }
  const body = parsed.data

  try {
    const kb = await loadKnowledge()
    const afterHours = isAfterHours(kb.widget.workingHours)

    const created = await createPublicLead({
      name: body.name,
      phone: body.phone,
      email: body.email || "",
      service: body.service,
      preferredTime: body.preferredTime,
      notes: body.notes,
      sourceUrl: body.sourceUrl,
      consentGiven: body.consentGiven ?? true,
      afterHours,
      sessionId: body.sessionId,
    })
    const lead = created.lead

    if (body.sessionId) {
      try {
        await markSessionLeadCaptured(body.sessionId, lead.id, body.name)
      } catch {
        // non-fatal
      }
    }

    const dispatch = await dispatchLeadNotifications({
      lead,
      brandName: kb.widget.brandName,
      ownerUserId: auth.userId,
      transcriptExcerpt: `Lead created via REST API`,
    })

    // Fire only this user's webhooks
    void fireEvent(auth.userId, "lead.created", {
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
      source_api: true,
    })

    return Response.json(
      {
        ok: true,
        leadId: lead.id,
        notifications: dispatch,
        lead: {
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          service: lead.service,
          preferredTime: lead.preferredTime,
          status: lead.status,
          createdAt: lead.createdAt,
        },
      },
      { status: created.merged ? 200 : 201, headers: cors(request) },
    )
  } catch (err) {
    console.error("[api/v1/leads] save failed", err)
    return jsonError("Failed to save lead", 500, request)
  }
}
