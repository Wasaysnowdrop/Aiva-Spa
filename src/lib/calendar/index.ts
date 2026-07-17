import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { planAllowsFeature, type PlanId } from "@/lib/subscription/plans"

export type DaySchedule = {
  day: number
  open: boolean
  from: string
  to: string
}

export type CalendarSettingsRow = {
  id: string
  userId: string
  spaId: string
  bookingDurationMinutes: number
  bufferMinutes: number
  workingHours: {
    tz: string
    schedule: DaySchedule[]
  }
  reminderOffsetsMinutes: number[]
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type CalendarBookingRow = {
  id: string
  userId: string
  spaId: string
  leadId: string | null
  source: "widget" | "api" | "lead" | "manual"
  startAt: string
  endAt: string
  durationMinutes: number
  service: string
  notes: string | null
  status: "confirmed" | "cancelled" | "completed" | "no_show"
  cancelledAt: string | null
  cancelReason: string | null
  createdAt: string
  updatedAt: string
}

export type CalendarReminderRow = {
  id: string
  bookingId: string
  channel: "email" | "sms"
  recipient: string
  sendAt: string
  sentAt: string | null
  error: string | null
  attempts: number
  createdAt: string
}

const DEFAULT_SCHEDULE: DaySchedule[] = [
  { day: 0, open: false, from: "09:00", to: "17:00" },
  { day: 1, open: true,  from: "09:00", to: "19:00" },
  { day: 2, open: true,  from: "09:00", to: "19:00" },
  { day: 3, open: true,  from: "09:00", to: "19:00" },
  { day: 4, open: true,  from: "09:00", to: "19:00" },
  { day: 5, open: true,  from: "09:00", to: "19:00" },
  { day: 6, open: true,  from: "09:00", to: "17:00" },
]

function describeDbError(scope: string, err: unknown): string {
  if (!err) return `${scope}: unknown database error`
  if (typeof err === "string") return `${scope}: ${err}`
  if (err instanceof Error) return `${scope}: ${err.message}`
  const anyErr = err as {
    message?: unknown
    code?: unknown
    details?: unknown
    hint?: unknown
  }
  const message = typeof anyErr.message === "string" ? anyErr.message : ""
  const code = typeof anyErr.code === "string" ? anyErr.code : ""
  const details = typeof anyErr.details === "string" ? anyErr.details : ""
  const hint = typeof anyErr.hint === "string" ? anyErr.hint : ""
  const parts = [message, code, details, hint].filter(Boolean)
  return parts.length > 0
    ? `${scope}: ${parts.join(" | ")}`
    : `${scope}: ${JSON.stringify(err)}`
}

function mapSettings(row: Record<string, unknown>): CalendarSettingsRow {
  const wh = (row.working_hours ?? row.workingHours) as
    | { tz?: string; schedule?: unknown }
    | null
    | undefined
  const schedule = Array.isArray(wh?.schedule)
    ? (wh!.schedule as unknown[]).map((d) => {
        const r = (d ?? {}) as Record<string, unknown>
        return {
          day: Number(r.day ?? 0),
          open: Boolean(r.open),
          from: typeof r.from === "string" ? r.from : "09:00",
          to: typeof r.to === "string" ? r.to : "17:00",
        } satisfies DaySchedule
      })
    : DEFAULT_SCHEDULE
  const offsetsRaw = row.reminder_offsets_minutes ?? row.reminderOffsetsMinutes
  const offsets = Array.isArray(offsetsRaw)
    ? (offsetsRaw as unknown[]).map((n) => Number(n)).filter((n) => Number.isFinite(n))
    : [1440, 60]
  return {
    id: String(row.id),
    userId: String(row.user_id ?? row.userId ?? ""),
    spaId: String(row.spa_id ?? row.spaId ?? "default"),
    bookingDurationMinutes:
      typeof row.booking_duration_minutes === "number"
        ? row.booking_duration_minutes
        : Number(row.bookingDurationMinutes ?? 30),
    bufferMinutes:
      typeof row.buffer_minutes === "number"
        ? row.buffer_minutes
        : Number(row.bufferMinutes ?? 15),
    workingHours: {
      tz: typeof wh?.tz === "string" ? wh.tz : "America/Los_Angeles",
      schedule: schedule.length > 0 ? schedule : DEFAULT_SCHEDULE,
    },
    reminderOffsetsMinutes: offsets.length > 0 ? offsets : [1440, 60],
    enabled: row.enabled === undefined ? true : Boolean(row.enabled),
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? new Date().toISOString()),
  }
}

function mapBooking(row: Record<string, unknown>): CalendarBookingRow {
  return {
    id: String(row.id),
    userId: String(row.user_id ?? row.userId ?? ""),
    spaId: String(row.spa_id ?? row.spaId ?? "default"),
    leadId: typeof row.lead_id === "string" ? (row.lead_id as string) : null,
    source: ((row.source as CalendarBookingRow["source"]) ?? "widget"),
    startAt: String(row.start_at ?? row.startAt),
    endAt: String(row.end_at ?? row.endAt),
    durationMinutes:
      typeof row.duration_minutes === "number"
        ? row.duration_minutes
        : Number(row.durationMinutes ?? 30),
    service: String(row.service ?? "Consultation"),
    notes: typeof row.notes === "string" ? row.notes : null,
    status: (row.status as CalendarBookingRow["status"]) ?? "confirmed",
    cancelledAt: typeof row.cancelled_at === "string" ? row.cancelled_at : null,
    cancelReason: typeof row.cancel_reason === "string" ? row.cancel_reason : null,
    createdAt: String(row.created_at ?? row.createdAt),
    updatedAt: String(row.updated_at ?? row.updatedAt),
  }
}

export async function getCalendarSettings(spaId: string): Promise<CalendarSettingsRow | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("calendar_settings")
    .select("*")
    .eq("spa_id", spaId)
    .maybeSingle()
  if (error) {
    console.error(describeDbError("getCalendarSettings", error))
    return null
  }
  if (!data) return null
  return mapSettings(data as Record<string, unknown>)
}

export async function getOrCreateCalendarSettings(
  spaId: string,
): Promise<CalendarSettingsRow> {
  const existing = await getCalendarSettings(spaId)
  if (existing) return existing
  const admin = createAdminClient()
  const { data: install } = await admin
    .from("widget_installs")
    .select("user_id")
    .eq("widget_key", spaId)
    .limit(1)
    .maybeSingle()
  const userId = (install as { user_id?: string } | null)?.user_id
  if (!userId) throw new Error("Calendar owner could not be resolved")
  const { data, error } = await admin
    .from("calendar_settings")
    .insert({ spa_id: spaId, user_id: userId } as never)
    .select("*")
    .single()
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create calendar settings")
  }
  return mapSettings(data as Record<string, unknown>)
}

export type CalendarSettingsUpdate = {
  bookingDurationMinutes?: number
  bufferMinutes?: number
  workingHours?: { tz: string; schedule: DaySchedule[] }
  reminderOffsetsMinutes?: number[]
  enabled?: boolean
}

export async function updateCalendarSettings(
  spaId: string,
  updates: CalendarSettingsUpdate,
): Promise<CalendarSettingsRow> {
  const admin = createAdminClient()
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.bookingDurationMinutes !== undefined)
    payload.booking_duration_minutes = updates.bookingDurationMinutes
  if (updates.bufferMinutes !== undefined)
    payload.buffer_minutes = updates.bufferMinutes
  if (updates.workingHours !== undefined)
    payload.working_hours = updates.workingHours
  if (updates.reminderOffsetsMinutes !== undefined)
    payload.reminder_offsets_minutes = updates.reminderOffsetsMinutes
  if (updates.enabled !== undefined) payload.enabled = updates.enabled
  const { data, error } = await admin
    .from("calendar_settings")
    .update(payload as never)
    .eq("spa_id", spaId)
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Failed to update calendar settings")
  return mapSettings(data as Record<string, unknown>)
}

function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map((n) => Number(n))
  return { h: Number.isFinite(h) ? h : 9, m: Number.isFinite(m) ? m : 0 }
}

export type Slot = {
  start: string
  end: string
  startLabel: string
  dateKey: string
}

export async function listBookingsInRange(
  spaId: string,
  fromIso: string,
  toIso: string,
): Promise<CalendarBookingRow[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("calendar_bookings")
    .select("*")
    .eq("spa_id", spaId)
    .gte("start_at", fromIso)
    .lte("start_at", toIso)
    .neq("status", "cancelled")
    .order("start_at", { ascending: true })
  if (error) {
    console.error(describeDbError("listBookingsInRange", error))
    return []
  }
  return (data ?? []).map((r) => mapBooking(r as Record<string, unknown>))
}

export type GenerateSlotsInput = {
  spaId: string
  days?: number
  fromDate?: Date
}

export type GenerateSlotsResult = {
  ok: boolean
  timezone: string
  days: { key: string; label: string; iso: string }[]
  slots: Slot[]
  durationMinutes: number
  error?: string
}

export async function generateSlots(
  input: GenerateSlotsInput,
): Promise<GenerateSlotsResult> {
  const settings = await getCalendarSettings(input.spaId)
  if (!settings) {
    return {
      ok: false,
      timezone: "UTC",
      days: [],
      slots: [],
      durationMinutes: 30,
      error: "Calendar not configured for this spa",
    }
  }
  if (!settings.enabled) {
    return {
      ok: false,
      timezone: settings.workingHours.tz,
      days: [],
      slots: [],
      durationMinutes: settings.bookingDurationMinutes,
      error: "Calendar is disabled",
    }
  }
  const days = Math.min(Math.max(input.days ?? 7, 1), 30)
  const start = input.fromDate ? new Date(input.fromDate) : new Date()
  start.setSeconds(0, 0)
  const windowEnd = new Date(start)
  windowEnd.setDate(windowEnd.getDate() + days)
  const existing = await listBookingsInRange(
    input.spaId,
    start.toISOString(),
    windowEnd.toISOString(),
  )

  const out: Slot[] = []
  const dayKeys: { key: string; label: string; iso: string }[] = []
  const now = Date.now()
  const stepMs = (settings.bookingDurationMinutes + settings.bufferMinutes) * 60_000
  const durationMs = settings.bookingDurationMinutes * 60_000

  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const dow = d.getDay()
    const daySchedule = settings.workingHours.schedule.find((s) => s.day === dow)
    if (!daySchedule || !daySchedule.open) continue
    const { h: sh, m: sm } = parseHHMM(daySchedule.from)
    const { h: eh, m: em } = parseHHMM(daySchedule.to)
    const dayStart = new Date(d)
    dayStart.setHours(sh, sm, 0, 0)
    const dayEnd = new Date(d)
    dayEnd.setHours(eh, em, 0, 0)
    const key = d.toISOString().slice(0, 10)
    dayKeys.push({
      key,
      label: d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      iso: key,
    })
    for (let t = dayStart.getTime(); t + durationMs <= dayEnd.getTime(); t += stepMs) {
      if (t < now) continue
      const slotStart = new Date(t)
      const slotEnd = new Date(t + durationMs)
      const overlaps = existing.some((b) => {
        const bs = new Date(b.startAt).getTime()
        const be = new Date(b.endAt).getTime()
        return slotStart.getTime() < be && slotEnd.getTime() > bs
      })
      if (overlaps) continue
      out.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        startLabel: slotStart.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        dateKey: key,
      })
    }
  }

  return {
    ok: true,
    timezone: settings.workingHours.tz,
    days: dayKeys,
    slots: out,
    durationMinutes: settings.bookingDurationMinutes,
  }
}

export type CreateBookingInput = {
  spaId: string
  leadId?: string | null
  source?: "widget" | "api" | "lead" | "manual"
  startAtIso: string
  durationMinutes?: number
  service?: string
  notes?: string | null
}

export type CreateBookingResult =
  | { ok: true; booking: CalendarBookingRow; reminders: CalendarReminderRow[] }
  | { ok: false; error: string }

export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const startAt = new Date(input.startAtIso)
  if (Number.isNaN(startAt.getTime())) {
    return { ok: false, error: "Invalid start time" }
  }
  const settings = await getOrCreateCalendarSettings(input.spaId)
  if (!settings.enabled) {
    return { ok: false, error: "Calendar is disabled" }
  }
  const duration =
    typeof input.durationMinutes === "number" && input.durationMinutes > 0
      ? input.durationMinutes
      : settings.bookingDurationMinutes
  const endAt = new Date(startAt.getTime() + duration * 60_000)

  const conflict = await listBookingsInRange(
    input.spaId,
    new Date(startAt.getTime() - duration * 60_000).toISOString(),
    new Date(endAt.getTime() + duration * 60_000).toISOString(),
  )
  const overlaps = conflict.some((b) => {
    if (input.leadId && b.leadId === input.leadId) return false
    const bs = new Date(b.startAt).getTime()
    const be = new Date(b.endAt).getTime()
    return startAt.getTime() < be && endAt.getTime() > bs
  })
  if (overlaps) {
    return { ok: false, error: "That time slot is no longer available" }
  }

  const admin = createAdminClient()
  const payload = {
    user_id: settings.userId,
    spa_id: input.spaId,
    lead_id: input.leadId ?? null,
    source: input.source ?? "widget",
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    duration_minutes: duration,
    service: input.service ?? "Consultation",
    notes: input.notes ?? null,
    timezone: settings.workingHours.tz,
    status: "confirmed",
  }
  const { data: existing } = input.leadId
    ? await admin
        .from("calendar_bookings")
        .select("id")
        .eq("user_id", settings.userId)
        .eq("lead_id", input.leadId)
        .in("status", ["pending", "booked", "confirmed"])
        .limit(1)
        .maybeSingle()
    : { data: null }
  const existingId = (existing as { id?: string } | null)?.id
  const mutation = existingId
    ? admin.from("calendar_bookings").update(payload as never).eq("id", existingId)
    : admin.from("calendar_bookings").insert(payload as never)
  const { data, error } = await mutation.select("*").single()
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create booking" }
  }
  const booking = mapBooking(data as Record<string, unknown>)

  const { data: reminderRows } = await admin
    .from("calendar_reminders")
    .select("*")
    .eq("booking_id", booking.id)
  const reminders = ((reminderRows ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    bookingId: String(r.booking_id),
    channel: String(r.channel) as "email" | "sms",
    recipient: String(r.recipient),
    sendAt: String(r.send_at),
    sentAt: typeof r.sent_at === "string" ? r.sent_at : null,
    error: typeof r.error === "string" ? r.error : null,
    attempts: Number(r.attempts ?? 0),
    createdAt: String(r.created_at),
  }))

  return { ok: true, booking, reminders }
}

export async function listBookings(
  spaId: string,
  opts: { limit?: number; fromIso?: string; toIso?: string } = {},
): Promise<CalendarBookingRow[]> {
  const admin = createAdminClient()
  let q = admin
    .from("calendar_bookings")
    .select("*")
    .eq("spa_id", spaId)
    .order("start_at", { ascending: true })
    .limit(opts.limit ?? 100)
  if (opts.fromIso) q = q.gte("start_at", opts.fromIso)
  if (opts.toIso) q = q.lte("start_at", opts.toIso)
  const { data, error } = await q
  if (error) {
    console.error(describeDbError("listBookings", error))
    return []
  }
  return (data ?? []).map((r) => mapBooking(r as Record<string, unknown>))
}

export async function cancelBooking(
  spaId: string,
  bookingId: string,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin
    .from("calendar_bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason ?? null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", bookingId)
    .eq("spa_id", spaId)
  if (error) return { ok: false, error: error.message }
  await admin
    .from("calendar_reminders")
    .delete()
    .eq("booking_id", bookingId)
  return { ok: true }
}

export function planHasCalendar(planId: string | null | undefined): boolean {
  if (!planId) return false
  if (!isKnownPlanId(planId)) return true
  return planAllowsFeature(planId, "calendar_support")
}

function isKnownPlanId(planId: string): planId is PlanId {
  return planId === "starter" || planId === "growth" || planId === "pro"
}
