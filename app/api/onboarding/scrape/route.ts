import type { NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { scrapeKnowledgeFromUrl } from "@/lib/kb/scraper"
import { buildCorsHeaders } from "@/lib/security/cors"
import { consume, getRequestIp, tooManyRequests } from "@/lib/security/limiter"
import { LIMITS } from "@/lib/security/limits"
import { recordAudit } from "@/lib/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cors(request: Request) {
  return buildCorsHeaders(request)
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ ok: false, error: "Not authenticated" }, { status: 401, headers: cors(request) })
  }

  const rl = consume(LIMITS.onboardingScrape, {
    ip: getRequestIp(request),
    identity: user.id,
  })
  if (rl.limited) return tooManyRequests(rl, cors(request))

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return Response.json({ ok: false, error: "Body must be valid JSON" }, { status: 400, headers: cors(request) })
  }
  const body = raw as { url?: unknown }
  if (typeof body.url !== "string" || body.url.trim().length === 0) {
    return Response.json({ ok: false, error: "url is required" }, { status: 400, headers: cors(request) })
  }
  if (body.url.length > 2048) {
    return Response.json({ ok: false, error: "URL is too long" }, { status: 400, headers: cors(request) })
  }

  const result = await scrapeKnowledgeFromUrl(body.url)
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 422, headers: cors(request) })
  }

  void recordAudit({
    userName: user.email?.split("@")[0] || user.id,
    action: `kb.scraped ${result.data.url} (${result.data.services.length} services, ${result.data.faqs.length} faqs)`,
  })

  return Response.json({ ok: true, knowledge: result.data }, { headers: cors(request) })
}
