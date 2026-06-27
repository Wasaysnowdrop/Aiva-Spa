import { createAdminClient } from "@/lib/supabase/admin"
import {
  deriveSnapshot,
  type SubscriptionRow,
  type SubscriptionSnapshot,
} from "@/lib/subscription"
import { PLANS, TRIAL_PLAN_ID, TRIAL_QUOTA } from "@/lib/subscription/plans"

type RawSubscription = {
  id: string
  user_id: string
  plan: string
  status: string
  billing_interval: string
  monthly_quota: number
  conversations_used: number
  period_start: string
  period_end: string
  trial_started_at: string | null
  trial_ends_at: string | null
  trial_used: boolean
  trial_popup_dismissed_at: string | null
  canceled_at: string | null
}

function mapSubscription(row: RawSubscription): SubscriptionRow {
  return {
    id: row.id,
    userId: row.user_id,
    plan: (row.plan as SubscriptionRow["plan"]) ?? "starter",
    status: (row.status as SubscriptionRow["status"]) ?? "trialing",
    billingInterval:
      (row.billing_interval as "monthly" | "yearly") ?? "monthly",
    monthlyQuota: row.monthly_quota,
    conversationsUsed: row.conversations_used,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    trialStartedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
    trialUsed: row.trial_used,
    trialPopupDismissedAt: row.trial_popup_dismissed_at,
    canceledAt: row.canceled_at,
  }
}

function mapRow(row: RawSubscription): SubscriptionRow {
  return mapSubscription(row)
}

function newDateAddDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000)
}

/** DEVELOPMENT ONLY: auto-create widget_installs + trial subscription so the
 *  widget works without a full onboarding flow. Uses the admin client (service
 *  role) so it bypasses RLS completely. Safe for dev because it only runs when
 *  NODE_ENV === 'development'.
 *
 *  1. Finds-or-creates a widget_installs row for `spaId`.
 *  2. Finds-or-creates a trialing subscription for the install owner.
 *
 *  Returns the same EmbedAccess shape the production path uses, so callers
 *  don't need special dev handling. */
async function ensureDevAccess(spaId: string): Promise<EmbedAccess> {
  const admin = createAdminClient()

  // Find the first Supabase Auth user to own the test install.
  // If no user exists yet, use a stable synthetic id so subsequent calls
  // reuse the same rows.
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1 })
  const testUserId = users?.users?.[0]?.id ?? "aiva-dev-user"

  // Upsert an active widget_installs row.
  await admin
    .from("widget_installs")
    .upsert(
      {
        widget_key: spaId,
        user_id: testUserId,
        active: true,
      } as never,
      { onConflict: "widget_key", ignoreDuplicates: false },
    )
    .select()
    .maybeSingle()

  // Ensure a trial subscription exists for this user.
  const { data: existingSub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", testUserId)
    .maybeSingle()

  if (!existingSub) {
    const now = new Date()
    const trialEndsAt = newDateAddDays(now, 30)
    const trialPlan = PLANS[TRIAL_PLAN_ID] ?? PLANS.starter

    await admin.from("subscriptions").insert({
      user_id: testUserId,
      plan: trialPlan.id,
      status: "trialing" as const,
      billing_interval: "monthly" as const,
      monthly_quota: TRIAL_QUOTA,
      conversations_used: 0,
      period_start: now.toISOString(),
      period_end: trialEndsAt.toISOString(),
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      trial_popup_dismissed_at: null,
      canceled_at: null,
    } as never)
  }

  // Build a fresh Snapshot for the return value.
  const { data: freshSub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", testUserId)
    .maybeSingle()

  const subscription = deriveSnapshot(
    freshSub ? mapRow(freshSub as RawSubscription) : null,
  )

  return { ok: true, userId: testUserId, subscription }
}

export type EmbedAccess =
  | {
      ok: true
      userId: string
      subscription: SubscriptionSnapshot
    }
  | {
      ok: false
      reason: "not_found" | "inactive_install" | "expired"
    }

type CacheEntry = { value: EmbedAccess; at: number }
const CACHE_TTL_MS = 60_000
const cache = new Map<string, CacheEntry>()

export function invalidateEmbedAccessCache(spaId?: string) {
  if (spaId) cache.delete(spaId)
  else cache.clear()
}

export async function checkEmbedAccess(spaId: string): Promise<EmbedAccess> {
  if (!spaId) return { ok: false, reason: "not_found" }

  const cached = cache.get(spaId)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value
  }

  const admin = createAdminClient()

  const { data: install } = await admin
    .from("widget_installs")
    .select("widget_key, user_id, active")
    .eq("widget_key", spaId)
    .maybeSingle()

  if (!install) {
    // DEVELOPMENT: auto-create missing setup so testing works out of the box.
    if (process.env.NODE_ENV === "development") {
      console.log("[dev-access] no widget_installs for", spaId, "auto-setting up")
      const value = await ensureDevAccess(spaId)
      cache.set(spaId, { value, at: Date.now() })
      return value
    }
    const value: EmbedAccess = { ok: false, reason: "not_found" }
    cache.set(spaId, { value, at: Date.now() })
    return value
  }

  const installRow = install as {
    widget_key: string
    user_id: string
    active: boolean
  }

  if (!installRow.active) {
    // DEVELOPMENT: reactivate a deactivated install so testing is frictionless.
    if (process.env.NODE_ENV === "development") {
      console.log("[dev-access] reactivating inactive install for", spaId)
      await admin
        .from("widget_installs")
        .update({ active: true } as never)
        .eq("widget_key", spaId)
      installRow.active = true
    } else {
      const value: EmbedAccess = { ok: false, reason: "inactive_install" }
      cache.set(spaId, { value, at: Date.now() })
      return value
    }
  }

  const { data: subRow } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", installRow.user_id)
    .maybeSingle()

  const subscription = deriveSnapshot(
    subRow ? mapSubscription(subRow as RawSubscription) : null,
  )

  if (subscription.isLocked) {
    // DEVELOPMENT: renew an expired/canceled subscription so testing continues.
    if (process.env.NODE_ENV === "development") {
      console.log("[dev-access] renewing locked subscription for", installRow.user_id)
      const now = new Date()
      const trialEndsAt = newDateAddDays(now, 30)
      const trialPlan = PLANS[TRIAL_PLAN_ID] ?? PLANS.starter
      const renewPayload = {
        plan: trialPlan.id,
        status: "trialing" as const,
        billing_interval: "monthly" as const,
        monthly_quota: TRIAL_QUOTA,
        conversations_used: 0,
        period_start: now.toISOString(),
        period_end: trialEndsAt.toISOString(),
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
        trial_popup_dismissed_at: null,
        canceled_at: null,
      }

      if (subRow) {
        await admin
          .from("subscriptions")
          .update(renewPayload as never)
          .eq("user_id", installRow.user_id)
      } else {
        await admin
          .from("subscriptions")
          .insert({ user_id: installRow.user_id, ...renewPayload } as never)
      }

      const { data: renewedSub } = await admin
        .from("subscriptions")
        .select("*")
        .eq("user_id", installRow.user_id)
        .maybeSingle()

      const renewed = deriveSnapshot(
        renewedSub ? mapSubscription(renewedSub as RawSubscription) : null,
      )

      const value: EmbedAccess = { ok: true, userId: installRow.user_id, subscription: renewed }
      cache.set(spaId, { value, at: Date.now() })
      return value
    }

    const value: EmbedAccess = { ok: false, reason: "expired" }
    cache.set(spaId, { value, at: Date.now() })
    return value
  }

  const value: EmbedAccess = {
    ok: true,
    userId: installRow.user_id,
    subscription,
  }
  cache.set(spaId, { value, at: Date.now() })
  return value
}
