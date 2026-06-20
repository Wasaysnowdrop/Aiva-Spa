import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { getDashboardKpis } from "@/lib/db/analytics"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ACTIVE_WINDOW_MINUTES = 5

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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
