import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { mapLead } from "@/lib/supabase/types"
import type { Lead, TranscriptMessage } from "@/lib/supabase/types"
import {
  findDuplicateLead,
  mergeIncomingIntoLead,
  normalizeContact,
} from "@/lib/leads/dedup"
import { createBooking } from "@/lib/calendar"
import { checkEmbedAccess } from "@/lib/widget/access"

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T/

export type CreatePublicLeadInput = {
  name: string
  phone: string
  email: string
  service: string
  preferredTime: string
  notes?: string
  sourceUrl?: string
  transcript?: TranscriptMessage[]
  consentGiven: boolean
  afterHours: boolean
  sessionId?: string
  source?: "Website Chat" | "Mobile" | "Direct Link"
  spaId?: string
  userId?: string
}

export type CreatePublicLeadResult = {
  lead: Lead
  merged: boolean
  mergedFromLeadId?: string
}

export async function createPublicLead(
  input: CreatePublicLeadInput,
): Promise<CreatePublicLeadResult> {
  const admin = createAdminClient()

  const contact = normalizeContact({ phone: input.phone, email: input.email })
  const existing = await findDuplicateLead(contact, { userId: input.userId })

  if (existing) {
    const result = await mergeIncomingIntoLead(existing.id, {
      name: input.name.trim() || "Visitor",
      phone: input.phone.trim(),
      email: input.email.trim(),
      service: input.service.trim() || "Not specified",
      preferredTime: input.preferredTime.trim() || "Not specified",
      notes: input.notes ?? null,
      source: input.source ?? "Website Chat",
      sourceUrl: (input.sourceUrl || "/").slice(0, 2000),
      afterHours: Boolean(input.afterHours),
      consentGiven: Boolean(input.consentGiven),
      transcript: input.transcript ?? [],
    })
    // If the visitor came back and booked a specific time slot,
    // promote the existing lead out of "new" so the dashboard inbox
    // doesn't keep surfacing them as a fresh lead.
    const bookedLead = await maybePromoteLeadOnBooking(
      result.lead,
      input.preferredTime,
    )
    await maybeAutoBookFromLead({
      spaId: input.spaId,
      lead: bookedLead,
      preferredTime: input.preferredTime,
      service: input.service,
    })
    return {
      lead: bookedLead,
      merged: true,
      mergedFromLeadId: existing.id,
    }
  }

  const payload = {
    user_id: input.userId ?? null,
    name: input.name.trim() || "Visitor",
    phone: input.phone.trim(),
    email: input.email.trim(),
    phone_normalized: contact.phone,
    email_normalized: contact.email,
    service: input.service.trim() || "Not specified",
    preferred_time: input.preferredTime.trim() || "Not specified",
    source: (input.source ?? "Website Chat") as "Website Chat" | "Mobile" | "Direct Link",
    source_url: (input.sourceUrl || "/").slice(0, 2000),
    after_hours: Boolean(input.afterHours),
    notes: input.notes ?? null,
    transcript: input.transcript ?? [],
    consent_given: Boolean(input.consentGiven),
    // New leads where the visitor picked a concrete time slot start
    // life as "booked" so the inbox doesn't immediately treat them as
    // untouched. Free-form time requests (e.g. "next Tuesday") stay
    // as "new" until a human moves them.
    status: (ISO_DATETIME_RE.test(input.preferredTime.trim())
      ? "booked"
      : "new") as "new" | "contacted" | "booked" | "lost",
  }

  const { data, error } = await admin
    .from("leads")
    .insert(payload as never)
    .select()
    .single()

  if (error) throw new Error(error.message)
  const lead = mapLead(data as Record<string, unknown>)

  await maybeAutoBookFromLead({
    spaId: input.spaId,
    lead,
    preferredTime: input.preferredTime,
    service: input.service,
  })

  return { lead, merged: false }
}

/**
 * If the incoming `preferredTime` is a concrete ISO timestamp, the
 * visitor is committing to a real slot. Promote the lead to "booked"
 * (unless it's already in a terminal state like "lost") so the
 * dashboard inbox reflects the new commitment.
 */
async function maybePromoteLeadOnBooking(
  lead: Lead,
  preferredTime: string,
): Promise<Lead> {
  const trimmed = preferredTime?.trim() ?? ""
  if (!ISO_DATETIME_RE.test(trimmed)) return lead
  if (lead.status === "booked" || lead.status === "lost") {
    return lead
  }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("leads")
    .update({
      status: "booked",
      last_activity_at: new Date().toISOString(),
    } as never)
    .eq("id", lead.id)
    .select()
    .maybeSingle()
  if (error || !data) return lead
  return mapLead(data as Record<string, unknown>)
}

/**
 * If the lead carries a parseable preferred time and we know which spa it
 * belongs to, automatically create a calendar booking so it shows up on the
 * dashboard's calendar. Failures are logged but never bubble up — lead
 * capture must not be blocked by the calendar feature.
 *
 * Important: the spaId comes from the public request body. We must verify the
 * install is still active and entitled before we write anything to that spa's
 * calendar. checkEmbedAccess returns the owner + subscription snapshot; we
 * use that as a cheap authorization gate so unauthenticated callers can't
 * inject bookings into arbitrary spas.
 */
async function maybeAutoBookFromLead(args: {
  spaId?: string
  lead: Lead
  preferredTime: string
  service: string
}): Promise<void> {
  if (!args.spaId) return
  // Authorization: confirm the spa is active and entitled.
  let access
  try {
    access = await checkEmbedAccess(args.spaId)
  } catch (e) {
    console.error("auto-book authorization check failed", e)
    return
  }
  if (!access.ok) {
    console.warn(
      `auto-book skipped: spa ${args.spaId} not accessible (${access.reason})`,
    )
    return
  }
  // Consent: never auto-book a lead the visitor refused to share.
  if (!args.lead.consentGiven) return
  const iso = parsePreferredTimeToIso(args.preferredTime)
  if (!iso) return
  try {
    await createBooking({
      spaId: args.spaId,
      leadId: args.lead.id,
      source: "lead",
      startAtIso: iso,
      service: args.service || args.lead.service || "Consultation",
      notes: `Auto-booked from lead capture (preferred time: ${args.preferredTime})`,
    })
  } catch (e) {
    console.error("auto-book from lead failed", e)
  }
}

const RELATIVE_DAY_MS: Record<string, number> = {
  today: 0,
  tonight: 0,
  tomorrow: 1,
  "day after tomorrow": 2,
}

const TIME_OF_DAY_HOUR: Array<[RegExp, number]> = [
  [/morning/i, 9],
  [/afternoon/i, 14],
  [/evening/i, 18],
  [/noon/i, 12],
  [/midnight/i, 0],
]

const CLOCK_RE = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i

function parsePreferredTimeToIso(raw: string): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed || /^not\s+specified$/i.test(trimmed)) return null

  // Direct parse (ISO, RFC2822, locale strings, etc.)
  const direct = new Date(trimmed)
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString()
  }

  const now = new Date()

  const lower = trimmed.toLowerCase()

  // Relative day keywords
  let dayOffset: number | null = null
  for (const [key, offset] of Object.entries(RELATIVE_DAY_MS)) {
    if (lower.includes(key)) {
      dayOffset = offset
      break
    }
  }

  // Weekday names: next <weekday> or just <weekday>
  const weekdayMatch = lower.match(
    /\b(next\s+)?(sun|mon|tue|wed|thu|fri|sat)(?:day|s)?\b/,
  )
  if (weekdayMatch) {
    const names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
    const target = names.indexOf(weekdayMatch[2])
    const current = now.getDay()
    let diff = (target - current + 7) % 7
    if (weekdayMatch[1] || diff === 0) diff = diff === 0 ? 7 : diff
    dayOffset = diff
  }

  // Time of day
  let hour: number | null = null
  let minute = 0
  const clock = lower.match(CLOCK_RE)
  if (clock) {
    hour = Number(clock[1])
    minute = clock[2] ? Number(clock[2]) : 0
    const ampm = clock[3]?.toLowerCase()
    if (ampm === "pm" && hour < 12) hour += 12
    if (ampm === "am" && hour === 12) hour = 0
  } else {
    for (const [re, h] of TIME_OF_DAY_HOUR) {
      if (re.test(lower)) {
        hour = h
        break
      }
    }
  }

  if (dayOffset === null && hour === null) return null

  const target = new Date(now)
  if (dayOffset !== null) {
    target.setDate(now.getDate() + dayOffset)
  }
  if (hour !== null) {
    target.setHours(hour, minute, 0, 0)
  } else {
    target.setHours(9, 0, 0, 0)
  }

  if (target.getTime() < now.getTime() - 60_000) return null
  return target.toISOString()
}

export async function appendTranscriptToLead(
  leadId: string,
  transcript: TranscriptMessage[],
): Promise<Lead> {
  const admin = createAdminClient()
  const { data: existing, error: fetchErr } = await admin
    .from("leads")
    .select("transcript, merged_into_id")
    .eq("id", leadId)
    .maybeSingle()
  if (fetchErr) throw new Error(fetchErr.message)

  // If this lead is itself merged into another, write through to the primary.
  const targetId =
    (existing as { merged_into_id?: string | null } | null)?.merged_into_id || leadId

  const { data: target, error: targetErr } = await admin
    .from("leads")
    .select("transcript")
    .eq("id", targetId)
    .maybeSingle()
  if (targetErr) throw new Error(targetErr.message)

  const prior: TranscriptMessage[] = Array.isArray(
    (target as { transcript?: unknown } | null)?.transcript,
  )
    ? ((target as unknown as { transcript: TranscriptMessage[] }).transcript)
    : []

  const merged = [...prior, ...transcript].slice(-200)

  const { data, error } = await admin
    .from("leads")
    .update({
      transcript: merged,
      last_activity_at: new Date().toISOString(),
    } as never)
    .eq("id", targetId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapLead(data as Record<string, unknown>)
}
