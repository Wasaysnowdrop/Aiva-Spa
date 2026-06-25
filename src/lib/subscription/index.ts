import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  PLANS,
  TRIAL_DAYS,
  TRIAL_PLAN_ID,
  TRIAL_QUOTA,
  getPlan,
  type PlanId,
  type PlanPermissions,
  planAllowsFeature,
} from "./plans"

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "canceled"
  | "expired"
  | "none"

export type SubscriptionRow = {
  id: string
  userId: string
  plan: PlanId
  status: SubscriptionStatus
  billingInterval: "monthly" | "yearly"
  monthlyQuota: number
  conversationsUsed: number
  periodStart: string
  periodEnd: string
  trialStartedAt: string | null
  trialEndsAt: string | null
  trialPopupDismissedAt: string | null
  canceledAt: string | null
}

export type SubscriptionSnapshot = {
  row: SubscriptionRow | null
  planId: PlanId
  planName: string
  status: SubscriptionStatus
  isTrialing: boolean
  isActive: boolean
  isLocked: boolean
  isQuotaExhausted: boolean
  trialDaysRemaining: number
  trialEndsAt: Date | null
  quota: number
  used: number
  remaining: number
  hasAccess: (feature: keyof PlanPermissions) => boolean
}

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

function mapRow(row: RawSubscription): SubscriptionRow {
  return {
    id: row.id,
    userId: row.user_id,
    plan: (row.plan as PlanId) ?? "starter",
    status: (row.status as SubscriptionStatus) ?? "trialing",
    billingInterval: (row.billing_interval as "monthly" | "yearly") ?? "monthly",
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

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000

function nextPeriodEnd(from: Date) {
  return new Date(from.getTime() + PERIOD_MS)
}

export function deriveSnapshot(
  row: SubscriptionRow | null,
  now: Date = new Date(),
): SubscriptionSnapshot {
  if (!row) {
    return {
      row: null,
      planId: "starter",
      planName: "Starter",
      status: "none",
      isTrialing: false,
      isActive: false,
      isLocked: true,
      isQuotaExhausted: false,
      trialDaysRemaining: 0,
      trialEndsAt: null,
      quota: 0,
      used: 0,
      remaining: 0,
      hasAccess: () => false,
    }
  }

  const trialEndsAt = row.trialEndsAt ? new Date(row.trialEndsAt) : null
  const periodEnd = new Date(row.periodEnd)

  // Auto-expire if the active period is in the past and status isn't already expired
  let status: SubscriptionStatus = row.status
  if (status === "active" && periodEnd.getTime() <= now.getTime()) {
    status = "expired"
  }
  if (status === "trialing" && trialEndsAt && trialEndsAt.getTime() <= now.getTime()) {
    status = "expired"
  }

  const isTrialing = status === "trialing"
  const isActive = status === "active" || status === "trialing"
  const isLocked = !isActive

  const isQuotaExhausted =
    isActive &&
    row.monthlyQuota !== Number.MAX_SAFE_INTEGER &&
    row.conversationsUsed >= row.monthlyQuota

  const trialDaysRemaining = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : 0

  const plan = getPlan(row.plan)

  return {
    row: { ...row, status },
    planId: plan.id,
    planName: plan.name,
    status,
    isTrialing,
    isActive,
    isLocked,
    isQuotaExhausted,
    trialDaysRemaining,
    trialEndsAt,
    quota: row.monthlyQuota,
    used: row.conversationsUsed,
    remaining:
      row.monthlyQuota === Number.MAX_SAFE_INTEGER
        ? Number.MAX_SAFE_INTEGER
        : Math.max(0, row.monthlyQuota - row.conversationsUsed),
    hasAccess: (feature: PlanFeature) =>
      isActive && planAllowsFeature(plan.id, feature),
  }
}

export async function getSubscriptionForUser(
  userId: string,
): Promise<SubscriptionSnapshot> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    return deriveSnapshot(null)
  }
  return deriveSnapshot(data ? mapRow(data as RawSubscription) : null)
}

export async function getCurrentSubscription(): Promise<SubscriptionSnapshot> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return deriveSnapshot(null)
  return getSubscriptionForUser(user.id)
}

export function getTrialDates(now: Date = new Date()) {
  const start = new Date(now)
  const end = newDateAddDays(start, TRIAL_DAYS)
  return { start, end }
}

function newDateAddDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000)
}

export async function ensureTrialSubscription(
  userId: string,
  client?: SupabaseClient,
): Promise<SubscriptionRow> {
  const supabase = client ?? (await createClient())
  const existing = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  const raw = existing.data as RawSubscription | null
  const isFreshTrialNeeded =
    !raw ||
    raw.status === "expired" ||
    raw.status === "canceled" ||
    (raw.status === "trialing" &&
      raw.trial_ends_at &&
      new Date(raw.trial_ends_at).getTime() <= Date.now())

  if (raw && !isFreshTrialNeeded) {
    return mapRow(raw)
  }

  const now = new Date()
  const trialEndsAt = newDateAddDays(now, TRIAL_DAYS)
  const trialPlan = PLANS[TRIAL_PLAN_ID] ?? PLANS.starter

  const payload = {
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

  if (raw?.id) {
    const { data, error } = await supabase
      .from("subscriptions")
      .update(payload as never)
      .eq("id", raw.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return mapRow(data as RawSubscription)
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: userId,
      ...payload,
    } as never)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as RawSubscription)
}

export type UpgradeResult =
  | { ok: true; plan: PlanId }
  | { ok: false; error: string }

export async function activatePaidPlan(
  userId: string,
  planId: PlanId,
  interval: "monthly" | "yearly" = "monthly",
  cardLast4: string = "4242",
): Promise<UpgradeResult> {
  const plan = PLANS[planId]
  if (!plan) return { ok: false, error: "Unknown plan." }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  const now = new Date()
  const periodEnd = nextPeriodEnd(now)

  const payload = {
    plan: plan.id,
    status: "active",
    billing_interval: interval,
    monthly_quota: plan.monthlyQuota,
    conversations_used: 0,
    period_start: now.toISOString(),
    period_end: periodEnd.toISOString(),
    canceled_at: null,
  }

  const existingId = (existing as { id?: string } | null)?.id
  if (existingId) {
    const { error } = await supabase
      .from("subscriptions")
      .update(payload as never)
      .eq("id", existingId)
    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await supabase
      .from("subscriptions")
      .insert({ user_id: userId, ...payload } as never)
    if (error) return { ok: false, error: error.message }
  }

  // Persist card last 4 on the auth user metadata so settings can show it
  await supabase.auth.updateUser({
    data: { card_last4: cardLast4 },
  })

  return { ok: true, plan: plan.id }
}

export async function dismissTrialPopup(userId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("subscriptions")
    .update({ trial_popup_dismissed_at: new Date().toISOString() } as never)
    .eq("user_id", userId)
  if (error) throw new Error(error.message)
}

export async function incrementConversations(userId: string, by = 1) {
  const supabase = await createClient()
  const { data: row } = await supabase
    .from("subscriptions")
    .select("conversations_used")
    .eq("user_id", userId)
    .maybeSingle()

  if (!row) return
  const current = (row as { conversations_used?: number }).conversations_used ?? 0
  const next = current + by
  await supabase
    .from("subscriptions")
    .update({ conversations_used: next } as never)
    .eq("user_id", userId)
  return next
}

/**
 * Recalculate `conversations_used` from the real `chat_sessions` table.
 * Used to backfill quota for users who chatted before the increment
 * hook was wired up. Counts unique session_ids in the current period
 * and never reduces an already-higher value (so we never roll back
 * usage that's already been billed).
 */
export async function backfillConversationsFromSessions(
  userId: string,
): Promise<number | null> {
  const supabase = await createClient()
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("conversations_used, period_start")
    .eq("user_id", userId)
    .maybeSingle()
  if (!sub) return null
  const subRow = sub as { conversations_used?: number; period_start?: string }
  const periodStart = subRow.period_start ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Find the user's spa(s) via widget_installs so we can scope the count.
  const { data: installs } = await supabase
    .from("widget_installs")
    .select("widget_key")
    .eq("user_id", userId)
  const widgetKeys = (installs ?? [])
    .map((r) => (r as { widget_key?: string }).widget_key)
    .filter((k): k is string => Boolean(k))

  let query = supabase
    .from("chat_sessions")
    .select("id", { count: "exact", head: true })
    .gte("created_at", periodStart)
  if (widgetKeys.length > 0) {
    query = query.in("spa_id", widgetKeys)
  } else {
    // No installs — can't scope; skip the backfill.
    return null
  }
  const { count } = await query
  const counted = count ?? 0
  const current = subRow.conversations_used ?? 0
  const next = Math.max(current, counted)
  if (next === current) return current
  await supabase
    .from("subscriptions")
    .update({ conversations_used: next } as never)
    .eq("user_id", userId)
  return next
}

export function shouldShowTrialPopup(snap: SubscriptionSnapshot): boolean {
  if (!snap.isTrialing) return false
  if (snap.row?.trialPopupDismissedAt) return false
  return true
}

export function getCardLast4(userMetadata: Record<string, unknown> | null | undefined): string {
  const v = (userMetadata as { card_last4?: string } | null)?.card_last4
  if (typeof v === "string" && v.length >= 4) return v.slice(-4)
  return "4242"
}
