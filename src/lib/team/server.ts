import "server-only"

import { z } from "zod"

import { recordAudit } from "@/lib/audit"
import { buildTeamInviteEmail } from "@/lib/notifications/team-invite-email"
import { getResendConfigDiagnostic, sendEmail } from "@/lib/notifications/email"
import { createAdminClient } from "@/lib/supabase/admin"
import { assertPlanLimit, requireFeatureForUser } from "@/lib/subscription/entitlements.server"
import { mapAuditLog, mapTeamInvitation, mapTeamMember, type AuditLog, type TeamInvitation, type TeamRole } from "@/lib/supabase/types"
import { requireTeamManagementAccess, type TeamAccessContext } from "@/lib/team/access.server"
import { generateInviteToken, hashInviteToken } from "@/lib/team/tokens"

export const InviteTeamMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().max(100).optional().transform((value) => value || undefined),
  role: z.enum(["Manager", "Staff", "Receptionist"]),
})

const InviteIdSchema = z.string().uuid()
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000
const RESEND_COOLDOWN_MS = 60_000

type InviteRole = Exclude<TeamRole, "Owner">

export class TeamInviteError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = "TeamInviteError"
  }
}

export function buildInviteUrl(rawToken: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  return appUrl.replace(/\/$/, "") + "/invite/accept?token=" + encodeURIComponent(rawToken)
}

function safeProviderError(error: string | undefined) {
  return (error || "Email provider rejected the request").slice(0, 500)
}

function devLog(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") console.info(event, details)
}

async function getBusinessName(context: TeamAccessContext): Promise<string> {
  const metadata = context.user.user_metadata as Record<string, unknown> | undefined
  const fromMetadata = typeof metadata?.spa_name === "string" ? metadata.spa_name.trim() : ""
  if (fromMetadata) return fromMetadata
  const admin = createAdminClient()
  const { data } = await admin.from("spa_settings").select("spa_name").limit(1).maybeSingle()
  const name = (data as { spa_name?: string } | null)?.spa_name?.trim()
  return name || "your AivaSpa workspace"
}

function actorName(context: TeamAccessContext) {
  const metadata = context.user.user_metadata as Record<string, unknown> | undefined
  const fullName = typeof metadata?.full_name === "string" ? metadata.full_name.trim() : ""
  return fullName || context.user.email?.split("@")[0] || "Workspace owner"
}

async function countTeamSeats(businessId: string) {
  const admin = createAdminClient()
  const [members, invitations] = await Promise.all([
    admin.from("team_members").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "active").neq("role", "Owner"),
    admin.from("team_invitations").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "pending").gt("expires_at", new Date().toISOString()),
  ])
  if (members.error || invitations.error) throw new TeamInviteError("DATABASE_ERROR", "We couldn't verify your team limit. Please try again.")
  return (members.count ?? 0) + (invitations.count ?? 0) + 1
}

async function writeTeamAudit(context: TeamAccessContext, input: {
  action: string
  targetType: "team_invitation" | "team_member"
  targetId: string
  metadata?: Record<string, unknown>
  status?: "success" | "failed" | "pending"
}) {
  await recordAudit({
    userName: actorName(context),
    userId: context.user.id,
    actorUserId: context.user.id,
    businessId: context.businessId,
    action: input.action,
    category: "team",
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: input.metadata,
    status: input.status,
  })
}

async function deliverInvitation(context: TeamAccessContext, invite: TeamInvitation, rawToken: string, event: "TEAM_INVITE_SENT" | "TEAM_INVITE_RESENT") {
  const admin = createAdminClient()
  const attemptedAt = new Date().toISOString()
  const { error: attemptError } = await admin
    .from("team_invitations")
    .update({ last_sent_at: attemptedAt, updated_at: attemptedAt } as never)
    .eq("id", invite.id)
    .eq("business_id", context.businessId)
  if (attemptError) throw new TeamInviteError("DATABASE_ERROR", "We couldn't prepare the invitation email. Please try again.")
  const config = getResendConfigDiagnostic()
  if (!config.apiKeyPresent || !config.fromEmailPresent || !config.appUrlPresent || !config.senderLooksProductionReady) {
    const deliveryError = "Resend configuration is incomplete or the sender domain is not production-ready."
    await admin.from("team_invitations").update({ delivery_status: "failed", delivery_error: deliveryError, updated_at: new Date().toISOString() } as never).eq("id", invite.id).eq("business_id", context.businessId)
    await writeTeamAudit(context, { action: "TEAM_INVITE_DELIVERY_FAILED", targetType: "team_invitation", targetId: invite.id, metadata: { email: invite.email, role: invite.role, failedStage: "configuration" }, status: "failed" })
    devLog("TEAM_INVITE_EMAIL_SEND_FAILED", { businessId: context.businessId, invitationId: invite.id, role: invite.role, deliveryStatus: "failed", failedStage: "configuration" })
    throw new TeamInviteError("EMAIL_DELIVERY_FAILED", "We couldn't send the invitation email. Please check the Resend sender configuration and try again.", { inviteId: invite.id })
  }
  const expiresAt = new Date(invite.expiresAt)
  const inviteUrl = buildInviteUrl(rawToken)
  const template = buildTeamInviteEmail({
    businessName: invite.businessName,
    inviterName: actorName(context),
    recipientName: invite.name,
    role: invite.role,
    inviteUrl,
    expiresAt,
  })
  devLog("TEAM_INVITE_EMAIL_SEND_STARTED", { businessId: context.businessId, invitationId: invite.id, role: invite.role, recipientDomain: invite.email.split("@")[1] })
  const result = await sendEmail({ to: invite.email, ...template })
  if (!result.ok || !result.id) {
    const providerError = safeProviderError(result.error)
    await admin.from("team_invitations").update({ delivery_status: "failed", delivery_error: providerError, updated_at: new Date().toISOString() } as never).eq("id", invite.id).eq("business_id", context.businessId)
    await writeTeamAudit(context, { action: "TEAM_INVITE_DELIVERY_FAILED", targetType: "team_invitation", targetId: invite.id, metadata: { email: invite.email, role: invite.role, provider: result.provider }, status: "failed" })
    devLog("TEAM_INVITE_EMAIL_SEND_FAILED", { businessId: context.businessId, invitationId: invite.id, role: invite.role, deliveryStatus: "failed", failedStage: "resend" })
    throw new TeamInviteError("EMAIL_DELIVERY_FAILED", "We couldn't send the invitation email. Please try again.", { inviteId: invite.id })
  }
  const sentAt = new Date().toISOString()
  const { error: updateError } = await admin.from("team_invitations").update({ delivery_status: "sent", provider_message_id: result.id, delivery_error: null, sent_at: sentAt, last_sent_at: sentAt, updated_at: sentAt } as never).eq("id", invite.id).eq("business_id", context.businessId)
  if (updateError) throw new TeamInviteError("DATABASE_ERROR", "The email was sent, but its delivery record could not be updated.")
  await writeTeamAudit(context, { action: event, targetType: "team_invitation", targetId: invite.id, metadata: { email: invite.email, role: invite.role, resendRequestId: result.id } })
  devLog("TEAM_INVITE_EMAIL_SEND_SUCCESS", { businessId: context.businessId, invitationId: invite.id, role: invite.role, resendRequestId: result.id, deliveryStatus: "sent" })
  return { inviteUrl, providerMessageId: result.id }
}

export async function createTeamInvitation(input: unknown) {
  devLog("TEAM_INVITE_SUBMITTED", { stage: "received" })
  const parsed = InviteTeamMemberSchema.safeParse(input)
  if (!parsed.success) throw new TeamInviteError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Please enter a valid email and role.")
  const context = await requireTeamManagementAccess()
  const admin = createAdminClient()
  const { email, name, role } = parsed.data
  devLog("TEAM_INVITE_VALIDATED", { businessId: context.businessId, role })
  const now = new Date().toISOString()
  const { error: expiryError } = await admin
    .from("team_invitations")
    .update({ status: "expired", updated_at: now } as never)
    .eq("business_id", context.businessId)
    .eq("normalized_email", email)
    .eq("status", "pending")
    .lte("expires_at", now)
  if (expiryError) throw new TeamInviteError("DATABASE_ERROR", "We couldn't verify existing invitations. Please try again.")
  const [member, pending] = await Promise.all([
    admin.from("team_members").select("id").eq("business_id", context.businessId).eq("email", email).eq("status", "active").maybeSingle(),
    admin.from("team_invitations").select("id").eq("business_id", context.businessId).eq("normalized_email", email).eq("status", "pending").gt("expires_at", new Date().toISOString()).maybeSingle(),
  ])
  if (member.data) throw new TeamInviteError("MEMBER_EXISTS", "This person is already a team member.")
  if (pending.data) throw new TeamInviteError("PENDING_INVITE_EXISTS", "An active invitation already exists for this email.")
  const entitlement = await requireFeatureForUser(context.businessId, "role_based_access", admin)
  const current = await countTeamSeats(context.businessId)
  assertPlanLimit(entitlement, "teamMembers", current)
  devLog("TEAM_INVITE_PLAN_CHECK_PASSED", { businessId: context.businessId, role, current })
  const businessName = await getBusinessName(context)
  const { rawToken, tokenHash } = generateInviteToken()
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)
  const { data, error } = await admin.from("team_invitations").insert({ business_id: context.businessId, business_name: businessName, email, name: name ?? null, role, token_hash: tokenHash, status: "pending", delivery_status: "pending", invited_by: context.user.id, expires_at: expiresAt.toISOString() } as never).select("*").single()
  if (error) {
    if (error.code === "23505") throw new TeamInviteError("PENDING_INVITE_EXISTS", "An active invitation already exists for this email.")
    throw new TeamInviteError("DATABASE_ERROR", "We couldn't create the invitation. Please try again.")
  }
  const invite = mapTeamInvitation(data as Record<string, unknown>)
  devLog("TEAM_INVITE_RECORD_CREATED", { businessId: context.businessId, invitationId: invite.id, role })
  await writeTeamAudit(context, { action: "TEAM_INVITE_CREATED", targetType: "team_invitation", targetId: invite.id, metadata: { email, role }, status: "pending" })
  const delivery = await deliverInvitation(context, invite, rawToken, "TEAM_INVITE_SENT")
  return { invite, ...delivery, deliveryStatus: "sent" as const }
}

export async function resendTeamInvitation(invitationId: string) {
  const id = InviteIdSchema.parse(invitationId)
  const context = await requireTeamManagementAccess()
  const admin = createAdminClient()
  const { data, error } = await admin.from("team_invitations").select("*").eq("id", id).eq("business_id", context.businessId).eq("status", "pending").maybeSingle()
  if (error || !data) throw new TeamInviteError("INVITE_NOT_FOUND", "This invitation is no longer active.")
  const raw = data as Record<string, unknown>
  const lastSentAt = typeof raw.last_sent_at === "string" ? new Date(raw.last_sent_at).getTime() : 0
  if (lastSentAt && Date.now() - lastSentAt < RESEND_COOLDOWN_MS) throw new TeamInviteError("RATE_LIMITED", "Please wait one minute before resending this invitation.")
  const { rawToken, tokenHash } = generateInviteToken()
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()
  const { data: rotated, error: rotateError } = await admin.from("team_invitations").update({ token_hash: tokenHash, expires_at: expiresAt, delivery_status: "pending", provider_message_id: null, delivery_error: null, updated_at: new Date().toISOString() } as never).eq("id", id).eq("business_id", context.businessId).eq("status", "pending").select("*").single()
  if (rotateError) throw new TeamInviteError("DATABASE_ERROR", "We couldn't refresh the invitation. Please try again.")
  const invite = mapTeamInvitation(rotated as Record<string, unknown>)
  return { invite, ...(await deliverInvitation(context, invite, rawToken, "TEAM_INVITE_RESENT")), deliveryStatus: "sent" as const }
}

export async function rotateTeamInvitationLink(invitationId: string) {
  const id = InviteIdSchema.parse(invitationId)
  const context = await requireTeamManagementAccess()
  const admin = createAdminClient()
  const { rawToken, tokenHash } = generateInviteToken()
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()
  const { data, error } = await admin.from("team_invitations").update({ token_hash: tokenHash, expires_at: expiresAt, updated_at: new Date().toISOString() } as never).eq("id", id).eq("business_id", context.businessId).eq("status", "pending").select("id").maybeSingle()
  if (error || !data) throw new TeamInviteError("INVITE_NOT_FOUND", "This invitation is no longer active.")
  return { inviteUrl: buildInviteUrl(rawToken), expiresAt }
}

export async function revokeTeamInvitation(invitationId: string) {
  const id = InviteIdSchema.parse(invitationId)
  const context = await requireTeamManagementAccess()
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await admin.from("team_invitations").update({ status: "revoked", revoked_at: now, updated_at: now } as never).eq("id", id).eq("business_id", context.businessId).eq("status", "pending").select("email, role").maybeSingle()
  if (error || !data) throw new TeamInviteError("INVITE_NOT_FOUND", "This invitation is no longer active.")
  const row = data as { email: string; role: InviteRole }
  await writeTeamAudit(context, { action: "TEAM_INVITE_REVOKED", targetType: "team_invitation", targetId: id, metadata: row })
}

export async function changeTeamInvitationRole(invitationId: string, role: unknown) {
  const id = InviteIdSchema.parse(invitationId)
  const parsed = z.enum(["Manager", "Staff", "Receptionist"]).safeParse(role)
  if (!parsed.success) throw new TeamInviteError("VALIDATION_ERROR", "Please select a valid role.")
  const context = await requireTeamManagementAccess()
  const admin = createAdminClient()
  const { data, error } = await admin.from("team_invitations").update({ role: parsed.data, updated_at: new Date().toISOString() } as never).eq("id", id).eq("business_id", context.businessId).eq("status", "pending").select("email").maybeSingle()
  if (error || !data) throw new TeamInviteError("INVITE_NOT_FOUND", "This invitation is no longer active.")
  await writeTeamAudit(context, { action: "TEAM_INVITE_ROLE_CHANGED", targetType: "team_invitation", targetId: id, metadata: { email: (data as { email: string }).email, to: parsed.data } })
}

export async function getTeamDashboardData() {
  const context = await requireTeamManagementAccess()
  const admin = createAdminClient()
  await admin.from("team_invitations").update({ status: "expired", updated_at: new Date().toISOString() } as never).eq("business_id", context.businessId).eq("status", "pending").lte("expires_at", new Date().toISOString())
  const [memberResult, inviteResult] = await Promise.all([
    admin.from("team_members").select("*").eq("business_id", context.businessId).eq("status", "active").order("name"),
    admin.from("team_invitations").select("*").eq("business_id", context.businessId).eq("status", "pending").order("created_at", { ascending: false }),
  ])
  if (memberResult.error || inviteResult.error) throw new Error("We couldn't load the team right now.")
  const members = (memberResult.data ?? []).map((row) => mapTeamMember(row as Record<string, unknown>))
  if (!members.some((member) => member.role === "Owner")) {
    let ownerUser = context.user
    if (context.user.id !== context.businessId) {
      const ownerResult = await admin.auth.admin.getUserById(context.businessId)
      ownerUser = ownerResult.data.user ?? context.user
    }
    const metadata = ownerUser.user_metadata as Record<string, unknown> | undefined
    members.unshift({ id: "owner:" + context.businessId, businessId: context.businessId, memberUserId: context.businessId, name: typeof metadata?.full_name === "string" ? metadata.full_name : ownerUser.email?.split("@")[0] || "Owner", email: ownerUser.email || "", phone: null, role: "Owner", status: "active", lastActiveAt: null, avatarColor: "#E2E54B" })
  }
  return { members, invitations: (inviteResult.data ?? []).map((row) => mapTeamInvitation(row as Record<string, unknown>)), currentRole: context.role, diagnostic: getResendConfigDiagnostic() }
}

export async function getTeamAuditPage(category: string, offset: number, limit = 10): Promise<{ entries: AuditLog[]; hasMore: boolean }> {
  const context = await requireTeamManagementAccess()
  const admin = createAdminClient()
  const safeOffset = Math.max(0, Math.floor(offset || 0))
  const safeLimit = Math.min(25, Math.max(1, Math.floor(limit || 10)))
  devLog("AUDIT_LOG_FETCH_STARTED", { businessId: context.businessId, category, offset: safeOffset })
  let query = admin.from("audit_logs").select("*").eq("business_id", context.businessId).order("created_at", { ascending: false }).range(safeOffset, safeOffset + safeLimit)
  if (["team", "billing", "security", "settings"].includes(category)) query = query.eq("category", category)
  const { data, error } = await query
  if (error) throw new Error("We couldn't load the audit log.")
  const rows = data ?? []
  devLog("AUDIT_LOG_FETCH_SUCCESS", { businessId: context.businessId, count: rows.length })
  return { entries: rows.slice(0, safeLimit).map((row) => mapAuditLog(row as Record<string, unknown>)), hasMore: rows.length > safeLimit }
}

export type TeamInvitationPreview = { state: "valid" | "invalid" | "expired" | "revoked" | "accepted"; invitation?: TeamInvitation }

export async function getTeamInvitationPreview(rawToken: string): Promise<TeamInvitationPreview> {
  if (!/^[a-f0-9]{64}$/i.test(rawToken)) return { state: "invalid" }
  const admin = createAdminClient()
  const { data, error } = await admin.from("team_invitations").select("*").eq("token_hash", hashInviteToken(rawToken)).maybeSingle()
  if (error || !data) return { state: "invalid" }
  const invite = mapTeamInvitation(data as Record<string, unknown>)
  if (invite.status === "revoked") return { state: "revoked", invitation: invite }
  if (invite.status === "accepted") return { state: "accepted", invitation: invite }
  if (invite.status === "expired" || new Date(invite.expiresAt).getTime() <= Date.now()) return { state: "expired", invitation: invite }
  return { state: "valid", invitation: invite }
}

