import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import {
  getOrCreateCalendarSettings,
  updateCalendarSettings,
  type CalendarSettingsUpdate,
  type DaySchedule,
} from "@/lib/calendar"
import { planHasCalendar } from "@/lib/calendar"
import { buildCorsHeaders } from "@/lib/security/cors"
import { consume, getRequestIp, tooManyRequests } from "@/lib/security/limiter"
import { LIMITS } from "@/lib/security/limits"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cors(request: Request) {
  return buildCorsHeaders(request)
}

type Body = {
  bookingDurationMinutes?: number
  bufferMinutes?: number
  workingHours?: { tz: string; schedule: DaySchedule[] }
  reminderOffsetsMinutes?: number[]
  enabled?: boolean
}

async function resolveSpaIdForUser(userId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("widget_installs")
    .select("widget_key")
    .eq("user_id", userId)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (data && (data as { widget_key?: string }).widget_key) {
    return (data as { widget_key: string }).widget_key
  }
  const { data: first } = await supabase
    .from("widget_installs")
    .select("widget_key")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (first && (first as { widget_key?: string }).widget_key) {
    return (first as { widget_key: string }).widget_key
  }
  return null
}

export async function GET(request: Request) {
  const rl = consume(LIMITS.calendarSettings, { ip: getRequestIp(request) })
  if (rl.limited) return tooManyRequests(rl, cors(request))

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const spaId = await resolveSpaIdForUser(user.id)
  if (!spaId) return NextResponse.json({ error: "No widget install found" }, { status: 404 })

  const settings = await getOrCreateCalendarSettings(spaId)
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", user.id)
    .maybeSingle()
  const plan = (sub as { plan?: string } | null)?.plan ?? null
  return NextResponse.json({
    settings,
    planAllowsCalendar: planHasCalendar(plan),
  })
}

export async function POST(request: Request) {
  const rl = consume(LIMITS.calendarSettings, { ip: getRequestIp(request) })
  if (rl.limited) return tooManyRequests(rl, cors(request))

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const spaId = await resolveSpaIdForUser(user.id)
  if (!spaId) return NextResponse.json({ error: "No widget install found" }, { status: 404 })

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 })
  }
  const body = raw as Body
  const updates: CalendarSettingsUpdate = {}
  if (typeof body.bookingDurationMinutes === "number")
    updates.bookingDurationMinutes = body.bookingDurationMinutes
  if (typeof body.bufferMinutes === "number") updates.bufferMinutes = body.bufferMinutes
  if (body.workingHours && Array.isArray(body.workingHours.schedule))
    updates.workingHours = body.workingHours
  if (Array.isArray(body.reminderOffsetsMinutes))
    updates.reminderOffsetsMinutes = body.reminderOffsetsMinutes.filter(
      (n) => typeof n === "number" && Number.isFinite(n),
    )
  if (typeof body.enabled === "boolean") updates.enabled = body.enabled

  const settings = await updateCalendarSettings(spaId, updates)
  return NextResponse.json({ ok: true, settings })
}
