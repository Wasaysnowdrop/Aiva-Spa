import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { getDashboardKpis } from "@/lib/db/analytics"
import { buildCorsHeaders } from "@/lib/security/cors"
import { consume, getRequestIp, tooManyRequests } from "@/lib/security/limiter"
import { LIMITS } from "@/lib/security/limits"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ACTIVE_WINDOW_MINUTES = 5

function cors(request: Request) {
  return buildCorsHeaders(request)
}

export async function GET(request?: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Per-user rate limit so a single owner can't blow up Postgres
  // (this route runs an RPC + 2 count queries on every poll).
  const rl = consume(LIMITS.dashboardLive, {
    ip: getRequestIp(request),
    identity: user.id,
  })
  if (rl.limited && request) return tooManyRequests(rl, cors(request))

  const cutoff = new Date(
    Date.now() - ACTIVE_WINDOW_MINUTES * 60 * 1000,
  ).toISOString()

  await supabase.rpc("expire_chat_sessions" as never, {
    threshold_minutes: 30,
  } as never)

  const [{ count: activeSessions }, kpis] = await Promise.all([
    supabase
      .from("chat_sessions")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .gte("last_message_at", cutoff),
    getDashboardKpis().catch(() => ({
      newLeadsToday: 0,
      leadsThisWeek: 0,
    })),
  ])

  return NextResponse.json({
    activeSessions: activeSessions ?? 0,
    leadsThisWeek: kpis.leadsThisWeek,
    leadsToday: kpis.newLeadsToday,
    asOf: new Date().toISOString(),
  })
}
