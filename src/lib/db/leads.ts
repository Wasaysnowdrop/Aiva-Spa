import { createClient } from "@/lib/supabase/client"
import type {
  Lead,
  LeadStatus,
  TranscriptMessage,
} from "@/lib/supabase/types"
import { mapLead } from "@/lib/supabase/types"
import { recordAudit } from "@/lib/audit"

export type LeadInsert = Omit<
  Lead,
  "id" | "createdAt" | "lastActivityAt"
> & {
  transcript?: TranscriptMessage[]
}

export type LeadUpdate = Partial<LeadInsert> & { id: string }

function toSnake(lead: Partial<LeadInsert>): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if ("name" in lead) payload.name = lead.name
  if ("phone" in lead) payload.phone = lead.phone
  if ("email" in lead) payload.email = lead.email
  if ("service" in lead) payload.service = lead.service
  if ("preferredTime" in lead) payload.preferred_time = lead.preferredTime
  if ("status" in lead) payload.status = lead.status
  if ("source" in lead) payload.source = lead.source
  if ("sourceUrl" in lead) payload.source_url = lead.sourceUrl
  if ("afterHours" in lead) payload.after_hours = lead.afterHours
  if ("notes" in lead) payload.notes = lead.notes ?? null
  if ("transcript" in lead) payload.transcript = lead.transcript ?? []
  if ("assignedTo" in lead) payload.assigned_to = lead.assignedTo ?? null
  if ("consentGiven" in lead) payload.consent_given = lead.consentGiven
  return payload
}

export type GetLeadsOptions = {
  includeMerged?: boolean
}

export async function getLeads(options: GetLeadsOptions = {}): Promise<Lead[]> {
  const supabase = createClient()
  let query = supabase.from("leads").select("*").order("created_at", { ascending: false })

  if (!options.includeMerged) {
    query = query.is("merged_into_id", null)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapLead(row as Record<string, unknown>))
}

export async function getLead(id: string): Promise<Lead | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapLead(data as Record<string, unknown>) : null
}

export async function getLeadMergedChildren(primaryId: string): Promise<Lead[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("merged_into_id", primaryId)
    .order("merged_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapLead(row as Record<string, unknown>))
}

export async function createLead(lead: LeadInsert): Promise<Lead> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("leads")
    .insert(toSnake(lead) as never)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapLead(data as Record<string, unknown>)
}

export async function updateLead(update: LeadUpdate): Promise<Lead> {
  const supabase = createClient()
  const { id, ...rest } = update
  const { data, error } = await supabase
    .from("leads")
    .update(toSnake(rest) as never)
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapLead(data as Record<string, unknown>)
}

export async function deleteLead(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("leads").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

export async function updateLeadStatus(
  id: string,
  status: LeadStatus,
): Promise<Lead> {
  const result = await updateLead({ id, status })
  void recordAudit({
    userName: "dashboard",
    action: `lead.status_changed ${id} -> ${status}`,
  })
  return result
}

export type RealtimeLeadEvent = {
  eventType: "INSERT" | "UPDATE" | "DELETE"
  new: Lead | null
  old: Lead | null
}

