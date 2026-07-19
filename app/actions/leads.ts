"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  findDuplicateLead,
  getDuplicateGroups,
  mergeLeads as mergeLeadsServer,
  normalizeContact,
  unmergeLead as unmergeLeadServer,
  type MergeLeadsOptions,
} from "@/lib/leads/dedup"
import { recordAudit } from "@/lib/audit"
import { mapLead, type Lead, type MergedLeadEntry, type TeamRole } from "@/lib/supabase/types"
import { roleCan } from "@/lib/team/permissions"
import { fireEventForAll } from "@/lib/webhooks"
import { sendEmail, buildLeadNotificationEmail } from "@/lib/notifications/email"
import { loadKnowledge } from "@/lib/ai/conversation"
import { checkActionLimit } from "@/lib/security/check-action-limit"
import { LIMITS } from "@/lib/security/limits"

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
  const limit = await checkActionLimit(LIMITS.actionLeads)
  if (!limit.ok) return { ok: false, error: limit.error }
  const user = await requireUser()
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
      userId: user.id,
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
  const limit = await checkActionLimit(LIMITS.actionLeads)
  if (!limit.ok) return { ok: false, error: limit.error }
  const user = await requireUser()
  try {
    const groups = await getDuplicateGroups(100, user.id)
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
  const user = await requireUser()
  const limit = await checkActionLimit(LIMITS.actionLeads)
  if (!limit.ok) return { ok: false, error: limit.error }
  if (!input.primaryLeadId || input.secondaryLeadIds.length === 0) {
    return { ok: false, error: "Pick a primary and at least one duplicate to merge." }
  }
  if (input.secondaryLeadIds.includes(input.primaryLeadId)) {
    return { ok: false, error: "Primary lead cannot also be a duplicate." }
  }
  try {
    const result = await mergeLeadsServer({ ...input, userId: user.id } as MergeLeadsOptions)

    void recordAudit({
      userName: "dashboard",
      action: `leads.merged primary=${result.primary.id} secondaries=${result.merged
        .map((l) => l.id)
        .join(",")} (added ${result.transcriptMessagesAdded} transcript messages)`,
    })

    void fireEventForAll(user.id, "lead.merged", {
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
  const user = await requireUser()
  const limit = await checkActionLimit(LIMITS.actionLeads)
  if (!limit.ok) return { ok: false, error: limit.error }
  try {
    await unmergeLeadServer(secondaryLeadId, user.id)
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

export async function updateLeadStatusAction(
  leadId: string,
  next: "new" | "contacted" | "booked" | "lost",
): Promise<LeadActionResult<Lead>> {
  const user = await requireUser()
  const limit = await checkActionLimit(LIMITS.actionLeads)
  if (!limit.ok) return { ok: false, error: limit.error }
  if (!leadId) return { ok: false, error: "Missing lead id" }
  if (!["new", "contacted", "booked", "lost"].includes(next)) {
    return { ok: false, error: "Invalid status" }
  }
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("leads")
      .update({
        status: next,
        last_activity_at: new Date().toISOString(),
      } as never)
      .eq("id", leadId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select()
      .maybeSingle()
    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: false, error: "Lead not found" }
    void recordAudit({
      userName: "dashboard",
      action: `leads.status_updated ${leadId} → ${next}`,
    })
    void fireEventForAll(user.id, "lead.updated", {
      id: leadId,
      status: next,
    })
    revalidatePath("/dashboard/leads")
    revalidatePath(`/dashboard/leads/${leadId}`)
    return { ok: true, data: mapLead(data as Record<string, unknown>) }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update status",
    }
  }
}

export type AssignableMember = {
  teamMemberId: string
  userId: string
  name: string
  email: string
  role: string
}

export type AssignLeadResult = {
  leadId: string
  assignedTo: AssignableMember | null
}

function actorDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> | null }): string {
  const metadata = user.user_metadata as Record<string, unknown> | null
  const fullName = typeof metadata?.full_name === "string" ? metadata.full_name.trim() : ""
  if (fullName) return fullName
  return user.email?.split("@")[0] || "Team member"
}

type ResolvedRole = { role: TeamRole | null; businessId: string }

async function resolveRoleForBusiness(userId: string, businessId: string): Promise<ResolvedRole> {
  if (userId === businessId) return { role: "Owner", businessId }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("team_members")
    .select("role, status, business_id")
    .eq("member_user_id", userId)
    .eq("business_id", businessId)
    .eq("status", "active")
    .maybeSingle()
  if (error || !data) return { role: null, businessId }
  const row = data as { role: TeamRole; status: string }
  return { role: row.role, businessId }
}

export async function assignLeadAction(
  leadId: string,
  teamMemberId: string | null,
): Promise<LeadActionResult<AssignLeadResult>> {
  if (process.env.NODE_ENV !== "production") console.info("LEAD_ASSIGNMENT_STARTED", { leadId, teamMemberId })
  const sessionClient = await createClient()
  const {
    data: { user },
  } = await sessionClient.auth.getUser()
  if (!user) return { ok: false, error: "Please sign in to continue." }
  const limit = await checkActionLimit(LIMITS.actionLeads)
  if (!limit.ok) return { ok: false, error: limit.error }
  if (!leadId) return { ok: false, error: "Missing lead id" }

  const admin = createAdminClient()
  const { data: leadRow, error: leadErr } = await admin
    .from("leads")
    .select("id, user_id, name, service, assigned_to")
    .eq("id", leadId)
    .is("deleted_at", null)
    .maybeSingle()
  if (leadErr) {
    if (process.env.NODE_ENV !== "production") console.info("LEAD_ASSIGNMENT_FAILED", { reason: "db_error" })
    return { ok: false, error: "We couldn't verify this lead. Please try again." }
  }
  if (!leadRow) {
    if (process.env.NODE_ENV !== "production") console.info("LEAD_ASSIGNMENT_FAILED", { reason: "not_found" })
    return { ok: false, error: "Lead not found." }
  }
  const lead = leadRow as { id: string; user_id: string; name: string; service: string; assigned_to: string | null }
  const businessId = lead.user_id

  const resolved = await resolveRoleForBusiness(user.id, businessId)
  if (!resolved.role) {
    if (process.env.NODE_ENV !== "production") console.info("LEAD_ASSIGNMENT_FAILED", { reason: "forbidden" })
    return { ok: false, error: "You don't have permission to assign this lead." }
  }
  if (!roleCan(resolved.role, "leads:write")) {
    if (process.env.NODE_ENV !== "production") console.info("LEAD_ASSIGNMENT_FAILED", { reason: "role_not_allowed" })
    return { ok: false, error: "Your role doesn't allow assigning leads." }
  }

  let target: AssignableMember | null = null
  if (teamMemberId) {
    const { data: memberRow, error: memberErr } = await admin
      .from("team_members")
      .select("id, member_user_id, name, email, role, status, business_id")
      .eq("id", teamMemberId)
      .maybeSingle()
    if (memberErr || !memberRow) {
      if (process.env.NODE_ENV !== "production") console.info("LEAD_ASSIGNMENT_FAILED", { reason: "member_not_found" })
      return { ok: false, error: "That team member could not be found." }
    }
    const member = memberRow as { id: string; member_user_id: string | null; name: string; email: string; role: string; status: string; business_id: string }
    if (member.business_id !== businessId || member.status !== "active" || !member.member_user_id) {
      if (process.env.NODE_ENV !== "production") console.info("LEAD_ASSIGNMENT_FAILED", { reason: "cross_business" })
      return { ok: false, error: "That team member is not part of your business." }
    }
    target = { teamMemberId: member.id, userId: member.member_user_id, name: member.name, email: member.email, role: member.role }
  }

  const priorAssignedTo = lead.assigned_to ?? null
  let priorAssigneeName: string | null = null
  if (priorAssignedTo) {
    const { data: priorRow } = await admin
      .from("team_members")
      .select("name")
      .eq("id", priorAssignedTo)
      .maybeSingle()
    priorAssigneeName = (priorRow as { name: string } | null)?.name ?? null
  }

  const now = new Date().toISOString()
  const { error: updateErr } = await admin
    .from("leads")
    .update({ assigned_to: teamMemberId, last_activity_at: now } as never)
    .eq("id", leadId)
    .eq("user_id", businessId)
    .is("deleted_at", null)
  if (updateErr) {
    if (process.env.NODE_ENV !== "production") console.info("LEAD_ASSIGNMENT_FAILED", { reason: "update_failed" })
    return { ok: false, error: "We couldn't update the assignment. Please try again." }
  }

  const actorName = actorDisplayName(user)
  let actionKey = "LEAD_ASSIGNED"
  let actionStr = `LEAD_ASSIGNED leadId=${leadId} to=${target?.name ?? ""}`
  if (!teamMemberId) {
    actionKey = "LEAD_UNASSIGNED"
    actionStr = `LEAD_UNASSIGNED leadId=${leadId} was=${priorAssigneeName ?? ""}`
  } else if (priorAssignedTo && priorAssignedTo !== teamMemberId) {
    actionKey = "LEAD_REASSIGNED"
    actionStr = `LEAD_REASSIGNED leadId=${leadId} from=${priorAssigneeName ?? ""} to=${target?.name ?? ""}`
  }

  await recordAudit({
    userName: actorName,
    userId: user.id,
    actorUserId: user.id,
    businessId,
    action: actionStr.slice(0, 1000),
    category: "team",
    targetType: "lead",
    targetId: leadId,
    metadata: {
      key: actionKey,
      leadId,
      leadName: lead.name,
      service: lead.service,
      from: priorAssigneeName,
      fromId: priorAssignedTo,
      to: target?.name ?? null,
      toId: teamMemberId,
    },
    status: "success",
  })

  if (process.env.NODE_ENV !== "production") console.info("LEAD_ASSIGNMENT_SUCCESS", { leadId, actionKey })

  void fireEventForAll(businessId, "lead.updated", {
    id: leadId,
    assignedTo: teamMemberId,
    assignedToName: target?.name ?? null,
  }).catch(() => {})

  revalidatePath("/dashboard/leads")
  revalidatePath(`/dashboard/leads/${leadId}`)
  return { ok: true, data: { leadId, assignedTo: target } }
}

export type MergeHistoryEntry = MergedLeadEntry

export type CreateLeadInput = {
  name: string
  phone: string
  email?: string
  service: string
  preferredTime?: string
  notes?: string
  source?: "Website Chat" | "Mobile" | "Direct Link"
  sourceUrl?: string
  consentGiven?: boolean
  status?: "new" | "contacted" | "booked" | "lost"
}

export async function createLeadAction(
  input: CreateLeadInput,
): Promise<LeadActionResult<Lead>> {
  const user = await requireUser()
  const limit = await checkActionLimit(LIMITS.actionLeads)
  if (!limit.ok) return { ok: false, error: limit.error }
  try {
    const name = (input.name ?? "").trim()
    const phone = (input.phone ?? "").trim()
    const email = (input.email ?? "").trim()
    const service = (input.service ?? "").trim()
    const preferredTime = (input.preferredTime ?? "").trim() || "Not specified"
    if (!name) return { ok: false, error: "Name is required" }
    if (!phone) return { ok: false, error: "Phone is required" }
    if (!service) return { ok: false, error: "Service is required" }

    const supabase = await createClient()
    const digits = phone.replace(/[^\d]/g, "").slice(-10)
    const emailNormalized = email.toLowerCase()

    let existing: { id: string } | null = null
    if (digits) {
      const { data: byPhone } = await supabase
        .from("leads")
        .select("id, merged_into_id")
        .eq("phone_normalized", digits)
        .is("merged_into_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      const row = byPhone as { id: string } | null
      if (row?.id) existing = row
    }
    if (!existing && emailNormalized) {
      const { data: byEmail } = await supabase
        .from("leads")
        .select("id, merged_into_id")
        .eq("email_normalized", emailNormalized)
        .is("merged_into_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      const row = byEmail as { id: string } | null
      if (row?.id) existing = row
    }

    if (existing?.id) {
      return {
        ok: false,
        error: "A lead with this phone or email already exists. Open the existing lead to update it.",
      }
    }

    const payload = {
      user_id: user.id,
      name,
      phone,
      email,
      phone_normalized: digits,
      email_normalized: emailNormalized,
      service,
      preferred_time: preferredTime,
      source: (input.source ?? "Direct Link") as "Website Chat" | "Mobile" | "Direct Link",
      source_url: (input.sourceUrl ?? "/").slice(0, 2000),
      after_hours: false,
      notes: input.notes?.trim() || null,
      transcript: [] as unknown[],
      consent_given: Boolean(input.consentGiven),
      status: (input.status ?? "new") as "new" | "contacted" | "booked" | "lost",
    }

    const { data, error } = await supabase
      .from("leads")
      .insert(payload as never)
      .select()
      .single()
    if (error) return { ok: false, error: error.message }
    const lead = mapLead(data as Record<string, unknown>)

    void recordAudit({
      userName: "dashboard",
      action: `leads.created manual id=${lead.id}`,
    })

    try {
      await fireEventForAll(user.id, "lead.created", {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        service: lead.service,
        preferredTime: lead.preferredTime,
        source: lead.source,
        sourceUrl: lead.sourceUrl,
        afterHours: lead.afterHours,
        createdAt: lead.createdAt,
        consentGiven: lead.consentGiven,
        origin: "dashboard",
      })
    } catch (e) {
      console.error("[leads] webhook fire failed:", e)
    }

    revalidatePath("/dashboard/leads")
    return { ok: true, data: lead }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create lead",
    }
  }
}

export async function updateLeadNotesAction(
  leadId: string,
  notes: string,
): Promise<LeadActionResult<{ notes: string }>> {
  const user = await requireUser()
  const limit = await checkActionLimit(LIMITS.actionLeads)
  if (!limit.ok) return { ok: false, error: limit.error }
  if (!leadId) return { ok: false, error: "Missing lead id" }
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("leads")
      .update({ notes, last_activity_at: new Date().toISOString() } as never)
      .eq("id", leadId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select()
      .maybeSingle()
    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: false, error: "Lead not found" }
    void recordAudit({
      userName: "dashboard",
      action: `leads.notes_updated ${leadId} (${notes.length} chars)`,
    })
    void fireEventForAll(user.id, "lead.updated", {
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
  channel: "email"
  body: string
}

export type SendLeadMessageResult = {
  delivered: boolean
  channel: "email"
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
  const limit = await checkActionLimit(LIMITS.actionLeads)
  if (!limit.ok) return { ok: false, error: limit.error }
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
      .eq("user_id", user.id)
      .is("deleted_at", null)
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

    const recipient = lead.email
    if (!recipient) return { ok: false, error: "Lead has no email on file" }

    const kb = await loadKnowledge()
    const brandName = kb.widget.brandName

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
    const body = `${text}\n\n- ${brandName} team\n\n${input.body.trim()}`
    const html2 = `${html}<hr/><p style="margin-top:16px;color:#475569">${escapeHtml(input.body.trim())}</p>`
    const result = await sendEmail({ to: recipient, subject, text: body, html: html2 })

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

export async function deleteLeadAction(
  leadId: string,
): Promise<LeadActionResult<{ leadId: string }>> {
  const user = await requireUser()
  const limit = await checkActionLimit(LIMITS.actionLeads)
  if (!limit.ok) return { ok: false, error: limit.error }
  if (!leadId) return { ok: false, error: "Missing lead id" }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc(
      "soft_delete_lead" as never,
      { p_lead_id: leadId } as never,
    )
    if (error) {
      console.error("[leads] soft delete failed", { code: error.code, message: error.message })
      return { ok: false, error: "We couldn't delete this lead. Please try again." }
    }
    if (data !== true) return { ok: false, error: "Lead not found or already deleted." }

    void recordAudit({
      userName: user.email?.split("@")[0] || user.id,
      action: "leads.deleted " + leadId,
    })
    void fireEventForAll(user.id, "lead.deleted", { id: leadId })
    revalidatePath("/dashboard/leads")
    revalidatePath("/dashboard/conversations")
    return { ok: true, data: { leadId } }
  } catch (error) {
    console.error("[leads] deleteLeadAction threw", error)
    return { ok: false, error: "We couldn't delete this lead. Please try again." }
  }
}

export async function reopenLeadChatAction(
  leadId: string,
): Promise<LeadActionResult<{ conversationId: string }>> {
  await requireUser()
  const limit = await checkActionLimit(LIMITS.actionLeads)
  if (!limit.ok) return { ok: false, error: limit.error }
  if (!leadId) return { ok: false, error: "Missing lead id" }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc(
      "reopen_lead_chat" as never,
      { p_lead_id: leadId } as never,
    )
    if (error) {
      console.error("[leads] reopen chat failed", { code: error.code, message: error.message })
      return { ok: false, error: "We couldn't reopen this chat. Please try again." }
    }
    const conversationId = typeof data === "string" ? data : null
    if (!conversationId) {
      return {
        ok: false,
        error: "No linked website conversation was found for this lead.",
      }
    }
    revalidatePath("/dashboard/conversations")
    return { ok: true, data: { conversationId } }
  } catch (error) {
    console.error("[leads] reopenLeadChatAction threw", error)
    return { ok: false, error: "We couldn't reopen this chat. Please try again." }
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
