import type { NextRequest } from "next/server"

import { generateSlots } from "@/lib/calendar"
import { checkEmbedAccess } from "@/lib/widget/access"
import { buildCorsHeaders } from "@/lib/security/cors"
import { consumePublicRateLimit } from "@/lib/security/public-rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SLOTS_LIMIT = {
  bucket: "calendar-slots",
  options: { maxRequests: 60, windowMs: 60_000 },
}

function cors(request: Request) {
  return buildCorsHeaders(request)
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) })
}

export async function GET(request: NextRequest) {
  const rl = consumePublicRateLimit(request, SLOTS_LIMIT)
  if (rl.limited) {
    return Response.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: { ...cors(request), "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }
  const { searchParams } = new URL(request.url)
  const spaId = searchParams.get("spaId")
  if (!spaId) {
    return Response.json(
      { ok: false, error: "spaId is required" },
      { status: 400, headers: cors(request) },
    )
  }
  const access = await checkEmbedAccess(spaId)
  if (!access.ok) {
    return Response.json(
      { ok: false, error: "Calendar is currently unavailable.", reason: access.reason },
      { status: 403, headers: cors(request) },
    )
  }
  const days = Math.min(Math.max(Number(searchParams.get("days") || 7), 1), 30)
  const result = await generateSlots({ spaId, days })
  return Response.json(result, {
    status: result.ok ? 200 : 200,
    headers: {
      ...cors(request),
      // Slots depend on live bookings, but new bookings only happen
      // through /api/calendar/book. 30 s on the browser is a fair
      // compromise; 60 s on the CDN means anonymous visitors get
      // cached responses without hammering Postgres.
      "cache-control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
      "x-content-type-options": "nosniff",
    },
  })
}
