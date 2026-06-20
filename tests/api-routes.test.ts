import { beforeEach, describe, expect, it, vi } from "vitest"

import { installSupabaseMocks } from "./helpers/mock-supabase"

beforeEach(() => {
  vi.resetModules()
})

describe("POST /api/leads (public lead capture)", () => {
  it("rejects invalid JSON with 400", async () => {
    installSupabaseMocks()
    const { POST } = await import("@/app/api/leads/route")
    const req = new Request("http://localhost:3000/api/leads", {
      method: "POST",
      body: "not json",
      headers: { "content-type": "application/json" },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/JSON/)
  })

  it("rejects a request missing required fields with 400", async () => {
    installSupabaseMocks()
    const { POST } = await import("@/app/api/leads/route")
    const req = new Request("http://localhost:3000/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "s1" }), // missing name/phone/service/preferredTime
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it("captures a complete lead, returns 201, fires lead.created webhook", async () => {
    const { server, admin } = installSupabaseMocks()

    // loadKnowledge reads widget_config (server) and knowledge tables
    server.setResult("widget_config", "select", {
      data: [
        {
          id: "w1",
          brand_name: "Glow Med Spa",
          welcome_message: "Hi",
          proactive_message: "Proactive",
          consent_text: "By chatting…",
          primary_color: "#E2E54B",
          position: "bottom-right",
          proactive_enabled: true,
          proactive_delay_seconds: 8,
          show_branding: true,
          collect_email: true,
          collect_phone: true,
          logo_initial: "G",
          working_hours: { enabled: false, tz: "UTC", schedule: [] },
        },
      ],
      error: null,
    })
    server.setResult("knowledge_services", "select", { data: [], error: null })
    server.setResult("knowledge_faqs", "select", { data: [], error: null })
    server.setResult("knowledge_guardrails", "select", { data: [], error: null })
    server.setResult("extended_kb", "select", { data: [], error: null })

    // createPublicLead uses admin.from("leads").insert(...).select().single()
    admin.setResult("leads", "insert", {
      data: [
        {
          id: "lead_abc",
          name: "Jane Doe",
          phone: "(415) 555-0100",
          email: "jane@example.com",
          service: "Botox",
          preferred_time: "Tue afternoon",
          source: "Website Chat",
          source_url: "/",
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
        },
      ],
      error: null,
    })

    // dedup lookup via admin
    admin.setResult("leads", "select", { data: [], error: null })

    // chat_sessions.markSessionLeadCaptured uses admin
    admin.setResult("chat_sessions", "update", { data: null, error: null })

    // dispatch reads notification_channels; for this test none enabled
    admin.setResult("notification_channels", "select", { data: [], error: null })

    // audit
    server.setResult("audit_logs", "insert", { data: null, error: null })

    const { POST } = await import("@/app/api/leads/route")
    const req = new Request("http://localhost:3000/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "sess_1",
        name: "Jane Doe",
        phone: "(415) 555-0100",
        email: "jane@example.com",
        service: "Botox",
        preferredTime: "Tue afternoon",
        consentGiven: true,
        sourceUrl: "https://example.com",
      }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(201)
    const body = (await res.json()) as {
      ok: boolean
      leadId: string
      merged: boolean
      notifications: { email: number; sms: number; failed: number }
    }
    expect(body.ok).toBe(true)
    expect(body.leadId).toBe("lead_abc")
    expect(body.merged).toBe(false)
    expect(body.notifications).toEqual({ email: 0, sms: 0, failed: 0 })

    // CORS header
    expect(res.headers.get("access-control-allow-origin")).toBe("*")
  })

  it("returns 200 (not 201) and merged=true when dedup finds a match", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setResult("widget_config", "select", {
      data: [
        {
          id: "w1",
          brand_name: "Glow Med Spa",
          welcome_message: "Hi",
          proactive_message: "x",
          consent_text: "x",
          primary_color: "#E2E54B",
          position: "bottom-right",
          proactive_enabled: true,
          proactive_delay_seconds: 8,
          show_branding: true,
          collect_email: true,
          collect_phone: true,
          logo_initial: "G",
          working_hours: { enabled: false, tz: "UTC", schedule: [] },
          extended_kb: {},
        },
      ],
      error: null,
    })
    server.setResult("knowledge_services", "select", { data: [], error: null })
    server.setResult("knowledge_faqs", "select", { data: [], error: null })
    server.setResult("knowledge_guardrails", "select", { data: [], error: null })

    // findDuplicateLead via admin returns the existing lead
    admin.setResult("leads", "select", {
      data: [
        {
          id: "existing_lead",
          name: "Jane D.",
          phone: "(415) 555-0100",
          email: "jane@example.com",
          phone_normalized: "4155550100",
          email_normalized: "jane@example.com",
          service: "Botox",
          preferred_time: "Tue",
          source: "Website Chat",
          source_url: "/",
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
          transcript: [],
        },
      ],
      error: null,
    })
    // mergeIncomingIntoLead runs: select again (returns same row), then update.
    // The update must return the merged row so single() resolves it.
    admin.setResult("leads", "update", {
      data: [
        {
          id: "existing_lead",
          name: "Jane Doe",
          phone: "(415) 555-0100",
          email: "jane@example.com",
          phone_normalized: "4155550100",
          email_normalized: "jane@example.com",
          service: "Botox",
          preferred_time: "Wed afternoon",
          source: "Website Chat",
          source_url: "/",
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
          transcript: [],
        },
      ],
      error: null,
    })
    admin.setResult("chat_sessions", "update", { data: null, error: null })
    admin.setResult("notification_channels", "select", { data: [], error: null })
    server.setResult("audit_logs", "insert", { data: null, error: null })

    const { POST } = await import("@/app/api/leads/route")
    const req = new Request("http://localhost:3000/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "sess_2",
        name: "Jane Doe",
        phone: "(415) 555-0100",
        email: "jane@example.com",
        service: "Botox",
        preferredTime: "Wed afternoon",
        consentGiven: true,
      }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { merged: boolean; leadId: string }
    expect(body.merged).toBe(true)
    expect(body.leadId).toBe("existing_lead")
  })

  it("GET returns discovery info", async () => {
    installSupabaseMocks()
    const { GET } = await import("@/app/api/leads/route")
    const res = await GET(new Request("http://localhost:3000/api/leads"))
    const body = (await res.json()) as { ok: boolean; info: string }
    expect(body.ok).toBe(true)
    expect(body.info).toMatch(/POST a lead/)
  })

  it("OPTIONS responds 204 with CORS headers", async () => {
    installSupabaseMocks()
    const { OPTIONS } = await import("@/app/api/leads/route")
    const res = OPTIONS(new Request("http://localhost:3000/api/leads"))
    expect(res.status).toBe(204)
    expect(res.headers.get("access-control-allow-origin")).toBeTruthy()
  })
})

describe("GET /api/widget/config", () => {
  it("returns the public widget config (no PII)", async () => {
    const { admin } = installSupabaseMocks()
    const now = new Date()
    const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    // checkEmbedAccess: widget_installs + active subscription (admin client)
    admin.setResult("widget_installs", "select", {
      data: {
        widget_key: "spa_1",
        user_id: "u_owner",
        active: true,
      },
      error: null,
    })
    admin.setResult("subscriptions", "select", {
      data: {
        id: "sub_1",
        user_id: "u_owner",
        plan: "starter",
        status: "trialing",
        billing_interval: "monthly",
        monthly_quota: 200,
        conversations_used: 0,
        period_start: now.toISOString(),
        period_end: trialEndsAt.toISOString(),
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
        trial_popup_dismissed_at: null,
        canceled_at: null,
      },
      error: null,
    })
    admin.setResult("widget_config", "select", {
      data: {
        id: "w1",
        brand_name: "Glow Med Spa",
        welcome_message: "Hi! Want a consult?",
        proactive_message: "Still browsing?",
        consent_text: "By chatting…",
        primary_color: "#E2E54B",
        position: "bottom-right",
        proactive_enabled: true,
        proactive_delay_seconds: 8,
        show_branding: true,
        collect_email: true,
        collect_phone: true,
        logo_initial: "G",
        working_hours: { enabled: false, tz: "UTC", schedule: [] },
        extended_kb: {},
      },
      error: null,
    })
    admin.setResult("knowledge_services", "select", { data: [{}, {}], error: null })
    admin.setResult("knowledge_faqs", "select", { data: [{}, {}, {}], error: null })
    admin.setResult("knowledge_guardrails", "select", { data: [], error: null })

    const { GET } = await import("@/app/api/widget/config/route")
    const req = new Request("http://localhost:3000/api/widget/config?spaId=spa_1")
    const res = await GET(req)
    const body = (await res.json()) as {
      locked: boolean
      brandName: string
      faqCount: number
      serviceCount: number
    }
    expect(body.locked).toBe(false)
    expect(body.brandName).toBe("Glow Med Spa")
    expect(body.serviceCount).toBe(2)
    expect(body.faqCount).toBe(3)
    // PII guard: no email, phone, notes, transcripts
    expect(body).not.toHaveProperty("email")
    expect(body).not.toHaveProperty("phone")
    expect(body).not.toHaveProperty("notes")
  })

  it("returns locked=true when spaId is not found", async () => {
    const { server, admin } = installSupabaseMocks()
    // widget_installs lookup returns empty for the spaId
    server.setResult("widget_installs", "select", { data: null, error: null })
    admin.setResult("widget_config", "select", {
      data: {
        id: "w1",
        brand_name: "Glow Med Spa",
        welcome_message: "Hi",
        proactive_message: "x",
        consent_text: "x",
        primary_color: "#E2E54B",
        position: "bottom-right",
        proactive_enabled: true,
        proactive_delay_seconds: 8,
        show_branding: true,
        collect_email: true,
        collect_phone: true,
        logo_initial: "G",
        working_hours: { enabled: false, tz: "UTC", schedule: [] },
        extended_kb: {},
      },
      error: null,
    })
    admin.setResult("knowledge_services", "select", { data: [], error: null })
    admin.setResult("knowledge_faqs", "select", { data: [], error: null })
    admin.setResult("knowledge_guardrails", "select", { data: [], error: null })

    const { GET } = await import("@/app/api/widget/config/route")
    const req = new Request("http://localhost:3000/api/widget/config?spaId=missing-spa")
    const res = await GET(req)
    const body = (await res.json()) as { locked: boolean; reason: string }
    expect(body.locked).toBe(true)
    expect(body.reason).toBe("not_found")
  })
})

describe("GET /api/dashboard/live", () => {
  it("returns 401 when the user is not signed in", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser(null)
    const { GET } = await import("@/app/api/dashboard/live/route")
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns active session count and today's leads for a signed-in user", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    server.setResult("chat_sessions", "select", { data: null, error: null, count: 4 })
    const now = new Date()
    const leadRows = Array.from({ length: 12 }, () => ({
      created_at: now.toISOString(),
      status: "new",
      after_hours: false,
    }))
    server.setResult("leads", "select", { data: leadRows, error: null })

    const { GET } = await import("@/app/api/dashboard/live/route")
    const res = await GET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      activeSessions: number
      leadsToday: number
      leadsThisWeek: number
      asOf: string
    }
    expect(body.activeSessions).toBe(4)
    expect(body.leadsToday).toBe(12)
    expect(body.leadsThisWeek).toBe(12)
    expect(typeof body.asOf).toBe("string")
  })
})

describe("POST /api/v1/leads (API-key authed)", () => {
  it("GET returns the supported events list", async () => {
    installSupabaseMocks()
    const { GET } = await import("@/app/api/v1/leads/route")
    const res = await GET(new Request("http://localhost:3000/api/v1/leads"))
    const body = (await res.json()) as {
      events_supported: string[]
      info: string
    }
    expect(body.events_supported).toContain("lead.created")
    expect(body.events_supported).toContain("conversation.started")
  })

  it("OPTIONS responds 204 with CORS headers", async () => {
    installSupabaseMocks()
    const { OPTIONS } = await import("@/app/api/v1/leads/route")
    const res = OPTIONS(new Request("http://localhost:3000/api/v1/leads"))
    expect(res.status).toBe(204)
    expect(res.headers.get("access-control-allow-origin")).toBeTruthy()
  })

  it("rejects requests without an API key", async () => {
    installSupabaseMocks()
    const { POST } = await import("@/app/api/v1/leads/route")
    const req = new Request("http://localhost:3000/api/v1/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/API key/i)
  })

  it("rejects requests where the API key is unknown", async () => {
    const { server } = installSupabaseMocks()
    server.setResult("api_keys", "select", { data: null, error: null })

    const { POST } = await import("@/app/api/v1/leads/route")
    const req = new Request("http://localhost:3000/api/v1/leads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": "aiva_live_does_not_exist",
      },
      body: JSON.stringify({}),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(401)
  })

  it("rejects a valid key without leads:write scope", async () => {
    const { server } = installSupabaseMocks()
    server.setResult("api_keys", "select", {
      data: [
        {
          id: "key_1",
          user_id: "u_owner",
          scopes: ["leads:read"],
          revoked_at: null,
          expires_at: null,
        },
      ],
      error: null,
    })

    const { POST } = await import("@/app/api/v1/leads/route")
    const req = new Request("http://localhost:3000/api/v1/leads", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "aiva_live_anything" },
      body: JSON.stringify({
        name: "x",
        phone: "4155550100",
        service: "Botox",
        preferredTime: "Tue",
      }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/leads:write/)
  })

  it("validates required fields (name, phone, service, preferredTime)", async () => {
    const { server } = installSupabaseMocks()
    server.setResult("api_keys", "select", {
      data: [
        {
          id: "key_1",
          user_id: "u_owner",
          scopes: ["leads:write"],
          revoked_at: null,
          expires_at: null,
        },
      ],
      error: null,
    })

    const { POST } = await import("@/app/api/v1/leads/route")
    const req = new Request("http://localhost:3000/api/v1/leads", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "aiva_live_anything" },
      body: JSON.stringify({ name: "only" }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/required|invalid|expected/i)
  })

  it("rejects an invalid email", async () => {
    const { server } = installSupabaseMocks()
    server.setResult("api_keys", "select", {
      data: [
        {
          id: "key_1",
          user_id: "u_owner",
          scopes: ["leads:write"],
          revoked_at: null,
          expires_at: null,
        },
      ],
      error: null,
    })

    const { POST } = await import("@/app/api/v1/leads/route")
    const req = new Request("http://localhost:3000/api/v1/leads", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "aiva_live_anything" },
      body: JSON.stringify({
        name: "Jane",
        phone: "4155550100",
        service: "Botox",
        preferredTime: "Tue",
        email: "not-an-email",
      }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/email/i)
  })

  it("accepts Bearer auth, creates a lead, returns 201", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setResult("api_keys", "select", {
      data: [
        {
          id: "key_1",
          user_id: "u_owner",
          scopes: ["leads:write"],
          revoked_at: null,
          expires_at: null,
        },
      ],
      error: null,
    })
    server.setResult("widget_config", "select", {
      data: [
        {
          id: "w1",
          brand_name: "Glow Med Spa",
          welcome_message: "Hi",
          proactive_message: "x",
          consent_text: "x",
          primary_color: "#E2E54B",
          position: "bottom-right",
          proactive_enabled: true,
          proactive_delay_seconds: 8,
          show_branding: true,
          collect_email: true,
          collect_phone: true,
          logo_initial: "G",
          working_hours: { enabled: false, tz: "UTC", schedule: [] },
        },
      ],
      error: null,
    })
    server.setResult("knowledge_services", "select", { data: [], error: null })
    server.setResult("knowledge_faqs", "select", { data: [], error: null })
    server.setResult("knowledge_guardrails", "select", { data: [], error: null })
    admin.setResult("leads", "select", { data: [], error: null })
    admin.setResult("leads", "insert", {
      data: [
        {
          id: "lead_v1",
          name: "Jane",
          phone: "4155550100",
          email: "jane@example.com",
          service: "Botox",
          preferred_time: "Tue",
          source: "Direct Link",
          source_url: "/",
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
        },
      ],
      error: null,
    })
    admin.setResult("chat_sessions", "update", { data: null, error: null })
    admin.setResult("notification_channels", "select", { data: [], error: null })

    const { POST } = await import("@/app/api/v1/leads/route")
    const req = new Request("http://localhost:3000/api/v1/leads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer aiva_live_anything",
      },
      body: JSON.stringify({
        name: "Jane",
        phone: "4155550100",
        email: "jane@example.com",
        service: "Botox",
        preferredTime: "Tue",
      }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(201)
    const body = (await res.json()) as { ok: boolean; leadId: string; lead: { id: string } }
    expect(body.ok).toBe(true)
    expect(body.leadId).toBe("lead_v1")
    expect(body.lead.id).toBe("lead_v1")
  })
})
