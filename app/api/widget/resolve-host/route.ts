import type { NextRequest } from "next/server"

import { resolveCustomDomain } from "@/lib/widget/domains"
import { buildCorsHeaders } from "@/lib/security/cors"
import { consumePublicRateLimit } from "@/lib/security/public-rate-limit"
import { LIMITS } from "@/lib/security/limits"
import { tooManyRequests } from "@/lib/security/limiter"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cors(request: Request) {
  return buildCorsHeaders(request)
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) })
}

export async function GET(request: NextRequest) {
  const rl = consumePublicRateLimit(request, LIMITS.widgetResolveHost)
  if (rl.limited) return tooManyRequests(rl, cors(request))

  const url = new URL(request.url)
  const host =
    url.searchParams.get("host") ||
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    ""
  const resolved = await resolveCustomDomain(host)
  if (!resolved) {
    return Response.json(
      { matched: false, spaId: null },
      { status: 200, headers: cors(request) },
    )
  }
  // No PII — only the public spaId and the brand label.
  return Response.json(
    { matched: true, spaId: resolved.spaId },
    { status: 200, headers: cors(request) },
  )
}
