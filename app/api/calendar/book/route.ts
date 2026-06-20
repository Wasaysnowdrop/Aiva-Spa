import type { NextRequest } from "next/server"

import { recordAudit } from "@/lib/audit"
import { safeValidate, leadRequestSchema } from "@/lib/ai/validation"
import { loadKnowledge } from "@/lib/ai/conversation"
import { createBooking } from "@/lib/calendar"
import { createPublicLead } from "@/lib/leads/server"
import { markSessionLeadCaptured } from "@/lib/chat-sessions/server"
import { dispatchLeadNotifications } from "@/lib/notifications/dispatch"
import { isAfterHours } from "@/lib/ai/working-hours"
import { checkEmbedAccess } from "@/lib/widget/access"
import { buildCorsHeaders } from "@/lib/security/cors"
import { consumePublicRateLimit } from "@/lib/security/public-rate-limit"
import type { TranscriptMessage } from "@/lib/supabase/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BOOK_LIMIT = {
  bucket: "calendar-book",
  options: { maxRequests: 20, windowMs: 60_000 },
}

function cors(request: Request) {
  return buildCorsHeaders(request)
}

function rateLimitResponse(retryAfterMs: number, request: Request): Response {
  return Response.json(
    { ok: false, error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: {
        ...cors(request),
        "retry-after": String(Math.ceil(retryAfterMs / 1000)),
      },
    },
  )
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) })
}

export async function POST(request: NextRequest) {
  const rl = consumePublicRateLimit(request, BOOK_LIMIT)
  if (rl.limited) return rateLimitResponse(rl.retryAfterMs, request)

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return Response.json(
      { ok: false, error: "Body must be valid JSON" },
      { status: 400, headers: cors(request) },
    )
  }
  const parsed = safeValidate(leadRequestSchema, raw)
  if (!parsed.ok) {
    return Response.json(
      { ok: false, error: parsed.error },
      { status: 400, headers: cors(request) },
    )
  }
  const body = parsed.data
  const rawBody = raw as Record<string, unknown>
  const startAtIso = body.preferredTime
  if (!startAtIso) {
    return Response.json(
      { ok: false, error: "preferredTime (ISO start) is required" },
      { status: 400, headers: cors(request) },
    )
  }
  if (!body.spaId) {
    return Response.json(
      { ok: false, error: "spaId is required" },
      { status: 400, headers: cors(request) },
    )
  }
  const access = await checkEmbedAccess(body.spaId)
  if (!access.ok) {
    return Response.json(
      { ok: false, error: "Booking is currently unavailable." },
      { status: 403, headers: cors(request) },
    )
  }

  const startAt = new Date(startAtIso)
  if (Number.isNaN(startAt.getTime())) {
    return Response.json(
      { ok: false, error: "preferredTime must be a valid ISO timestamp" },
      { status: 400, headers: cors(request) },
    )
  }

  try {
    const kb = await loadKnowledge()
    const afterHours =
      body.afterHours !== undefined ? body.afterHours : isAfterHours(kb.widget.workingHours)
    const transcript: TranscriptMessage[] = (body.transcript ?? []).map(
      (m, i) => ({
        id: `msg_${Date.now()}_${i}_${m.role}`,
        role: m.role === "ai" ? "ai" : "visitor",
        content: m.content,
        timestamp: new Date().toISOString(),
      }),
    )

    const created = await createPublicLead({
      name: body.name,
      phone: body.phone,
      email: body.email || "",
      service: body.service,
      preferredTime: startAt.toISOString(),
      notes: body.notes,
      sourceUrl: body.sourceUrl,
      transcript,
      consentGiven: body.consentGiven ?? true,
      afterHours,
      sessionId: body.sessionId,
    })
    const lead = created.lead

    const durationMinutes =
      typeof rawBody.durationMinutes === "number" && rawBody.durationMinutes > 0
        ? rawBody.durationMinutes
        : undefined

    const bookingResult = await createBooking({
      spaId: body.spaId,
      leadId: lead.id,
      source: "widget",
      startAtIso: startAt.toISOString(),
      durationMinutes,
      service: body.service,
      notes: body.notes ?? null,
    })
    if (!bookingResult.ok) {
      return Response.json(
        { ok: false, error: bookingResult.error },
        { status: 409, headers: cors(request) },
      )
    }

    if (body.sessionId) {
      try {
        await markSessionLeadCaptured(body.sessionId, lead.id, body.name)
      } catch (e) {
        console.error("markSessionLeadCaptured failed", e)
      }
    }

    const dispatch = await dispatchLeadNotifications({
      lead,
      brandName: kb.widget.brandName,
      transcriptExcerpt: transcript
        .map((m) => `${m.role === "ai" ? "Aiva" : "Visitor"}: ${m.content}`)
        .join("\n"),
    })

    await recordAudit({
      userName: "widget",
      action: `leads.booked ${lead.id} (${body.service}) → cal ${bookingResult.booking.id}`,
    })

    return Response.json(
      {
        ok: true,
        leadId: lead.id,
        merged: created.merged,
        booking: {
          id: bookingResult.booking.id,
          startAt: bookingResult.booking.startAt,
          endAt: bookingResult.booking.endAt,
          reminders: bookingResult.reminders.length,
        },
        notifications: dispatch,
      },
      { status: created.merged ? 200 : 201, headers: cors(request) },
    )
  } catch (err) {
    console.error("calendar book error", err)
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to book" },
      { status: 500, headers: cors(request) },
    )
  }
}
