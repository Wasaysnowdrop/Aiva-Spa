import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import {
  createCustomDomain,
  deleteCustomDomain,
  listCustomDomains,
} from "@/lib/widget/domains"
import { recordAudit } from "@/lib/audit"
import { listWidgetInstalls } from "@/lib/widget/installs"
import { buildCorsHeaders } from "@/lib/security/cors"
import { consume, getRequestIp, tooManyRequests } from "@/lib/security/limiter"
import { LIMITS } from "@/lib/security/limits"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cors(request: Request) {
  return buildCorsHeaders(request)
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return user
}

function gateLimit(request: Request, userId: string) {
  return consume(LIMITS.whiteLabelDomains, {
    ip: getRequestIp(request),
    identity: userId,
  })
}

export async function GET(request: Request) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const rl = gateLimit(request, user.id)
  if (rl.limited) return tooManyRequests(rl, cors(request))
  const domains = await listCustomDomains(user.id)
  return NextResponse.json({ ok: true, domains })
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const rl = gateLimit(request, user.id)
  if (rl.limited) return tooManyRequests(rl, cors(request))

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 })
  }
  const body = raw as { domain?: string; spaId?: string }
  if (!body.domain) {
    return NextResponse.json({ error: "domain is required" }, { status: 400 })
  }
  if (body.domain.length > 253) {
    return NextResponse.json({ error: "domain is too long" }, { status: 400 })
  }

  // Resolve the spaId from the owner's widget installs if not provided
  let spaId = body.spaId
  if (!spaId) {
    const installs = await listWidgetInstalls(user.id)
    const first = installs.find((i) => i.active) ?? installs[0]
    if (first) spaId = first.widgetKey
  }
  if (!spaId) {
    return NextResponse.json(
      { error: "No widget install found. Add a widget install first." },
      { status: 400 },
    )
  }

  const result = await createCustomDomain(user.id, { domain: body.domain, spaId })
  if (!result.ok) {
    const status =
      result.code === "duplicate"
        ? 409
        : result.code === "plan"
          ? 402
          : result.code === "limit"
            ? 403
            : 400
    return NextResponse.json({ error: result.error, code: result.code }, { status })
  }
  void recordAudit({
    userName: user.email?.split("@")[0] || user.id,
    action: `white_label.domain_added ${result.domain.domain} (spa=${result.domain.spaId})`,
  })
  return NextResponse.json({ ok: true, domain: result.domain })
}

export async function DELETE(request: Request) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const rl = gateLimit(request, user.id)
  if (rl.limited) return tooManyRequests(rl, cors(request))
  const url = new URL(request.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
  const result = await deleteCustomDomain(user.id, id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  void recordAudit({
    userName: user.email?.split("@")[0] || user.id,
    action: `white_label.domain_removed ${id}`,
  })
  return NextResponse.json({ ok: true })
}
