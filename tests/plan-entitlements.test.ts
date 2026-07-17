import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { deriveSnapshot, type SubscriptionRow } from "@/lib/subscription"
import {
  PLAN_ENTITLEMENTS,
  planAllowsFeature,
  planFromVariantId,
} from "@/lib/subscription/plans"

const now = new Date("2026-07-17T00:00:00.000Z")

function subscription(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: "sub-1",
    userId: "user-1",
    plan: "growth",
    status: "active",
    billingInterval: "monthly",
    monthlyQuota: 999_999,
    conversationsUsed: 0,
    periodStart: "2026-07-01T00:00:00.000Z",
    periodEnd: "2026-08-01T00:00:00.000Z",
    trialStartedAt: null,
    trialEndsAt: null,
    trialPopupDismissedAt: null,
    trialUsed: true,
    canceledAt: null,
    pendingPlan: null,
    pendingPlanEffectiveAt: null,
    billingVariantId: null,
    ...overrides,
  }
}

describe("canonical plan entitlements", () => {
  it("matches the published numeric limits", () => {
    expect(PLAN_ENTITLEMENTS.starter).toMatchObject({
      monthlyConversations: 300,
      widgets: 1,
      locations: 1,
      staffEmailRecipients: 1,
      languages: 1,
      customDomains: 0,
    })
    expect(PLAN_ENTITLEMENTS.growth).toMatchObject({
      monthlyConversations: 1_500,
      widgets: 2,
      locations: 2,
      staffEmailRecipients: 3,
      languages: 12,
      customDomains: 0,
    })
    expect(PLAN_ENTITLEMENTS.pro).toMatchObject({
      monthlyConversations: 5_000,
      widgets: Number.MAX_SAFE_INTEGER,
      locations: 5,
      staffEmailRecipients: 10,
      customDomains: 5,
    })
  })

  it("keeps Starter limited to the advertised core product", () => {
    expect(planAllowsFeature("starter", "widget")).toBe(true)
    expect(planAllowsFeature("starter", "lead_capture")).toBe(true)
    expect(planAllowsFeature("starter", "email_notifications")).toBe(true)
    expect(planAllowsFeature("starter", "conversation_history")).toBe(false)
    expect(planAllowsFeature("starter", "calendar_booking_links")).toBe(false)
    expect(planAllowsFeature("starter", "conversion_analytics")).toBe(false)
    expect(planAllowsFeature("starter", "custom_widget_colors")).toBe(false)
    expect(planAllowsFeature("starter", "role_based_access")).toBe(false)
  })

  it("gives Growth its advertised workflow features but no Pro entitlements", () => {
    for (const feature of [
      "conversation_history",
      "lead_scoring",
      "lead_tagging",
      "custom_fields",
      "service_routing",
      "calendar_booking_links",
      "conversion_analytics",
      "visitor_intelligence",
      "custom_widget_colors",
      "slack_notifications",
      "teams_notifications",
      "multi_language_widget",
    ] as const) {
      expect(planAllowsFeature("growth", feature)).toBe(true)
    }
    expect(planAllowsFeature("growth", "white_label")).toBe(false)
    expect(planAllowsFeature("growth", "custom_domain")).toBe(false)
    expect(planAllowsFeature("growth", "role_based_access")).toBe(false)
    expect(planAllowsFeature("growth", "advanced_analytics")).toBe(false)
  })

  it("gives Pro all Growth and Pro-only entitlements", () => {
    expect(Object.values(PLAN_ENTITLEMENTS.pro.features).every(Boolean)).toBe(true)
  })

  it("uses canonical quotas instead of stale database quota metadata", () => {
    expect(deriveSnapshot(subscription({ plan: "starter" }), now).quota).toBe(300)
    expect(deriveSnapshot(subscription({ plan: "growth" }), now).quota).toBe(1_500)
    expect(deriveSnapshot(subscription({ plan: "pro" }), now).quota).toBe(5_000)
  })
})

describe("effective plan states", () => {
  it("keeps a canceled subscription active until its paid period ends", () => {
    expect(deriveSnapshot(subscription({ status: "canceled" }), now).isActive).toBe(true)
    expect(
      deriveSnapshot(subscription({ status: "canceled", periodEnd: "2026-07-16T00:00:00.000Z" }), now)
        .isLocked,
    ).toBe(true)
  })

  it.each(["paused", "payment_failed", "expired"] as const)(
    "locks %s subscriptions",
    (status) => {
      expect(deriveSnapshot(subscription({ status }), now).isLocked).toBe(true)
    },
  )

  it("applies a scheduled downgrade only at its effective time", () => {
    const row = subscription({
      plan: "pro",
      pendingPlan: "starter",
      pendingPlanEffectiveAt: "2026-07-20T00:00:00.000Z",
    })
    expect(deriveSnapshot(row, now).planId).toBe("pro")
    expect(deriveSnapshot(row, new Date("2026-07-20T00:00:00.000Z")).planId).toBe("starter")
  })

  it("locks exactly when the canonical quota is exhausted", () => {
    const below = deriveSnapshot(subscription({ plan: "starter", conversationsUsed: 299 }), now)
    const at = deriveSnapshot(subscription({ plan: "starter", conversationsUsed: 300 }), now)
    expect(below.isQuotaExhausted).toBe(false)
    expect(at.isQuotaExhausted).toBe(true)
  })
})

describe("billing variant mapping", () => {
  afterEach(() => {
    delete process.env.LEMON_SQUEEZY_STARTER_VARIANT_ID
    delete process.env.LEMON_SQUEEZY_GROWTH_VARIANT_ID
    delete process.env.LEMON_SQUEEZY_PRO_VARIANT_ID
  })

  it("maps configured Lemon Squeezy variants to canonical plans", () => {
    process.env.LEMON_SQUEEZY_STARTER_VARIANT_ID = "variant-a"
    process.env.LEMON_SQUEEZY_GROWTH_VARIANT_ID = "variant-b"
    process.env.LEMON_SQUEEZY_PRO_VARIANT_ID = "variant-c"
    expect(planFromVariantId("variant-a")).toBe("starter")
    expect(planFromVariantId("variant-b")).toBe("growth")
    expect(planFromVariantId("variant-c")).toBe("pro")
    expect(planFromVariantId("unknown")).toBeNull()
  })
})

describe("server and database enforcement contracts", () => {
  const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8")

  it("locks restricted dashboard routes on the server", () => {
    expect(read("app/dashboard/conversations/page.tsx")).toContain('hasAccess("conversation_history")')
    expect(read("app/dashboard/calendar/page.tsx")).toContain('hasAccess("calendar_booking_links")')
    expect(read("app/dashboard/analytics/page.tsx")).toContain('hasAccess("conversion_analytics")')
    expect(read("app/dashboard/team/page.tsx")).toContain("getTeamDashboardData")
  })

  it("guards mutations and numeric resources centrally", () => {
    expect(read("app/actions/calendar.ts")).toContain('requireFeatureForUser(user.id, "calendar_booking_links"')
    expect(read("src/lib/team/access.server.ts")).toContain('requireFeatureForUser(user.id, "role_based_access"')
    expect(read("src/lib/team/server.ts")).toContain('assertPlanLimit(entitlement, "teamMembers"')
    expect(read("src/lib/widget/installs.ts")).toContain('assertPlanLimit(context, "widgets"')
    expect(read("src/lib/widget/domains.ts")).toContain('requireFeatureForUser(userId, "custom_domain"')
    expect(read("app/actions/widget.ts")).toContain('"staffEmailRecipients"')
  })

  it("retires API credentials and SMS safely in one migration", () => {
    const migration = read("supabase/migrations/00034_plan_entitlements_api_sms_retirement.sql")
    expect(migration).toContain("set revoked_at = coalesce(revoked_at, now())")
    expect(migration).toContain("revoke all on table public.api_keys from authenticated")
    expect(migration).toContain("where lower(channel) = 'sms'")
    expect(migration).toContain("where channel = 'sms' and sent_at is null")
    expect(migration).toContain("set reminder_sms_enabled = false")
    expect(migration).toContain("for update to authenticated")
    expect(migration).toContain("least(v_count, v_quota)")
  })

  it("keeps lead phone capture while removing SMS provider usage", () => {
    expect(read("src/components/dashboard/widget-settings.tsx")).toContain('label="Collect phone"')
    expect(read("src/lib/notifications/dispatch.ts")).not.toMatch(/sendSms|Twilio|sms:/i)
    expect(read("app/api/calendar/reminders/route.ts")).not.toMatch(/sendSms|Twilio/i)
    expect(read(".env.example")).not.toMatch(/TWILIO_/)
  })
})
