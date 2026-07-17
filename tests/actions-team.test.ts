import { beforeEach, describe, expect, it, vi } from "vitest"

import { installSupabaseMocks, seedActiveSubscription } from "./helpers/mock-supabase"

beforeEach(() => {
  vi.resetModules()
})

function invitationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    business_id: "u_1",
    business_name: "Glow Aesthetics",
    email: "newhire@spa.com",
    name: "New Hire",
    role: "Staff",
    status: "pending",
    delivery_status: "pending",
    expires_at: "2099-08-01T00:00:00Z",
    sent_at: null,
    created_at: "2026-07-17T00:00:00Z",
    ...overrides,
  }
}

function mockResend(result: { ok: boolean; provider: "resend"; id?: string; error?: string }) {
  const sendEmail = vi.fn().mockResolvedValue(result)
  vi.doMock("@/lib/notifications/email", () => ({
    sendEmail,
    getResendConfigDiagnostic: () => ({
      enabled: false,
      apiKeyPresent: true,
      fromEmailPresent: true,
      appUrlPresent: true,
      senderDomain: "aivaspa.online",
      senderLooksProductionReady: true,
    }),
  }))
  return sendEmail
}

function configureValidInvite() {
  const mocks = installSupabaseMocks()
  const { server } = mocks
  server.setAuthUser({ id: "u_1", email: "owner@spa.com", user_metadata: { full_name: "Abdul Wasay", spa_name: "Glow Aesthetics" } })
  seedActiveSubscription(server, "u_1")
  server.setResult("team_members", "select", { data: null, error: null, count: 0 })
  server.setResult("team_invitations", "select", { data: null, error: null, count: 0 })
  server.setResult("team_invitations", "insert", { data: invitationRow(), error: null })
  server.setResult("team_invitations", "update", { data: invitationRow(), error: null })
  server.setResult("audit_logs", "insert", { data: null, error: null })
  server.setResult("spa_settings", "select", { data: { spa_name: "Glow Aesthetics" }, error: null })
  return mocks
}

describe("team invitations", () => {
  it("validates email and prevents Owner invites", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    seedActiveSubscription(server, "u_1")
    mockResend({ ok: true, provider: "resend", id: "email_1" })
    const { inviteTeamMemberAction } = await import("@/app/actions/team")

    const invalidEmail = await inviteTeamMemberAction({ email: "bad", role: "Staff" })
    const invalidRole = await inviteTeamMemberAction({ email: "person@spa.com", role: "Owner" })

    expect(invalidEmail.ok).toBe(false)
    expect(invalidRole.ok).toBe(false)
  })

  it("creates a hashed invitation before sending through Resend", async () => {
    const { admin } = configureValidInvite()
    const sendEmail = mockResend({ ok: true, provider: "resend", id: "email_123" })
    const { inviteTeamMemberAction } = await import("@/app/actions/team")
    const result = await inviteTeamMemberAction({ email: "NewHire@Spa.com", name: "New Hire", role: "Staff" })

    expect(result.ok).toBe(true)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const inserts = admin.callsFor("team_invitations", "insert")
    expect(inserts).toHaveLength(1)
    const payload = inserts[0].args[0] as Record<string, unknown>
    expect(payload.email).toBe("newhire@spa.com")
    expect(payload.token_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(payload)).not.toContain("invite/accept?token")
  })

  it("does not claim success when Resend fails", async () => {
    const { admin } = configureValidInvite()
    mockResend({ ok: false, provider: "resend", error: "domain is not verified" })
    const { inviteTeamMemberAction } = await import("@/app/actions/team")
    const result = await inviteTeamMemberAction({ email: "newhire@spa.com", role: "Staff" })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errorType).toBe("EMAIL_DELIVERY_FAILED")
    const failedUpdate = admin.callsFor("team_invitations", "update").find((call: { args: unknown[] }) => (call.args[0] as Record<string, unknown>).delivery_status === "failed")
    expect(failedUpdate).toBeTruthy()
  })

  it("blocks duplicate pending invitations", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    seedActiveSubscription(server, "u_1")
    server.setResult("team_members", "select", { data: null, error: null })
    server.setResult("team_invitations", "select", { data: { id: "pending_1" }, error: null })
    mockResend({ ok: true, provider: "resend", id: "email_1" })
    const { inviteTeamMemberAction } = await import("@/app/actions/team")
    const result = await inviteTeamMemberAction({ email: "newhire@spa.com", role: "Staff" })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errorType).toBe("PENDING_INVITE_EXISTS")
    expect(server.callsFor("team_invitations", "insert")).toHaveLength(0)
  })

  it("blocks an existing active member", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    seedActiveSubscription(server, "u_1")
    server.setResult("team_members", "select", { data: { id: "member_1" }, error: null })
    server.setResult("team_invitations", "select", { data: null, error: null })
    mockResend({ ok: true, provider: "resend", id: "email_1" })
    const { inviteTeamMemberAction } = await import("@/app/actions/team")
    const result = await inviteTeamMemberAction({ email: "active@spa.com", role: "Staff" })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errorType).toBe("MEMBER_EXISTS")
  })
})

describe("team invitation acceptance", () => {
  it("accepts a valid token for the signed-in matching user", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "member_user", email: "newhire@spa.com", user_metadata: { full_name: "New Hire" } })
    server.setResult("accept_team_invitation", "rpc", { data: { memberId: "member_1" }, error: null })
    const { acceptTeamInvitationAction } = await import("@/app/actions/team")
    const result = await acceptTeamInvitationAction("a".repeat(64))

    expect(result.ok).toBe(true)
    expect(server.results.get("accept_team_invitation::rpc")?.error).toBeNull()
  })

  it("blocks acceptance when the signed-in email differs", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "wrong_user", email: "wrong@spa.com" })
    server.setResult("accept_team_invitation", "rpc", { data: null, error: { message: "INVITE_EMAIL_MISMATCH" } })
    const { acceptTeamInvitationAction } = await import("@/app/actions/team")
    const result = await acceptTeamInvitationAction("b".repeat(64))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errorType).toBe("INVITE_EMAIL_MISMATCH")
  })
})
