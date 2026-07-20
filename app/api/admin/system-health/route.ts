import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/admin/auth"
import { getPlatformHealth } from "@/lib/admin/control-centre"
import { buildCorsHeaders } from "@/lib/security/cors"
import { consume, getRequestIp, tooManyRequests } from "@/lib/security/limiter"
import { LIMITS } from "@/lib/security/limits"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function GET(request?: Request) {
  const auth = await requireAdminApi()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const rate = consume(LIMITS.adminSystemHealth, { ip: getRequestIp(request), identity: auth.admin.id })
  if (rate.limited && request) return tooManyRequests(rate, buildCorsHeaders(request))
  const services = await getPlatformHealth()
  const status = services.some((service) => service.status === "outage") ? "outage" : services.some((service) => service.status === "degraded") ? "degraded" : "operational"
  return NextResponse.json({ status, services, generatedAt: new Date().toISOString() }, { headers: { "cache-control": "no-store" } })
}