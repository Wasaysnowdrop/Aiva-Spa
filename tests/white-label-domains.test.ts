import { beforeEach, describe, expect, it, vi } from "vitest"

import { installSupabaseMocks } from "./helpers/mock-supabase"

beforeEach(() => {
  vi.resetModules()
})

describe("widget/domains — normalizeDomain", () => {
  it("lowercases and strips the protocol and path", async () => {
    installSupabaseMocks()
    const { normalizeDomain } = await import("@/lib/widget/domains")
    expect(normalizeDomain("HTTPS://Chat.GlowMedspa.COM/path?x=1")).toBe(
      "chat.glowmedspa.com",
    )
  })

  it("strips www. prefix and a trailing port", async () => {
    installSupabaseMocks()
    const { normalizeDomain } = await import("@/lib/widget/domains")
    expect(normalizeDomain("www.glowmedspa.com:8080")).toBe("glowmedspa.com")
  })

  it("rejects empty / invalid / local / platform hostnames", async () => {
    installSupabaseMocks()
    const { normalizeDomain } = await import("@/lib/widget/domains")
    expect(normalizeDomain("")).toBeNull()
    expect(normalizeDomain("   ")).toBeNull()
    expect(normalizeDomain("not a domain")).toBeNull()
    expect(normalizeDomain("localhost")).toBeNull()
    expect(normalizeDomain("chat.localhost")).toBeNull()
    expect(normalizeDomain("aivaspa.online")).toBeNull()
    expect(normalizeDomain("chat.aivaspa.online")).toBeNull()
  })

  it("accepts a normal sub- or apex domain", async () => {
    installSupabaseMocks()
    const { normalizeDomain } = await import("@/lib/widget/domains")
    expect(normalizeDomain("chat.glowmedspa.com")).toBe("chat.glowmedspa.com")
    expect(normalizeDomain("glowmedspa.com")).toBe("glowmedspa.com")
  })
})

describe("widget/domains — resolveCustomDomain", () => {
  it("returns null when the host is not registered", async () => {
    const { admin } = installSupabaseMocks()
    admin.setResult("custom_domains", "select", { data: null, error: null })
    const { resolveCustomDomain } = await import("@/lib/widget/domains")
    const out = await resolveCustomDomain("unknown.example.com")
    expect(out).toBeNull()
  })

  it("returns the mapped spaId for a known active custom domain", async () => {
    const { admin } = installSupabaseMocks()
    admin.setResult("custom_domains", "select", {
      data: {
        id: "d1",
        user_id: "u1",
        spa_id: "spa_abc",
        domain: "chat.glowmedspa.com",
        status: "active",
        verification_token: "tok",
        verified_at: "2024-01-01T00:00:00Z",
        last_checked_at: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
      error: null,
    })
    const { resolveCustomDomain } = await import("@/lib/widget/domains")
    const out = await resolveCustomDomain("chat.glowmedspa.com")
    expect(out?.spaId).toBe("spa_abc")
  })

  it("caches lookups for the same host within the TTL", async () => {
    const { admin } = installSupabaseMocks()
    admin.setResult("custom_domains", "select", {
      data: {
        id: "d1",
        user_id: "u1",
        spa_id: "spa_cached",
        domain: "chat.cached.com",
        status: "active",
        verification_token: "tok",
        verified_at: "2024-01-01T00:00:00Z",
        last_checked_at: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
      error: null,
    })
    const { resolveCustomDomain, invalidateCustomDomainCache } = await import(
      "@/lib/widget/domains"
    )
    invalidateCustomDomainCache()
    const a = await resolveCustomDomain("chat.cached.com")
    const b = await resolveCustomDomain("chat.cached.com")
    expect(a?.spaId).toBe("spa_cached")
    expect(b?.spaId).toBe("spa_cached")
    const calls = admin.callsFor("custom_domains", "select")
    expect(calls.length).toBe(1)
  })
})

describe("widget/domains — createCustomDomain", () => {
  it("refuses to create domains on plans without white-label", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u1", email: "owner@spa.com" })
    server.setResult("subscriptions", "select", {
      data: {
        id: "sub_1",
        user_id: "u1",
        plan: "starter",
        status: "trialing",
        billing_interval: "monthly",
        monthly_quota: 300,
        conversations_used: 0,
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2099-12-31T00:00:00Z",
        trial_started_at: "2024-01-01T00:00:00Z",
        trial_ends_at: "2099-12-31T00:00:00Z",
        trial_popup_dismissed_at: null,
        canceled_at: null,
      },
      error: null,
    })
    const { createCustomDomain } = await import("@/lib/widget/domains")
    const out = await createCustomDomain("u1", { domain: "chat.example.com", spaId: "spa_1" })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe("plan")
  })

  it("creates a pending row for a Pro customer", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u1", email: "owner@spa.com" })
    server.setResult("subscriptions", "select", {
      data: {
        id: "sub_1",
        user_id: "u1",
        plan: "pro",
        status: "active",
        billing_interval: "monthly",
        monthly_quota: 5000,
        conversations_used: 0,
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2099-12-31T00:00:00Z",
        trial_started_at: null,
        trial_ends_at: null,
        trial_popup_dismissed_at: null,
        canceled_at: null,
      },
      error: null,
    })
    server.setResult("custom_domains", "select", { data: [], error: null })
    // The insert goes through createClient() (server), not the admin client.
    server.setResult("custom_domains", "insert", {
      data: [
        {
          id: "d_new",
          user_id: "u1",
          spa_id: "spa_1",
          domain: "chat.glowmedspa.com",
          status: "pending",
          verification_token: "tok",
          verified_at: null,
          last_checked_at: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      error: null,
    })
    const { createCustomDomain } = await import("@/lib/widget/domains")
    const out = await createCustomDomain("u1", {
      domain: "chat.glowmedspa.com",
      spaId: "spa_1",
    })
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.domain.domain).toBe("chat.glowmedspa.com")
      expect(out.domain.status).toBe("pending")
    }
  })

  it("rejects an invalid domain with code=invalid", async () => {
    installSupabaseMocks()
    const { createCustomDomain } = await import("@/lib/widget/domains")
    const out = await createCustomDomain("u1", { domain: "not a host", spaId: "spa_1" })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe("invalid")
  })

  it("rejects duplicates with code=duplicate", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u1", email: "owner@spa.com" })
    server.setResult("subscriptions", "select", {
      data: {
        id: "sub_1",
        user_id: "u1",
        plan: "pro",
        status: "active",
        billing_interval: "monthly",
        monthly_quota: 5000,
        conversations_used: 0,
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2099-12-31T00:00:00Z",
        trial_started_at: null,
        trial_ends_at: null,
        trial_popup_dismissed_at: null,
        canceled_at: null,
      },
      error: null,
    })
    server.setResult("custom_domains", "select", { data: [], error: null })
    server.setResult("custom_domains", "insert", {
      data: null,
      error: { message: "duplicate key", code: "23505" } as never,
    })
    const { createCustomDomain } = await import("@/lib/widget/domains")
    const out = await createCustomDomain("u1", {
      domain: "chat.glowmedspa.com",
      spaId: "spa_1",
    })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe("duplicate")
  })
})

describe("widget/domains — activateCustomDomain", () => {
  it("flips status to active and stamps verified_at", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u1", email: "owner@spa.com" })
    server.setResult("custom_domains", "update", {
      data: [
        {
          id: "d1",
          user_id: "u1",
          spa_id: "spa_1",
          domain: "chat.glowmedspa.com",
          status: "active",
          verification_token: "tok",
          verified_at: "2024-02-01T00:00:00Z",
          last_checked_at: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-02-01T00:00:00Z",
        },
      ],
      error: null,
    })
    const { activateCustomDomain } = await import("@/lib/widget/domains")
    const out = await activateCustomDomain("u1", "d1")
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.domain?.status).toBe("active")
      expect(out.domain?.verifiedAt).not.toBeNull()
    }
  })
})
