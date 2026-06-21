import { NextResponse } from "next/server"

import { requireAdminApi } from "@/lib/admin/auth"
import { getSystemHealth } from "@/lib/admin/queries"
import { buildCorsHeaders } from "@/lib/security/cors"
import { consume, getRequestIp, tooManyRequests } from "@/lib/security/limiter"
import { LIMITS } from "@/lib/security/limits"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cors(request: Request) {
  return buildCorsHeaders(request)
}

export async function GET(request?: Request) {
  const auth = await requireAdminApi()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const rl = consume(LIMITS.adminSystemHealth, {
    ip: getRequestIp(request),
    identity: auth.admin.id,
  })
  if (rl.limited && request) return tooManyRequests(rl, cors(request))
  const health = await getSystemHealth()
  return NextResponse.json(health, {
    headers: {
      "cache-control": "no-store",
    },
  })
}
