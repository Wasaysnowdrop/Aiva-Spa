"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  findDuplicateLead,
  getDuplicateGroups,
  mergeLeads as mergeLeadsServer,
  normalizeContact,
  unmergeLead as unmergeLeadServer,
  type MergeLeadsOptions,
} from "@/lib/leads/dedup"
import { recordAudit } from "@/lib/audit"
import type { Lead, MergedLeadEntry } from "@/lib/supabase/types"
import { fireEventForAll } from "@/lib/webhooks"
import { sendEmail, buildLeadNotificationEmail } from "@/lib/notifications/email"
import { sendSms, buildLeadNotificationSms } from "@/lib/notifications/sms"
import { loadKnowledge } from "@/lib/ai/conversation"

export type MergeFieldChoice = {
  field: "name" | "phone" | "email" | "service" | "preferredTime" | "notes"
  pickFromLeadId: string
}

export type LeadActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login?redirectTo=/dashboard/leads")
  return user
}

export type FindDuplicateResult = {
  duplicate: Lead | null
  matchType: "phone" | "email" | "none"
}

export async function findDuplicateAction(input: {
  phone?: string
  email?: string
  excludeLeadId?: string
}): Promise<LeadActionResult<FindDuplicateResult>> {
  await requireUser()
  try {
    const phone = input.phone?.trim() ?? ""
    const email = input.email?.trim() ?? ""
    if (!phone && !email) {
      return {
        ok: true,
        data: { duplicate: null, matchType: "none" },
      }
    }
    const contact = normalizeContact({ phone, email })
    const dup = await findDuplicateLead(contact, {
      excludeLeadId: input.excludeLeadId,
    })
    let matchType: FindDuplicateResult["matchType"] = "none"
    if (dup) {
      if (
        phone &&
        dup.phoneNormalized === phone.replace(/\D/g, "").slice(-10)
      ) {
        matchType = "phone"
      } else if (email && dup.emailNormalized === email.toLowerCase()) {
        matchType = "email"
      }
    }
    return { ok: true, data: { duplicate: dup, matchType } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Lookup failed" }
  }
}

export async function getDuplicateGroupsAction(): Promise<
  LeadActionResult<
    Array<{
      matchKey: string
      matchType: "phone" | "email"
      value: string
      leadIds: string[]
    }>
  >
> {
  await requireUser()
  try {
    const groups = await getDuplicateGroups(100)
    return {
      ok: true,
      data: groups.map((g) => ({
        matchKey: g.matchKey,
        matchType: g.matchType,
        value: g.value,
        leadIds: g.leads.map((l) => l.id),
      })),
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Lookup failed" }
  }
}

export async function mergeLeadsAction(input: {
  primaryLeadId: string
  secondaryLeadIds: string[]
  fieldChoices?: MergeFieldChoice[]
  notesAppend?: string
  transcriptMerge?: "append" | "keep-primary"
}): Promise<LeadActionResult<{ primary: Lead; merged: Lead[] }>> {
  await requireUser()
  if (!input.primaryLeadId || input.secondaryLeadIds.length === 0) {
    return { ok: false, error: "Pick a primary and at least one duplicate to merge." }
  }
  if (input.secondaryLeadIds.includes(input.primaryLeadId)) {
    return { ok: false, error: "Primary lead cannot also be a duplicate." }
  }
  try {
    const result = await mergeLeadsServer(input as MergeLeadsOptions)

    void recordAudit({
      userName: "dashboard",
      action: `leads.merged primary=${result.primary.id} secondaries=${result.merged
        .map((l) => l.id)
        .join(",")} (added ${result.transcriptMessagesAdded} transcript messages)`,
    })

    void fireEventForAll("lead.merged", {
      primary: {
        id: result.primary.id,
        name: result.primary.name,
        phone: result.primary.phone,
        email: result.primary.email,
        service: result.primary.service,
        preferredTime: result.primary.preferredTime,
        source: result.primary.source,
        sourceUrl: result.primary.sourceUrl,
        afterHours: result.primary.afterHours,
        createdAt: result.primary.createdAt,
        mergedFrom: result.primary.mergedFrom ?? [],
      },
      mergedIds: result.merged.map((l) => l.id),
      transcriptMessagesAdded: result.transcriptMessagesAdded,
    })

    revalidatePath("/dashboard/leads")
    for (const s of result.merged) {
      revalidatePath(`/dashboard/leads/${s.id}`)
    }
    revalidatePath(`/dashboard/leads/${result.primary.id}`)

    return { ok: true, data: { primary: result.primary, merged: result.merged } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Merge failed" }
  }
}

export async function unmergeLeadAction(secondaryLeadId: string): Promise<LeadActionResult> {
  await requireUser()
  try {
    await unmergeLeadServer(secondaryLeadId)
    void recordAudit({
      userName: "dashboard",
      action: `leads.unmerged ${secondaryLeadId}`,
    })
    revalidatePath("/dashboard/leads")
    revalidatePath(`/dashboard/leads/${secondaryLeadId}`)
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unmerge failed" }
  }
}

export type MergeHistoryEntry = MergedLeadEntry

export async function updateLeadNotesAction(
  leadId: string,
  notes: string,
): Promise<LeadActionResult<{ notes: string }>> {
  await requireUser()
  if (!leadId) return { ok: false, error: "Missing lead id" }
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("leads")
      .update({ notes, last_activity_at: new Date().toISOString() } as never)
      .eq("id", leadId)
      .select()
      .maybeSingle()
    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: false, error: "Lead not found" }
    void recordAudit({
      userName: "dashboard",
      action: `leads.notes_updated ${leadId} (${notes.length} chars)`,
    })
    void fireEventForAll("lead.updated", {
      id: leadId,
      notes,
    })
    revalidatePath(`/dashboard/leads/${leadId}`)
    return { ok: true, data: { notes } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save notes" }
  }
}

export type SendLeadMessageInput = {
  leadId: string
  channel: "email" | "sms"
  body: string
}

export type SendLeadMessageResult = {
  delivered: boolean
  channel: "email" | "sms"
  recipient: string
}

export async function sendLeadMessageAction(
  input: SendLeadMessageInput,
): Promise<LeadActionResult<SendLeadMessageResult>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Not authenticated" }
  }
  if (!input.leadId) return { ok: false, error: "Missing lead id" }
  if (!input.body?.trim()) return { ok: false, error: "Message body is required" }
  if (input.body.length > 2000) {
    return { ok: false, error: "Message is too long (max 2000 chars)" }
  }

  try {
    const { data: leadRow, error: leadErr } = await supabase
      .from("leads")
      .select("id, name, phone, email, service, preferred_time, source_url, after_hours, transcript")
      .eq("id", input.leadId)
      .maybeSingle()
    if (leadErr) return { ok: false, error: leadErr.message }
    if (!leadRow) return { ok: false, error: "Lead not found" }

    const lead = leadRow as {
      id: string
      name: string
      phone: string
      email: string
      service: string
      preferred_time: string
      source_url: string
      after_hours: boolean
      transcript: unknown
    }

    const recipient =
      input.channel === "email" ? lead.email : lead.phone
    if (!recipient) {
      return {
        ok: false,
        error: `Lead has no ${input.channel === "email" ? "email" : "phone"} on file`,
      }
    }

    const kb = await loadKnowledge()
    const brandName = kb.widget.brandName

    let result: { ok: boolean; error?: string } = { ok: false }
    if (input.channel === "email") {
      const { subject, text, html } = buildLeadNotificationEmail({
        brandName,
        leadName: lead.name,
        service: lead.service,
        preferredTime: lead.preferred_time,
        phone: lead.phone,
        email: lead.email,
        sourceUrl: lead.source_url,
        afterHours: lead.after_hours,
        transcriptExcerpt: undefined,
      })
      const body = `${text}\n\n— ${brandName} team\n\n${input.body.trim()}`
      const html2 = `${html}<hr/><p style="margin-top:16px;color:#475569">${escapeHtml(input.body.trim())}</p>`
      const r = await sendEmail({ to: recipient, subject, text: body, html: html2 })
      result = r
    } else {
      const body = `${buildLeadNotificationSms({
        brandName,
        leadName: lead.name,
        service: lead.service,
        phone: lead.phone,
      })}\n\n${input.body.trim()}`
      const r = await sendSms({ to: recipient, body })
      result = r
    }

    if (!result.ok) {
      return { ok: false, error: result.error || `Failed to send ${input.channel}` }
    }

    void recordAudit({
      userName: user.email?.split("@")[0] || user.id,
      action: `leads.message_sent ${input.leadId} via ${input.channel} (${input.body.length} chars)`,
    })

    revalidatePath(`/dashboard/leads/${input.leadId}`)
    return {
      ok: true,
      data: {
        delivered: true,
        channel: input.channel,
        recipient,
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to send message",
    }
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
