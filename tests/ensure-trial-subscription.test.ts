import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { installSupabaseMocks } from "./helpers/mock-supabase"

const TRIAL_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-06-20T12:00:00Z"))
})

afterEach(() => {
  vi.useRealTimers()
  vi.doUnmock("@/lib/supabase/server")
  vi.doUnmock("@/lib/supabase/admin")
  vi.doUnmock("server-only")
  vi.resetModules()
})

describe("subscription/ensureTrialSubscription", () => {
  it("creates a fresh trialing row when no subscription exists", async () => {
    const { server } = installSupabaseMocks()
    server.setResult("subscriptions", "select", { data: null, error: null })
    const futureEnd = new Date(Date.now() + TRIAL_DAYS * DAY_MS).toISOString()
    const nowIso = new Date().toISOString()
    server.setResult("subscriptions", "insert", {
      data: {
        id: "sub_new",
        user_id: "user_1",
        plan: "growth",
        status: "trialing",
        billing_interval: "monthly",
        monthly_quota: 3000,
        conversations_used: 0,
        period_start: nowIso,
        period_end: futureEnd,
        trial_started_at: nowIso,
        trial_ends_at: futureEnd,
        trial_popup_dismissed_at: null,
        canceled_at: null,
      },
      error: null,
    })

    const { ensureTrialSubscription } = await import("@/lib/subscription")
    const row = await ensureTrialSubscription("user_1", server.client as never)

    expect(row.id).toBe("sub_new")
    expect(row.status).toBe("trialing")
    expect(row.plan).toBe("growth")
    expect(row.trialStartedAt).toBeTruthy()
    expect(row.trialEndsAt).toBeTruthy()

    const expectedEnd = new Date(Date.now() + TRIAL_DAYS * DAY_MS).toISOString()
    expect(row.trialEndsAt).toBe(expectedEnd)

    const inserts = server.callsFor("subscriptions", "insert")
    expect(inserts.length).toBeGreaterThan(0)
  })

  it("returns the existing trialing row when trial is still active", async () => {
    const { server } = installSupabaseMocks()
    const futureEnd = new Date(Date.now() + 3 * DAY_MS).toISOString()
    server.setResult("subscriptions", "select", {
      data: {
        id: "sub_1",
        user_id: "user_1",
        plan: "growth",
        status: "trialing",
        billing_interval: "monthly",
        monthly_quota: 3000,
        conversations_used: 0,
        period_start: new Date(Date.now() - 4 * DAY_MS).toISOString(),
        period_end: futureEnd,
        trial_started_at: new Date(Date.now() - 4 * DAY_MS).toISOString(),
        trial_ends_at: futureEnd,
        trial_popup_dismissed_at: null,
        canceled_at: null,
      },
      error: null,
    })

    const { ensureTrialSubscription } = await import("@/lib/subscription")
    const row = await ensureTrialSubscription("user_1", server.client as never)

    expect(row.id).toBe("sub_1")
    expect(row.status).toBe("trialing")
    expect(server.callsFor("subscriptions", "insert").length).toBe(0)
    expect(server.callsFor("subscriptions", "update").length).toBe(0)
  })

  it("resets an expired trialing row to a fresh trial", async () => {
    const { server } = installSupabaseMocks()
    const pastEnd = new Date(Date.now() - DAY_MS).toISOString()
    server.setResult("subscriptions", "select", {
      data: {
        id: "sub_old",
        user_id: "user_1",
        plan: "growth",
        status: "trialing",
        billing_interval: "monthly",
        monthly_quota: 3000,
        conversations_used: 0,
        period_start: new Date(Date.now() - 8 * DAY_MS).toISOString(),
        period_end: pastEnd,
        trial_started_at: new Date(Date.now() - 8 * DAY_MS).toISOString(),
        trial_ends_at: pastEnd,
        trial_popup_dismissed_at: "2026-06-15T00:00:00Z",
        canceled_at: null,
      },
      error: null,
    })
    server.setResult("subscriptions", "update", {
      data: {
        id: "sub_old",
        user_id: "user_1",
        plan: "growth",
        status: "trialing",
        billing_interval: "monthly",
        monthly_quota: 3000,
        conversations_used: 0,
        period_start: new Date().toISOString(),
        period_end: new Date(Date.now() + TRIAL_DAYS * DAY_MS).toISOString(),
        trial_started_at: new Date().toISOString(),
        trial_ends_at: new Date(Date.now() + TRIAL_DAYS * DAY_MS).toISOString(),
        trial_popup_dismissed_at: null,
        canceled_at: null,
      },
      error: null,
    })

    const { ensureTrialSubscription } = await import("@/lib/subscription")
    const row = await ensureTrialSubscription("user_1", server.client as never)

    expect(row.id).toBe("sub_old")
    expect(row.status).toBe("trialing")
    const expectedEnd = new Date(Date.now() + TRIAL_DAYS * DAY_MS).toISOString()
    expect(row.trialEndsAt).toBe(expectedEnd)
    expect(row.trialPopupDismissedAt).toBeNull()

    expect(server.callsFor("subscriptions", "update").length).toBeGreaterThan(0)
  })

  it("resets a canceled subscription to a fresh trial", async () => {
    const { server } = installSupabaseMocks()
    server.setResult("subscriptions", "select", {
      data: {
        id: "sub_canceled",
        user_id: "user_1",
        plan: "starter",
        status: "canceled",
        billing_interval: "monthly",
        monthly_quota: 600,
        conversations_used: 0,
        period_start: "2026-01-01T00:00:00Z",
        period_end: "2026-02-01T00:00:00Z",
        trial_started_at: null,
        trial_ends_at: null,
        trial_popup_dismissed_at: null,
        canceled_at: "2026-01-15T00:00:00Z",
      },
      error: null,
    })
    server.setResult("subscriptions", "update", {
      data: {
        id: "sub_canceled",
        user_id: "user_1",
        plan: "growth",
        status: "trialing",
        billing_interval: "monthly",
        monthly_quota: 3000,
        conversations_used: 0,
        period_start: new Date().toISOString(),
        period_end: new Date(Date.now() + TRIAL_DAYS * DAY_MS).toISOString(),
        trial_started_at: new Date().toISOString(),
        trial_ends_at: new Date(Date.now() + TRIAL_DAYS * DAY_MS).toISOString(),
        trial_popup_dismissed_at: null,
        canceled_at: null,
      },
      error: null,
    })

    const { ensureTrialSubscription } = await import("@/lib/subscription")
    const row = await ensureTrialSubscription("user_1", server.client as never)

    expect(row.id).toBe("sub_canceled")
    expect(row.status).toBe("trialing")
    expect(row.plan).toBe("growth")
    expect(row.canceledAt).toBeNull()
  })

  it("does NOT reset an active paid subscription", async () => {
    const { server } = installSupabaseMocks()
    const futureEnd = new Date(Date.now() + 15 * DAY_MS).toISOString()
    server.setResult("subscriptions", "select", {
      data: {
        id: "sub_paid",
        user_id: "user_1",
        plan: "growth",
        status: "active",
        billing_interval: "monthly",
        monthly_quota: 3000,
        conversations_used: 12,
        period_start: new Date(Date.now() - 15 * DAY_MS).toISOString(),
        period_end: futureEnd,
        trial_started_at: null,
        trial_ends_at: null,
        trial_popup_dismissed_at: null,
        canceled_at: null,
      },
      error: null,
    })

    const { ensureTrialSubscription } = await import("@/lib/subscription")
    const row = await ensureTrialSubscription("user_1", server.client as never)

    expect(row.id).toBe("sub_paid")
    expect(row.status).toBe("active")
    expect(server.callsFor("subscriptions", "update").length).toBe(0)
    expect(server.callsFor("subscriptions", "insert").length).toBe(0)
  })
})
