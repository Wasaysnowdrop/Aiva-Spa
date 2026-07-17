import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  PLANS,
  TRIAL_DAYS,
  TRIAL_PLAN_ID,
  TRIAL_QUOTA,
  getPlan,
  type PlanId,
  type FeatureKey,
  getPlanEntitlements,
  isPlanId,
  planAllowsFeature,
  planRank,
} from "./plans"

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "canceled"
  | "expired"
  | "paused"
  | "payment_failed"
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
  trialUsed: boolean
  canceledAt: string | null
  pendingPlan?: PlanId | null
  pendingPlanEffectiveAt?: string | null
  billingVariantId?: string | null
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
  hasAccess: (feature: FeatureKey) => boolean
  canStartTrial: boolean
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
  trial_used: boolean
  canceled_at: string | null
  pending_plan?: string | null
  pending_plan_effective_at?: string | null
  billing_variant_id?: string | null
}

function mapRow(row: RawSubscription): SubscriptionRow {
  return {
    id: row.id,
    userId: row.user_id,
    plan: isPlanId(row.plan) ? row.plan : "starter",
    status: (row.status as SubscriptionStatus) ?? "trialing",
    billingInterval: (row.billing_interval as "monthly" | "yearly") ?? "monthly",
    monthlyQuota: row.monthly_quota,
    conversationsUsed: row.conversations_used,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    trialStartedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
    trialPopupDismissedAt: row.trial_popup_dismissed_at,
    trialUsed: row.trial_used ?? false,
    canceledAt: row.canceled_at,
    pendingPlan: row.pending_plan && row.pending_plan in PLANS ? row.pending_plan as PlanId : null,
    pendingPlanEffectiveAt: row.pending_plan_effective_at ?? null,
    billingVariantId: row.billing_variant_id ?? null,
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
      canStartTrial: false,
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
  const canceledStillEntitled = status === "canceled" && periodEnd.getTime() > now.getTime()
  const isActive = status === "active" || status === "trialing" || canceledStillEntitled
  const isLocked = !isActive
  const pendingEffective = row.pendingPlan && row.pendingPlanEffectiveAt
    ? new Date(row.pendingPlanEffectiveAt).getTime() <= now.getTime()
    : false
  const plan = getPlan(pendingEffective ? row.pendingPlan : row.plan)
  const canonicalQuota = getPlanEntitlements(plan.id).monthlyConversations

  const isQuotaExhausted =
    isActive &&
    canonicalQuota !== Number.MAX_SAFE_INTEGER &&
    row.conversationsUsed >= canonicalQuota

  const trialDaysRemaining = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : 0

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
    quota: canonicalQuota,
    used: row.conversationsUsed,
    remaining:
      canonicalQuota === Number.MAX_SAFE_INTEGER
        ? Number.MAX_SAFE_INTEGER
        : Math.max(0, canonicalQuota - row.conversationsUsed),
    hasAccess: (feature: FeatureKey) =>
      isActive && planAllowsFeature(plan.id, feature),
    canStartTrial: !row.trialUsed && !row.trialStartedAt,
  }
}

export async function getSubscriptionForUser(
  userId: string,
  client?: SupabaseClient,
): Promise<SubscriptionSnapshot> {
  const supabase = client ?? (await createClient())
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

  // If user already used their trial, never restart it
  if (raw?.trial_used) {
    return mapRow(raw)
  }

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
    trial_used: true,
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
  | { ok: true; plan: PlanId; effectiveAt: string | null }
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
  const { data: existingData, error: existingError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()
  if (existingError) return { ok: false, error: existingError.message }

  const existing = existingData ? mapRow(existingData as RawSubscription) : null
  const now = new Date()
  const currentPeriodEnd = existing ? new Date(existing.periodEnd) : null
  const currentStillActive = existing ? deriveSnapshot(existing, now).isActive : false
  const isDowngrade =
    currentStillActive &&
    existing &&
    planRank(planId) < planRank(existing.plan) &&
    currentPeriodEnd &&
    currentPeriodEnd.getTime() > now.getTime()

  const variantId =
    planId === "starter"
      ? process.env.LEMON_SQUEEZY_STARTER_VARIANT_ID
      : planId === "growth"
        ? process.env.LEMON_SQUEEZY_GROWTH_VARIANT_ID
        : process.env.LEMON_SQUEEZY_PRO_VARIANT_ID

  if (isDowngrade && existing && currentPeriodEnd) {
    const { error } = await supabase
      .from("subscriptions")
      .update({
        pending_plan: planId,
        pending_plan_effective_at: currentPeriodEnd.toISOString(),
        billing_variant_id: variantId ?? null,
      } as never)
      .eq("id", existing.id)
      .eq("user_id", userId)
    if (error) return { ok: false, error: error.message }
    return { ok: true, plan: planId, effectiveAt: currentPeriodEnd.toISOString() }
  }

  const periodEnd = interval === "yearly"
    ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
    : nextPeriodEnd(now)
  const payload = {
    plan: plan.id,
    status: "active",
    billing_interval: interval,
    monthly_quota: getPlanEntitlements(plan.id).monthlyConversations,
    conversations_used: 0,
    period_start: now.toISOString(),
    period_end: periodEnd.toISOString(),
    canceled_at: null,
    pending_plan: null,
    pending_plan_effective_at: null,
    billing_variant_id: variantId ?? null,
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("subscriptions")
      .update(payload as never)
      .eq("id", existing.id)
      .eq("user_id", userId)
    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await supabase
      .from("subscriptions")
      .insert({ user_id: userId, ...payload } as never)
    if (error) return { ok: false, error: error.message }
  }

  await supabase.auth.updateUser({ data: { card_last4: cardLast4 } })
  return { ok: true, plan: plan.id, effectiveAt: null }
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

export type ConversationReconciliation = {
  before: number
  after: number
  dryRun: boolean
  found: boolean
}

export async function reconcileConversationUsage(
  userId: string,
  dryRun = true,
): Promise<ConversationReconciliation | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(
    "reconcile_conversation_usage" as never,
    { p_user_id: userId, p_dry_run: dryRun } as never,
  )
  if (error) {
    console.error("reconcileConversationUsage failed", {
      code: error.code,
      message: error.message,
    })
    return null
  }
  const row = data as Partial<ConversationReconciliation> | null
  if (!row) return null
  return {
    before: Number(row.before ?? 0),
    after: Number(row.after ?? 0),
    dryRun: Boolean(row.dryRun),
    found: Boolean(row.found),
  }
}

/** Backwards-compatible entry point used by the billing page. */
export async function backfillConversationsFromSessions(
  userId: string,
): Promise<number | null> {
  const result = await reconcileConversationUsage(userId, false)
  return result?.after ?? null
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
