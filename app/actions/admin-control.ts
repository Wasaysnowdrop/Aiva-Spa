"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdminPermission } from "@/lib/admin/auth"
import { recordAdminAction } from "@/lib/admin/audit"
import { checkActionLimit } from "@/lib/security/check-action-limit"
import { LIMITS } from "@/lib/security/limits"

export type AdminActionResult = { ok: true; message: string } | { ok: false; error: string }

async function guard(permission: "incidents:write" | "businesses:write" | "configuration:write") {
  const auth = await requireAdminPermission(permission)
  if (!auth.ok) return auth
  const limit = await checkActionLimit(LIMITS.actionAdminUsers)
  if (!limit.ok) return { ok: false as const, status: 429 as const, error: limit.error }
  return auth
}

export async function updateIncidentAction(id: string, operation: "acknowledge" | "investigate" | "monitor" | "resolve" | "reopen", note = ""): Promise<AdminActionResult> {
  const auth = await guard("incidents:write")
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Invalid incident." }
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { updated_at: now }
  if (operation === "acknowledge") Object.assign(patch, { status: "investigating", acknowledged_at: now })
  if (operation === "investigate") patch.status = "investigating"
  if (operation === "monitor") patch.status = "monitoring"
  if (operation === "resolve") Object.assign(patch, { status: "resolved", resolved_at: now, resolution_notes: note.trim().slice(0, 2000) || null })
  if (operation === "reopen") Object.assign(patch, { status: "open", resolved_at: null, resolution_notes: null })
  const admin = createAdminClient()
  const { error } = await admin.from("admin_incidents").update(patch as never).eq("id", id)
  if (error) return { ok: false, error: "We could not update this incident." }
  await recordAdminAction({ adminId: auth.admin.id, adminEmail: auth.admin.email, action: `incident.${operation}`, target: id, metadata: { note: note.trim().slice(0, 2000) || null } })
  revalidatePath("/admin")
  revalidatePath("/admin/incidents")
  return { ok: true, message: "Incident updated." }
}

export async function setBusinessPausedAction(businessId: string, paused: boolean, reason: string): Promise<AdminActionResult> {
  const auth = await guard("businesses:write")
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) return { ok: false, error: "Invalid business." }
  if (!reason.trim()) return { ok: false, error: "A reason is required." }
  const admin = createAdminClient()
  const { error } = await admin.from("widget_installs").update({ active: !paused, updated_at: new Date().toISOString() } as never).eq("user_id", businessId)
  if (error) return { ok: false, error: "We could not change business access." }
  await recordAdminAction({ adminId: auth.admin.id, adminEmail: auth.admin.email, action: paused ? "business.pause" : "business.reactivate", target: businessId, metadata: { reason: reason.trim().slice(0, 500) } })
  revalidatePath("/admin/businesses")
  revalidatePath(`/admin/businesses/${businessId}`)
  return { ok: true, message: paused ? "Business paused." : "Business reactivated." }
}

export async function saveOperationsSettingsAction(input: { maintenanceMode: boolean; supportContact: string; systemAnnouncement: string; defaultRateLimit: number; aiFailureThreshold: number; emailFailureThreshold: number; bookingFailureThreshold: number }): Promise<AdminActionResult> {
  const auth = await guard("configuration:write")
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!/^\S+@\S+\.\S+$/.test(input.supportContact)) return { ok: false, error: "Enter a valid support email." }
  const value = { maintenance_mode: Boolean(input.maintenanceMode), support_contact: input.supportContact.trim().slice(0, 200), system_announcement: input.systemAnnouncement.trim().slice(0, 500), default_rate_limit: Math.min(1000, Math.max(1, Math.round(input.defaultRateLimit))), incident_thresholds: { ai_failures: Math.min(100, Math.max(2, Math.round(input.aiFailureThreshold))), email_failures: Math.min(100, Math.max(2, Math.round(input.emailFailureThreshold))), booking_failures: Math.min(100, Math.max(2, Math.round(input.bookingFailureThreshold))) } }
  const admin = createAdminClient()
  const { error } = await admin.from("admin_settings").upsert({ key: "operations", value, updated_at: new Date().toISOString(), updated_by: auth.admin.id } as never, { onConflict: "key" })
  if (error) return { ok: false, error: "Configuration could not be saved." }
  await recordAdminAction({ adminId: auth.admin.id, adminEmail: auth.admin.email, action: "configuration.update", target: "operations", metadata: { maintenance_mode: value.maintenance_mode, thresholds: value.incident_thresholds } })
  revalidatePath("/admin/settings")
  return { ok: true, message: "Configuration saved." }
}
