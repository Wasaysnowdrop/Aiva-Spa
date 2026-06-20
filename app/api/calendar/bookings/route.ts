import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { cancelBooking, listBookings } from "@/lib/calendar"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function resolveSpaIdForUser(userId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("widget_installs")
    .select("widget_key")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (data && (data as { widget_key?: string }).widget_key) {
    return (data as { widget_key: string }).widget_key
  }
  return null
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const spaId = await resolveSpaIdForUser(user.id)
  if (!spaId) return NextResponse.json({ error: "No widget install found" }, { status: 404 })
  const url = new URL(request.url)
  const fromIso = url.searchParams.get("from") || undefined
  const toIso = url.searchParams.get("to") || undefined
  const bookings = await listBookings(spaId, { fromIso, toIso, limit: 200 })
  return NextResponse.json({ ok: true, bookings })
}

export async function POST(request: Request) {
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
  const body = raw as { id?: string; reason?: string }
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 })
  const result = await cancelBooking(spaId, body.id, body.reason)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
