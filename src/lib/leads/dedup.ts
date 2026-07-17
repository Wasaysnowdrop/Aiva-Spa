import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { mapLead } from "@/lib/supabase/types"
import type { Lead, TranscriptMessage } from "@/lib/supabase/types"
import type { NormalizedContact } from "@/lib/leads/dedup-shared"

export {
  normalizeContact,
  normalizePhone,
  normalizeEmail,
  type NormalizedContact,
} from "@/lib/leads/dedup-shared"

function buildMatchFilters(contact: NormalizedContact): string[] {
  const filters: string[] = []
  if (contact.phone) filters.push(`phone_normalized.eq.${contact.phone}`)
  if (contact.email) filters.push(`email_normalized.eq.${contact.email}`)
  return filters
}

export type FindDuplicateOptions = {
  excludeLeadId?: string
  limit?: number
  userId?: string
}

export async function findDuplicateLead(
  contact: NormalizedContact,
  options: FindDuplicateOptions = {},
): Promise<Lead | null> {
  const admin = createAdminClient()
  const filters = buildMatchFilters(contact)
  if (filters.length === 0) return null

  const limit = options.limit ?? 5
  let query = admin
    .from("leads")
    .select("*")
    .is("merged_into_id", null)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (filters.length === 1) {
    if (contact.phone) {
      query = query.eq("phone_normalized", contact.phone)
    } else if (contact.email) {
      query = query.eq("email_normalized", contact.email)
    }
  } else if (filters.length > 1) {
    query = query.or(filters.join(","))
  }

  if (options.excludeLeadId) {
    query = query.neq("id", options.excludeLeadId)
  }
  if (options.userId) {
    query = query.eq("user_id", options.userId)
  }
  query = query.is("deleted_at", null)

  const { data, error } = await query
  if (error || !data || data.length === 0) return null

  return mapLead(data[0] as Record<string, unknown>)
}

export type DuplicateGroup = {
  matchKey: string
  matchType: "phone" | "email"
  value: string
  leads: Lead[]
}

export async function getDuplicateGroups(limit = 200, userId?: string): Promise<DuplicateGroup[]> {
  const admin = createAdminClient()

  // PostgREST `.or()` with bare `column.neq.` filters on NOT NULL columns
  // collapses to "not equal empty string", which is almost every row.
  // Instead, select candidates with a real filter and bucket them in JS.
  let query = admin
    .from("leads")
    .select("id, phone_normalized, email_normalized, name, created_at")
    .is("merged_into_id", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit * 4)
  if (userId) query = query.eq("user_id", userId)
  const { data, error } = await query

  if (error || !data) return []

  type Row = {
    id: string
    phone_normalized: string | null
    email_normalized: string | null
    name: string | null
    created_at: string
  }

  const phoneMap = new Map<string, string[]>()
  const emailMap = new Map<string, string[]>()
  const idToRow = new Map<string, Row>()

  for (const row of data as Row[]) {
    idToRow.set(row.id, row)
    if (row.phone_normalized) {
      const list = phoneMap.get(row.phone_normalized) ?? []
      list.push(row.id)
      phoneMap.set(row.phone_normalized, list)
    }
    if (row.email_normalized) {
      const list = emailMap.get(row.email_normalized) ?? []
      list.push(row.id)
      emailMap.set(row.email_normalized, list)
    }
  }

  const groupIds = new Set<string>()
  const groups: DuplicateGroup[] = []

  for (const [value, ids] of phoneMap) {
    if (ids.length < 2) continue
    const key = `phone:${value}`
    if (groupIds.has(key)) continue
    groupIds.add(key)
    const leads: Lead[] = []
    for (const id of ids) {
      const r = idToRow.get(id)
      if (r) leads.push(mapLead(r))
    }
    if (leads.length >= 2) {
      groups.push({
        matchKey: key,
        matchType: "phone",
        value,
        leads,
      })
    }
  }

  for (const [value, ids] of emailMap) {
    if (ids.length < 2) continue
    const key = `email:${value}`
    if (groupIds.has(key)) continue
    groupIds.add(key)
    const leads: Lead[] = []
    for (const id of ids) {
      const r = idToRow.get(id)
      if (r) leads.push(mapLead(r))
    }
    if (leads.length >= 2) {
      groups.push({
        matchKey: key,
        matchType: "email",
        value,
        leads,
      })
    }
  }

  return groups.slice(0, limit)
}

export type MergeFieldChoice = {
  field: "name" | "phone" | "email" | "service" | "preferredTime" | "notes"
  pickFromLeadId: string
}

export type MergeLeadsOptions = {
  userId?: string
  primaryLeadId: string
  secondaryLeadIds: string[]
  fieldChoices?: MergeFieldChoice[]
  notesAppend?: string
  transcriptMerge?: "append" | "keep-primary"
}

export type MergeResult = {
  primary: Lead
  merged: Lead[]
  transcriptMessagesAdded: number
}

function pickFieldValue<T extends string>(
  primary: Lead,
  secondaries: Lead[],
  field: MergeFieldChoice["field"],
  choices: MergeFieldChoice[] | undefined,
  fallback: (lead: Lead) => T,
): T {
  const explicit = choices?.find((c) => c.field === field)
  if (explicit) {
    const from = secondaries.find((l) => l.id === explicit.pickFromLeadId)
    if (from) return fallback(from)
  }

  if (fallback(primary)) return fallback(primary)
  for (const s of secondaries) {
    const v = fallback(s)
    if (v) return v
  }
  return fallback(primary)
}

export async function mergeLeads(options: MergeLeadsOptions): Promise<MergeResult> {
  const admin = createAdminClient()
  const { userId, primaryLeadId, secondaryLeadIds, fieldChoices, notesAppend, transcriptMerge } =
    options

  if (secondaryLeadIds.length === 0) {
    throw new Error("No secondary leads provided to merge")
  }
  if (secondaryLeadIds.includes(primaryLeadId)) {
    throw new Error("Primary lead cannot also be a secondary")
  }

  const ids = [primaryLeadId, ...secondaryLeadIds]
  let fetchQuery = admin
    .from("leads")
    .select("*")
    .in("id", ids)
    .is("deleted_at", null)
  if (userId) fetchQuery = fetchQuery.eq("user_id", userId)
  const { data: rows, error: fetchErr } = await fetchQuery

  if (fetchErr) throw new Error(fetchErr.message)
  if (!rows || rows.length !== ids.length) {
    throw new Error("One or more leads could not be found")
  }

  const all = rows.map((r) => mapLead(r as Record<string, unknown>))
  const primary = all.find((l) => l.id === primaryLeadId)
  if (!primary) throw new Error("Primary lead not found")
  const secondaries = all.filter((l) => l.id !== primaryLeadId)
  if (secondaries.length !== secondaryLeadIds.length) {
    throw new Error("One or more secondary leads not found")
  }

  const mergedAt = new Date().toISOString()

  const mergedFrom = [
    ...(primary.mergedFrom ?? []),
    ...secondaries.map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      email: s.email,
      source: s.source,
      sourceUrl: s.sourceUrl,
      createdAt: s.createdAt,
      mergedAt,
    })),
  ]

  const mergedTranscript: TranscriptMessage[] = (() => {
    if (transcriptMerge === "keep-primary") return [...primary.transcript]
    const stamped = secondaries.flatMap((s) =>
      s.transcript.map((m) => ({
        ...m,
        content: `[from ${s.source} · ${s.name}] ${m.content}`,
      })),
    )
    return [...primary.transcript, ...stamped].slice(-200)
  })()

  const transcriptMessagesAdded =
    transcriptMerge === "keep-primary"
      ? 0
      : secondaries.reduce((sum, s) => sum + s.transcript.length, 0)

  const nextNotes = (() => {
    const appended = notesAppend?.trim()
    const base = pickFieldValue(
      primary,
      secondaries,
      "notes",
      fieldChoices,
      (l) => l.notes ?? "",
    )
    if (appended) return base ? `${base}\n\n— Merged —\n${appended}` : `— Merged —\n${appended}`
    return base
  })()

  const updatePayload = {
    name: pickFieldValue(primary, secondaries, "name", fieldChoices, (l) => l.name),
    phone: pickFieldValue(primary, secondaries, "phone", fieldChoices, (l) => l.phone),
    email: pickFieldValue(primary, secondaries, "email", fieldChoices, (l) => l.email),
    service: pickFieldValue(primary, secondaries, "service", fieldChoices, (l) => l.service),
    preferred_time: pickFieldValue(
      primary,
      secondaries,
      "preferredTime",
      fieldChoices,
      (l) => l.preferredTime,
    ),
    notes: nextNotes || null,
    transcript: mergedTranscript,
    merged_from: mergedFrom,
    last_activity_at: mergedAt,
  }

  let primaryUpdate = admin
    .from("leads")
    .update(updatePayload as never)
    .eq("id", primaryLeadId)
  const ownerId = userId ?? primary.userId
  if (ownerId) primaryUpdate = primaryUpdate.eq("user_id", ownerId)
  const { data: updated, error: updateErr } = await primaryUpdate.select().single()

  if (updateErr) throw new Error(updateErr.message)

  let secondaryUpdate = admin
    .from("leads")
    .update({
      merged_into_id: primaryLeadId,
      merged_at: mergedAt,
      last_activity_at: mergedAt,
    } as never)
    .in("id", secondaryLeadIds)
  if (ownerId) secondaryUpdate = secondaryUpdate.eq("user_id", ownerId)
  const { error: secondaryErr } = await secondaryUpdate

  if (secondaryErr) throw new Error(secondaryErr.message)

  const { data: refreshedSecondaries } = await admin
    .from("leads")
    .select("*")
    .in("id", secondaryLeadIds)

  return {
    primary: mapLead(updated as Record<string, unknown>),
    merged: (refreshedSecondaries ?? []).map((r) => mapLead(r as Record<string, unknown>)),
    transcriptMessagesAdded,
  }
}

export async function unmergeLead(secondaryLeadId: string, userId?: string): Promise<void> {
  const admin = createAdminClient()

  let secondaryQuery = admin
    .from("leads")
    .select("id, merged_into_id, merged_at")
    .eq("id", secondaryLeadId)
  if (userId) secondaryQuery = secondaryQuery.eq("user_id", userId)
  const { data: secondary, error: fetchErr } = await secondaryQuery.maybeSingle()

  if (fetchErr) throw new Error(fetchErr.message)
  if (!secondary) throw new Error("Lead not found")
  const secondaryRow = secondary as unknown as {
    id: string
    merged_into_id: string | null
    merged_at: string | null
  }
  if (!secondaryRow.merged_into_id) throw new Error("Lead is not merged")

  const primaryId = secondaryRow.merged_into_id

  const { data: primary, error: primaryErr } = await admin
    .from("leads")
    .select("merged_from")
    .eq("id", primaryId)
    .maybeSingle()

  if (primaryErr) throw new Error(primaryErr.message)

  const existing = Array.isArray(
    (primary as unknown as { merged_from?: unknown } | null)?.merged_from,
  )
    ? ((primary as unknown as { merged_from: unknown[] }).merged_from)
    : []
  const next = (existing as { id?: string }[]).filter((e) => e?.id !== secondaryLeadId)

  const { error: updatePrimaryErr } = await admin
    .from("leads")
    .update({ merged_from: next } as never)
    .eq("id", primaryId)

  if (updatePrimaryErr) throw new Error(updatePrimaryErr.message)

  const { error: updateSecondaryErr } = await admin
    .from("leads")
    .update({
      merged_into_id: null,
      merged_at: null,
    } as never)
    .eq("id", secondaryLeadId)

  if (updateSecondaryErr) throw new Error(updateSecondaryErr.message)
}

export type IncomingLead = {
  name: string
  phone: string
  email: string
  service: string
  preferredTime: string
  notes?: string | null
  source: "Website Chat" | "Mobile" | "Direct Link"
  sourceUrl: string
  afterHours: boolean
  consentGiven: boolean
  transcript?: TranscriptMessage[]
}

export type MergeIncomingResult = {
  lead: Lead
  merged: true
}

/**
 * Merge an incoming (not-yet-persisted) lead into an existing lead row.
 * Used by the public widget when it detects a duplicate at capture time.
 * The existing row stays; incoming data enriches it.
 */
export async function mergeIncomingIntoLead(
  primaryLeadId: string,
  incoming: IncomingLead,
): Promise<MergeIncomingResult> {
  const admin = createAdminClient()

  const { data: existing, error: fetchErr } = await admin
    .from("leads")
    .select("*")
    .eq("id", primaryLeadId)
    .is("merged_into_id", null)
    .maybeSingle()

  if (fetchErr) throw new Error(fetchErr.message)
  if (!existing) throw new Error("Primary lead not found")

  const primary = mapLead(existing as Record<string, unknown>)

  const mergedAt = new Date().toISOString()
  const incomingSource = incoming.source

  const mergedFrom = [
    ...(primary.mergedFrom ?? []),
    {
      id: `incoming_${Date.now()}`,
      name: incoming.name,
      phone: incoming.phone,
      email: incoming.email,
      source: incomingSource,
      sourceUrl: incoming.sourceUrl,
      createdAt: mergedAt,
      mergedAt,
    },
  ]

  const nonEmpty = (v: string | null | undefined) => (v && v.trim() ? v.trim() : "")

  const name = nonEmpty(primary.name) || nonEmpty(incoming.name) || "Visitor"
  const phone = nonEmpty(primary.phone) || nonEmpty(incoming.phone)
  const email = nonEmpty(primary.email) || nonEmpty(incoming.email)
  const service = nonEmpty(primary.service) || nonEmpty(incoming.service) || "Not specified"
  const preferredTime =
    nonEmpty(primary.preferredTime) || nonEmpty(incoming.preferredTime) || "Not specified"

  const notesBase = primary.notes ?? ""
  const notesAppend =
    incoming.notes && incoming.notes.trim()
      ? `[${incomingSource} · ${incoming.name}] ${incoming.notes.trim()}`
      : ""
  const nextNotes = notesBase
    ? notesAppend
      ? `${notesBase}\n\n— Merged —\n${notesAppend}`
      : notesBase
    : notesAppend || null

  const transcriptToAdd = (incoming.transcript ?? []).map((m) => ({
    ...m,
    content: `[from ${incomingSource}] ${m.content}`,
  }))
  const mergedTranscript = [...primary.transcript, ...transcriptToAdd].slice(-200)

  const updatePayload = {
    name,
    phone,
    email,
    service,
    preferred_time: preferredTime,
    notes: nextNotes,
    transcript: mergedTranscript,
    merged_from: mergedFrom,
    consent_given: Boolean(primary.consentGiven || incoming.consentGiven),
    after_hours: Boolean(primary.afterHours || incoming.afterHours),
    last_activity_at: mergedAt,
  }

  let updateQuery = admin
    .from("leads")
    .update(updatePayload as never)
    .eq("id", primaryLeadId)
  if (primary.userId) updateQuery = updateQuery.eq("user_id", primary.userId)
  const { data, error: updateErr } = await updateQuery.select().single()

  if (updateErr) throw new Error(updateErr.message)
  return { lead: mapLead(data as Record<string, unknown>), merged: true }
}
