"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { recordAudit } from "@/lib/audit"
import { mapCalendarBooking, type CalendarBooking, type CalendarBookingStatus } from "@/lib/calendar/shared"
import { checkActionLimit } from "@/lib/security/check-action-limit"
import { LIMITS } from "@/lib/security/limits"
import { createClient } from "@/lib/supabase/server"
import { EntitlementError, entitlementErrorPayload, requireFeatureForUser } from "@/lib/subscription/entitlements.server"

export type CalendarActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorType?: string }

export type SaveBookingInput = {
  id?: string
  leadId?: string | null
  startAtIso: string
  durationMinutes: number
  service: string
  visitorName?: string
  visitorEmail?: string
  visitorPhone?: string
  timezone: string
  notes?: string
  reminderEmailEnabled: boolean
}

async function requireCalendarUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?redirectTo=/dashboard/calendar")
  try {
    await requireFeatureForUser(user.id, "calendar_booking_links", supabase)
  } catch (error) {
    if (error instanceof EntitlementError) return { supabase, user, entitlementError: entitlementErrorPayload(error) }
    throw error
  }
  return { supabase, user, entitlementError: null }
}

function validTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

export async function saveBookingAction(
  input: SaveBookingInput,
): Promise<CalendarActionResult<CalendarBooking>> {
  const limit = await checkActionLimit(LIMITS.calendarBookings)
  if (!limit.ok) return { ok: false, error: limit.error, errorType: "RATE_LIMITED" }
  const { supabase, user, entitlementError } = await requireCalendarUser()
  if (entitlementError) return entitlementError
  const startAt = new Date(input.startAtIso)
  const duration = Math.round(Number(input.durationMinutes))
  const service = input.service.trim()
  const timezone = input.timezone.trim()
  if (Number.isNaN(startAt.getTime())) {
    return { ok: false, error: "Choose a valid date and time.", errorType: "INVALID_TIME" }
  }
  if (duration < 5 || duration > 1440) {
    return { ok: false, error: "Duration must be between 5 minutes and 24 hours.", errorType: "INVALID_DURATION" }
  }
  if (!service) return { ok: false, error: "Service is required.", errorType: "VALIDATION_ERROR" }
  if (!validTimeZone(timezone)) {
    return { ok: false, error: "Choose a valid business timezone.", errorType: "INVALID_TIMEZONE" }
  }

  const { data: install } = await supabase
    .from("widget_installs")
    .select("widget_key")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  const spaId = (install as { widget_key?: string } | null)?.widget_key
  if (!spaId) return { ok: false, error: "No widget installation is connected to this calendar.", errorType: "NO_CALENDAR" }

  let lead: Record<string, unknown> | null = null
  if (input.leadId) {
    const { data } = await supabase
      .from("leads")
      .select("id, user_id, name, email, phone, service")
      .eq("id", input.leadId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle()
    lead = data as Record<string, unknown> | null
    if (!lead) return { ok: false, error: "Lead not found.", errorType: "LEAD_NOT_FOUND" }
  }

  const visitorName = String(lead?.name ?? input.visitorName ?? "").trim()
  if (!visitorName) {
    return { ok: false, error: "Visitor name is required for an unlinked booking.", errorType: "VALIDATION_ERROR" }
  }

  let conversationId: string | null = null
  if (input.leadId) {
    const { data: conversation } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("lead_id", input.leadId)
      .eq("conversation_type", "visitor")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    conversationId = (conversation as { id?: string } | null)?.id ?? null
  }

  const endAt = new Date(startAt.getTime() + duration * 60_000)
  let bookingId = input.id ?? null
  if (!bookingId && input.leadId) {
    const { data: existing } = await supabase
      .from("calendar_bookings")
      .select("id")
      .eq("user_id", user.id)
      .eq("lead_id", input.leadId)
      .in("status", ["pending", "booked", "confirmed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    bookingId = (existing as { id?: string } | null)?.id ?? null
  }

  let conflictQuery = supabase
    .from("calendar_bookings")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["pending", "booked", "confirmed"])
    .lt("start_at", endAt.toISOString())
    .gt("end_at", startAt.toISOString())
    .limit(1)
  if (bookingId) conflictQuery = conflictQuery.neq("id", bookingId)
  const { data: conflict } = await conflictQuery.maybeSingle()
  if (conflict) {
    return { ok: false, error: "That time overlaps another active booking.", errorType: "TIME_CONFLICT" }
  }

  await supabase.from("calendar_settings").upsert({
    user_id: user.id,
    spa_id: spaId,
    working_hours: { tz: timezone, schedule: [] },
  } as never, { onConflict: "spa_id", ignoreDuplicates: true })

  const payload = {
    user_id: user.id,
    spa_id: spaId,
    lead_id: input.leadId ?? null,
    conversation_id: conversationId,
    source: "manual",
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    duration_minutes: duration,
    service,
    visitor_name: visitorName,
    visitor_email: String(lead?.email ?? input.visitorEmail ?? "").trim() || null,
    visitor_phone: String(lead?.phone ?? input.visitorPhone ?? "").trim() || null,
    timezone,
    notes: input.notes?.trim() || null,
    reminder_email_enabled: input.reminderEmailEnabled,
    status: "confirmed",
  }

  const mutation = bookingId
    ? supabase.from("calendar_bookings").update(payload as never).eq("id", bookingId).eq("user_id", user.id)
    : supabase.from("calendar_bookings").insert(payload as never)
  const { data, error } = await mutation.select("*").maybeSingle()
  if (error || !data) {
    console.error("CALENDAR_BOOKING_SAVE_FAILED", { userId: user.id, bookingId, code: error?.code })
    return { ok: false, error: "We couldn’t save this booking. Please try again.", errorType: "SAVE_FAILED" }
  }

  if (input.leadId) {
    await supabase
      .from("leads")
      .update({ status: "booked", preferred_time: startAt.toISOString(), last_activity_at: new Date().toISOString() } as never)
      .eq("id", input.leadId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
  }

  const booking = mapCalendarBooking(data as Record<string, unknown>)
  void recordAudit({
    userName: user.email?.split("@")[0] || user.id,
    action: `calendar.booking_${bookingId ? "updated" : "created"} ${booking.id}`,
  })
  revalidatePath("/dashboard/calendar")
  revalidatePath("/dashboard/leads")
  if (input.leadId) revalidatePath(`/dashboard/leads/${input.leadId}`)
  return { ok: true, data: booking }
}

export async function updateBookingStatusAction(
  bookingId: string,
  status: Extract<CalendarBookingStatus, "confirmed" | "completed" | "cancelled" | "no_show">,
): Promise<CalendarActionResult<CalendarBooking>> {
  const limit = await checkActionLimit(LIMITS.calendarBookings)
  if (!limit.ok) return { ok: false, error: limit.error, errorType: "RATE_LIMITED" }
  const { supabase, user, entitlementError } = await requireCalendarUser()
  if (entitlementError) return entitlementError
  if (!bookingId || !["confirmed", "completed", "cancelled", "no_show"].includes(status)) {
    return { ok: false, error: "Invalid booking status.", errorType: "VALIDATION_ERROR" }
  }
  const { data, error } = await supabase
    .from("calendar_bookings")
    .update({
      status,
      cancelled_at: status === "cancelled" ? new Date().toISOString() : null,
      cancel_reason: status === "cancelled" ? "Cancelled from dashboard" : null,
    } as never)
    .eq("id", bookingId)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle()
  if (error || !data) {
    return { ok: false, error: "We couldn’t update this booking.", errorType: "UPDATE_FAILED" }
  }
  const booking = mapCalendarBooking(data as Record<string, unknown>)
  void recordAudit({ userName: user.email?.split("@")[0] || user.id, action: `calendar.booking_status ${bookingId} → ${status}` })
  revalidatePath("/dashboard/calendar")
  if (booking.leadId) revalidatePath(`/dashboard/leads/${booking.leadId}`)
  return { ok: true, data: booking }
}
