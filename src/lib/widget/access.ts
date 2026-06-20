import { createAdminClient } from "@/lib/supabase/admin"
import {
  deriveSnapshot,
  type SubscriptionRow,
  type SubscriptionSnapshot,
} from "@/lib/subscription"

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
    trialPopupDismissedAt: row.trial_popup_dismissed_at,
    canceledAt: row.canceled_at,
  }
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
    const value: EmbedAccess = { ok: false, reason: "inactive_install" }
    cache.set(spaId, { value, at: Date.now() })
    return value
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
