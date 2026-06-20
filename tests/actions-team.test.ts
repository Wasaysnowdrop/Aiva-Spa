import { beforeEach, describe, expect, it, vi } from "vitest"

import { installSupabaseMocks } from "./helpers/mock-supabase"

beforeEach(() => {
  vi.resetModules()
})

describe("inviteTeamMemberAction", () => {
  it("rejects an invalid email", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    const { inviteTeamMemberAction } = await import("@/app/actions/team")
    const result = await inviteTeamMemberAction({
      email: "not-an-email",
      role: "Staff",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/valid email/i)
    }
  })

  it("rejects an Owner role assignment", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    const { inviteTeamMemberAction } = await import("@/app/actions/team")
    const result = await inviteTeamMemberAction({
      email: "alex@spa.com",
      role: "Owner",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/Owner/i)
    }
  })

  it("creates a team_members row and returns an invite URL", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    server.setResult("team_members", "select", { data: null, error: null })
    server.setResult("team_members", "insert", {
      data: [{ id: "tm_1" }],
      error: null,
    })
    server.setResult("audit_logs", "insert", { data: null, error: null })

    const { inviteTeamMemberAction } = await import("@/app/actions/team")
    const result = await inviteTeamMemberAction({
      email: "newhire@spa.com",
      name: "New Hire",
      role: "Staff",
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.id).toBe("tm_1")
      expect(result.data.inviteUrl).toMatch(/^https?:\/\/.+\/invite\/invite_/)
    }

    const inserts = server
      .getCalls()
      .filter((c) => c.table === "team_members" && c.op === "insert")
    expect(inserts.length).toBe(1)
    const payload = inserts[0].args[0] as {
      name: string
      email: string
      role: string
      status: string
    }
    expect(payload.name).toBe("New Hire")
    expect(payload.email).toBe("newhire@spa.com")
    expect(payload.role).toBe("Staff")
    expect(payload.status).toBe("invited")
  })

  it("updates the existing row if the email already exists", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    server.setResult("team_members", "select", {
      data: [{ id: "tm_existing", status: "invited" }],
      error: null,
    })
    server.setResult("team_members", "update", {
      data: [{ id: "tm_existing" }],
      error: null,
    })
    server.setResult("audit_logs", "insert", { data: null, error: null })

    const { inviteTeamMemberAction } = await import("@/app/actions/team")
    const result = await inviteTeamMemberAction({
      email: "newhire@spa.com",
      role: "Manager",
    })
    expect(result.ok).toBe(true)

    const updates = server
      .getCalls()
      .filter((c) => c.table === "team_members" && c.op === "update")
    expect(updates.length).toBe(1)
  })

  it("blocks the invite if the email is already an active member", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    server.setResult("team_members", "select", {
      data: [{ id: "tm_existing", status: "active" }],
      error: null,
    })
    const { inviteTeamMemberAction } = await import("@/app/actions/team")
    const result = await inviteTeamMemberAction({
      email: "active@spa.com",
      role: "Staff",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/already on your team/i)
    }
  })
})

describe("updateTeamMemberRoleAction", () => {
  it("rejects promoting to Owner", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    const { updateTeamMemberRoleAction } = await import("@/app/actions/team")
    const result = await updateTeamMemberRoleAction("tm_1", "Owner")
    expect(result.ok).toBe(false)
  })

  it("updates the role and writes an audit log", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    server.setResult("team_members", "update", { data: null, error: null })
    server.setResult("audit_logs", "insert", { data: null, error: null })

    const { updateTeamMemberRoleAction } = await import("@/app/actions/team")
    const result = await updateTeamMemberRoleAction("tm_1", "Manager")
    expect(result.ok).toBe(true)
    const updates = server
      .getCalls()
      .filter((c) => c.table === "team_members" && c.op === "update")
    expect(updates.length).toBe(1)
  })
})

describe("removeTeamMemberAction", () => {
  it("deletes the row", async () => {
    const { admin, server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    admin.setResult("team_members", "delete", { data: null, error: null })
    server.setResult("audit_logs", "insert", { data: null, error: null })

    const { removeTeamMemberAction } = await import("@/app/actions/team")
    const result = await removeTeamMemberAction("tm_1")
    expect(result.ok).toBe(true)
  })
})
