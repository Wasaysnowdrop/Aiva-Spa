import { beforeEach, describe, expect, it, vi } from "vitest"

import { installSupabaseMocks } from "./helpers/mock-supabase"

beforeEach(() => vi.resetModules())

const lead = {
  id: "lead-1",
  user_id: "owner-1",
  name: "Jane Doe",
  service: "Botox",
  assigned_to: null,
}

const staff = {
  id: "member-1",
  member_user_id: "staff-user-1",
  business_id: "owner-1",
  name: "Jamie Lee",
  email: "jamie@spa.example",
  role: "Staff",
  status: "active",
}

describe("lead assignment action", () => {
  it("lets an owner assign an active Staff member and returns persisted details", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser({ id: "owner-1", email: "owner@spa.example" })
    admin.setResult("leads", "select", { data: lead, error: null })
    admin.setResult("team_members", "select", { data: staff, error: null })
    admin.setResult("leads", "update", { data: null, error: null })

    const { assignLeadAction } = await import("@/app/actions/leads")
    const result = await assignLeadAction("lead-1", "member-1")

    expect(result).toMatchObject({ ok: true, data: { leadId: "lead-1", assignedTo: { teamMemberId: "member-1", userId: "staff-user-1", name: "Jamie Lee" } } })
    expect(admin.callsFor("leads", "update")[0]?.args[0]).toMatchObject({ assigned_to: "member-1" })
    expect(admin.callsFor("audit_logs", "insert").length).toBeGreaterThan(0)
  })

  it("unassigns a lead by persisting null", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser({ id: "owner-1" })
    admin.setResult("leads", "select", { data: lead, error: null })
    admin.setResult("leads", "update", { data: null, error: null })

    const { assignLeadAction } = await import("@/app/actions/leads")
    const result = await assignLeadAction("lead-1", null)

    expect(result).toMatchObject({ ok: true, data: { leadId: "lead-1", assignedTo: null } })
    expect(admin.callsFor("leads", "update")[0]?.args[0]).toMatchObject({ assigned_to: null })
  })

  it("blocks an assignment to another business", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser({ id: "owner-1" })
    admin.setResult("leads", "select", { data: lead, error: null })
    admin.setResult("team_members", "select", { data: { ...staff, business_id: "other-owner" }, error: null })

    const { assignLeadAction } = await import("@/app/actions/leads")
    const result = await assignLeadAction("lead-1", "member-1")

    expect(result.ok).toBe(false)
    expect(admin.callsFor("leads", "update")).toHaveLength(0)
  })

  it("blocks Staff without assignment permission", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser({ id: "staff-user-1" })
    admin.setResult("leads", "select", { data: lead, error: null })
    admin.setResult("team_members", "select", { data: { ...staff, role: "Staff" }, error: null })

    const { assignLeadAction } = await import("@/app/actions/leads")
    const result = await assignLeadAction("lead-1", "member-1")

    expect(result.ok).toBe(false)
    expect(admin.callsFor("leads", "update")).toHaveLength(0)
  })

  it("returns a structured failure when the database update fails", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser({ id: "owner-1" })
    admin.setResult("leads", "select", { data: lead, error: null })
    admin.setResult("team_members", "select", { data: staff, error: null })
    admin.setResult("leads", "update", { data: null, error: { message: "database unavailable" } })

    const { assignLeadAction } = await import("@/app/actions/leads")
    const result = await assignLeadAction("lead-1", "member-1")

    expect(result).toEqual({ ok: false, error: "We couldn't update the assignment. Please try again." })
  })
})
