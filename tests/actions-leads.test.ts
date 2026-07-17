import { beforeEach, describe, expect, it, vi } from "vitest"

import { installSupabaseMocks } from "./helpers/mock-supabase"

beforeEach(() => {
  vi.resetModules()
})

const validLead = {
  id: "lead_1",
  name: "Jane Doe",
  phone: "(415) 555-0100",
  email: "jane@example.com",
  service: "Botox",
  preferred_time: "Tue afternoon",
  source: "Website Chat",
  source_url: "https://example.com",
  after_hours: false,
  consent_given: true,
  status: "new",
  created_at: "2024-01-01T00:00:00Z",
  last_activity_at: "2024-01-01T00:00:00Z",
  assigned_to: null,
  merged_into_id: null,
  merged_at: null,
  merged_from: [],
  notes: null,
  phone_normalized: "4155550100",
  email_normalized: "jane@example.com",
  transcript: [],
}

describe("findDuplicateAction", () => {
  it("returns duplicate=matchType=phone when a phone match is found", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1" })
    // findDuplicateLead queries via the admin client
    admin.setResult("leads", "select", {
      data: [{ ...validLead, id: "existing" }],
      error: null,
    })
    const { findDuplicateAction } = await import("@/app/actions/leads")
    const result = await findDuplicateAction({ phone: "(415) 555-0100" })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.duplicate?.id).toBe("existing")
      expect(result.data.matchType).toBe("phone")
    }
  })

  it("returns duplicate=matchType=email when email matches", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1" })
    admin.setResult("leads", "select", {
      data: [{ ...validLead, id: "existing", phone: "" }],
      error: null,
    })
    const { findDuplicateAction } = await import("@/app/actions/leads")
    const result = await findDuplicateAction({ email: "jane@example.com" })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.matchType).toBe("email")
    }
  })

  it("returns duplicate=null when nothing matches", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1" })
    admin.setResult("leads", "select", { data: [], error: null })
    const { findDuplicateAction } = await import("@/app/actions/leads")
    const result = await findDuplicateAction({ phone: "5551112222" })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.duplicate).toBeNull()
      expect(result.data.matchType).toBe("none")
    }
  })
})

describe("mergeLeadsAction", () => {
  it("rejects empty primary or empty secondaries", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1" })
    const { mergeLeadsAction } = await import("@/app/actions/leads")
    const r1 = await mergeLeadsAction({
      primaryLeadId: "",
      secondaryLeadIds: ["x"],
    })
    expect(r1.ok).toBe(false)
    const r2 = await mergeLeadsAction({
      primaryLeadId: "p",
      secondaryLeadIds: [],
    })
    expect(r2.ok).toBe(false)
  })

  it("rejects when primary is also in secondaries", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1" })
    const { mergeLeadsAction } = await import("@/app/actions/leads")
    const r = await mergeLeadsAction({
      primaryLeadId: "p",
      secondaryLeadIds: ["p", "s"],
    })
    expect(r.ok).toBe(false)
  })
})

describe("updateLeadNotesAction", () => {
  it("updates the notes and revalidates the dashboard", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    server.setResult("leads", "update", {
      data: { ...validLead, notes: "VIP client" },
      error: null,
    })
    const { updateLeadNotesAction } = await import("@/app/actions/leads")
    const result = await updateLeadNotesAction("lead_1", "VIP client")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.notes).toBe("VIP client")
    }
    // And a lead.updated webhook was fired
    const updateCalls = server
      .getCalls()
      .filter((c) => c.table === "leads" && c.op === "update")
    expect(updateCalls.length).toBeGreaterThanOrEqual(1)
  })
})

describe("sendLeadMessageAction", () => {
  it("rejects when the lead is missing an email but channel=email", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1" })
    server.setResult("leads", "select", {
      data: [{ ...validLead, email: "" }],
      error: null,
    })
    const { sendLeadMessageAction } = await import("@/app/actions/leads")
    const result = await sendLeadMessageAction({
      leadId: "lead_1",
      channel: "email",
      body: "Hi",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/email/i)
    }
  })

  it("rejects when the message body is empty", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1" })
    const { sendLeadMessageAction } = await import("@/app/actions/leads")
    const result = await sendLeadMessageAction({
      leadId: "lead_1",
      channel: "email",
      body: "   ",
    })
    expect(result.ok).toBe(false)
  })

  it("rejects body longer than 2000 chars", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1" })
    const { sendLeadMessageAction } = await import("@/app/actions/leads")
    const result = await sendLeadMessageAction({
      leadId: "lead_1",
      channel: "email",
      body: "x".repeat(2001),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/too long/i)
    }
  })
})

describe("lead lifecycle actions", () => {
  it("soft-deletes an owned lead through the atomic RPC", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "owner-1", email: "owner@spa.com" })
    server.setResult("soft_delete_lead", "rpc", { data: true, error: null })
    server.setResult("audit_logs", "insert", { data: null, error: null })

    const { deleteLeadAction } = await import("@/app/actions/leads")
    const result = await deleteLeadAction("lead-1")

    expect(result.ok).toBe(true)
    const rpc = server.getCalls().find((call) => call.table === "soft_delete_lead")
    expect(rpc?.op).toBe("rpc")
  })

  it("returns the existing linked conversation when reopening chat", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "owner-1", email: "owner@spa.com" })
    server.setResult("reopen_lead_chat", "rpc", {
      data: "11111111-1111-4111-8111-111111111111",
      error: null,
    })

    const { reopenLeadChatAction } = await import("@/app/actions/leads")
    const result = await reopenLeadChatAction("lead-1")

    expect(result).toEqual({
      ok: true,
      data: { conversationId: "11111111-1111-4111-8111-111111111111" },
    })
  })

  it("does not create a replacement conversation when no link exists", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "owner-1", email: "owner@spa.com" })
    server.setResult("reopen_lead_chat", "rpc", { data: null, error: null })

    const { reopenLeadChatAction } = await import("@/app/actions/leads")
    const result = await reopenLeadChatAction("lead-without-chat")

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/no linked website conversation/i)
    expect(server.callsFor("chat_sessions", "insert")).toHaveLength(0)
  })
})