"use server"

import { revalidatePath } from "next/cache"

import { recordAudit } from "@/lib/audit"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { AuditLog, TeamRole } from "@/lib/supabase/types"
import { EntitlementError, entitlementErrorPayload } from "@/lib/subscription/entitlements.server"
import { requireTeamManagementAccess, TeamAccessError } from "@/lib/team/access.server"
import {
  TeamInviteError,
  changeTeamInvitationRole,
  createTeamInvitation,
  getTeamAuditPage,
  resendTeamInvitation,
  revokeTeamInvitation,
  rotateTeamInvitationLink,
} from "@/lib/team/server"
import { checkActionLimit } from "@/lib/security/check-action-limit"
import { hashInviteToken } from "@/lib/team/tokens"
import { LIMITS } from "@/lib/security/limits"

export type TeamActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorType?: string; [key: string]: unknown }

function actionError(error: unknown): TeamActionResult<never> {
  if (error instanceof EntitlementError) return entitlementErrorPayload(error)
  if (error instanceof TeamInviteError || error instanceof TeamAccessError) {
    return { ok: false, error: error.message, errorType: error.code, ...(error instanceof TeamInviteError ? error.details : {}) }
  }
  console.error("[team] action failed", { error: error instanceof Error ? error.message : String(error) })
  return { ok: false, error: "Something went wrong. Please try again.", errorType: "UNKNOWN" }
}

export async function inviteTeamMemberAction(input: {
  email: string
  name?: string
  role: TeamRole
}): Promise<TeamActionResult<{ id: string; inviteUrl: string; deliveryStatus: "sent" }>> {
  const limit = await checkActionLimit(LIMITS.actionTeam)
  if (!limit.ok) return { ok: false, error: limit.error, errorType: "RATE_LIMITED" }
  try {
    const result = await createTeamInvitation(input)
    revalidatePath("/dashboard/team")
    return { ok: true, data: { id: result.invite.id, inviteUrl: result.inviteUrl, deliveryStatus: result.deliveryStatus } }
  } catch (error) {
    revalidatePath("/dashboard/team")
    return actionError(error)
  }
}

export async function resendTeamInvitationAction(id: string): Promise<TeamActionResult<{ inviteUrl: string }>> {
  try {
    const result = await resendTeamInvitation(id)
    revalidatePath("/dashboard/team")
    return { ok: true, data: { inviteUrl: result.inviteUrl } }
  } catch (error) {
    revalidatePath("/dashboard/team")
    return actionError(error)
  }
}

export async function copyTeamInvitationLinkAction(id: string): Promise<TeamActionResult<{ inviteUrl: string; expiresAt: string }>> {
  try {
    return { ok: true, data: await rotateTeamInvitationLink(id) }
  } catch (error) {
    return actionError(error)
  }
}

export async function revokeTeamInvitationAction(id: string): Promise<TeamActionResult> {
  try {
    await revokeTeamInvitation(id)
    revalidatePath("/dashboard/team")
    return { ok: true, data: undefined }
  } catch (error) {
    return actionError(error)
  }
}

export async function updateTeamInvitationRoleAction(id: string, role: TeamRole): Promise<TeamActionResult> {
  try {
    await changeTeamInvitationRole(id, role)
    revalidatePath("/dashboard/team")
    return { ok: true, data: undefined }
  } catch (error) {
    return actionError(error)
  }
}

export async function updateTeamMemberRoleAction(id: string, role: TeamRole): Promise<TeamActionResult> {
  if (role === "Owner") return { ok: false, error: "Owner cannot be assigned through role management.", errorType: "INVALID_ROLE" }
  try {
    const context = await requireTeamManagementAccess()
    const admin = createAdminClient()
    const { data: member, error: readError } = await admin
      .from("team_members")
      .select("id, name, email, role")
      .eq("id", id)
      .eq("business_id", context.businessId)
      .maybeSingle()
    if (readError || !member) return { ok: false, error: "Team member not found.", errorType: "NOT_FOUND" }
    const row = member as { id: string; name: string; email: string; role: TeamRole }
    if (row.role === "Owner") return { ok: false, error: "The workspace Owner role cannot be changed.", errorType: "OWNER_PROTECTED" }
    const { error } = await admin.from("team_members").update({ role, updated_at: new Date().toISOString() } as never).eq("id", id).eq("business_id", context.businessId)
    if (error) throw error
    await recordAudit({
      userName: context.user.user_metadata?.full_name || context.user.email?.split("@")[0] || "Owner",
      userId: context.user.id,
      actorUserId: context.user.id,
      businessId: context.businessId,
      action: "TEAM_MEMBER_ROLE_CHANGED",
      category: "team",
      targetType: "team_member",
      targetId: id,
      metadata: { email: row.email, target: row.name, from: row.role, to: role },
    })
    revalidatePath("/dashboard/team")
    return { ok: true, data: undefined }
  } catch (error) {
    return actionError(error)
  }
}

export async function removeTeamMemberAction(id: string): Promise<TeamActionResult> {
  try {
    const context = await requireTeamManagementAccess()
    const admin = createAdminClient()
    const { data: member, error: readError } = await admin
      .from("team_members")
      .select("id, name, email, role")
      .eq("id", id)
      .eq("business_id", context.businessId)
      .maybeSingle()
    if (readError || !member) return { ok: false, error: "Team member not found.", errorType: "NOT_FOUND" }
    const row = member as { name: string; email: string; role: TeamRole }
    if (row.role === "Owner") return { ok: false, error: "The workspace Owner cannot be removed.", errorType: "OWNER_PROTECTED" }
    const { error } = await admin.from("team_members").delete().eq("id", id).eq("business_id", context.businessId)
    if (error) throw error
    await recordAudit({
      userName: context.user.user_metadata?.full_name || context.user.email?.split("@")[0] || "Owner",
      userId: context.user.id,
      actorUserId: context.user.id,
      businessId: context.businessId,
      action: "TEAM_MEMBER_REMOVED",
      category: "team",
      targetType: "team_member",
      targetId: id,
      metadata: { email: row.email, target: row.name, role: row.role },
    })
    revalidatePath("/dashboard/team")
    return { ok: true, data: undefined }
  } catch (error) {
    return actionError(error)
  }
}

export async function getTeamAuditPageAction(
  category: string,
  offset: number,
): Promise<TeamActionResult<{ entries: AuditLog[]; hasMore: boolean }>> {
  try {
    return { ok: true, data: await getTeamAuditPage(category, offset) }
  } catch (error) {
    return actionError(error)
  }
}

export async function acceptTeamInvitationAction(rawToken: string): Promise<TeamActionResult<{ redirectTo: string }>> {
  if (!/^[a-f0-9]{64}$/i.test(rawToken)) return { ok: false, error: "This invitation link is invalid.", errorType: "INVITE_INVALID" }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { ok: false, error: "Please sign in with the invited email to continue.", errorType: "AUTH_REQUIRED" }
  console.info("TEAM_INVITE_ACCEPT_STARTED", { userId: user.id })
  const admin = createAdminClient()
  const actorName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : user.email.split("@")[0]
  const { error } = await admin.rpc("accept_team_invitation" as never, {
    p_token_hash: hashInviteToken(rawToken),
    p_accepting_user_id: user.id,
    p_accepting_email: user.email,
    p_actor_name: actorName,
  } as never)
  if (error) {
    const raw = error.message || ""
    const known = [
      ["INVITE_EMAIL_MISMATCH", "This invitation was sent to a different email address. Sign in with the invited email to continue."],
      ["INVITE_EXPIRED", "This invitation has expired. Ask the owner to send a new one."],
      ["INVITE_REVOKED", "This invitation has been revoked."],
      ["INVITE_ACCEPTED", "This invitation has already been accepted."],
      ["MEMBER_EXISTS", "You are already a member of this workspace."],
      ["INVITE_INVALID", "This invitation link is invalid."],
    ] as const
    const match = known.find(([code]) => raw.includes(code))
    console.warn("TEAM_INVITE_ACCEPT_FAILED", { userId: user.id, failedStage: "rpc", errorType: match?.[0] || "UNKNOWN" })
    return { ok: false, error: match?.[1] || "We couldn't accept the invitation. Please try again.", errorType: match?.[0] || "UNKNOWN" }
  }
  console.info("TEAM_INVITE_ACCEPT_SUCCESS", { userId: user.id })
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/team")
  return { ok: true, data: { redirectTo: "/dashboard" } }
}
