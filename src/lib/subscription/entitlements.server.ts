import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { recordAudit } from "@/lib/audit"
import { getSubscriptionForUser, type SubscriptionSnapshot } from "@/lib/subscription"
import {
  getPlanEntitlements,
  minimumPlanForFeature,
  PLAN_ORDER,
  type FeatureKey,
  type PlanEntitlements,
  type PlanId,
} from "@/lib/subscription/plans"

export type ResourceKey =
  | "monthlyConversations"
  | "widgets"
  | "locations"
  | "staffEmailRecipients"
  | "teamMembers"
  | "languages"
  | "customDomains"

export type EntitlementContext = {
  userId: string
  subscription: SubscriptionSnapshot
  planId: PlanId
  entitlements: PlanEntitlements
}

export type EntitlementErrorCode =
  | "SUBSCRIPTION_INACTIVE"
  | "FEATURE_NOT_AVAILABLE"
  | "PLAN_LIMIT_REACHED"
  | "QUOTA_EXHAUSTED"

export class EntitlementError extends Error {
  constructor(
    public readonly code: EntitlementErrorCode,
    message: string,
    public readonly planId: PlanId,
    public readonly requiredPlan: PlanId | null = null,
    public readonly feature: FeatureKey | null = null,
    public readonly resource: ResourceKey | null = null,
    public readonly limit: number | null = null,
    public readonly current: number | null = null,
  ) {
    super(message)
    this.name = "EntitlementError"
  }
}

export async function getEntitlementContextForUser(
  userId: string,
  client?: SupabaseClient,
): Promise<EntitlementContext> {
  const db = client ?? createAdminClient()
  const subscription = await getSubscriptionForUser(userId, db)
  return {
    userId,
    subscription,
    planId: subscription.planId,
    entitlements: getPlanEntitlements(subscription.planId),
  }
}

export async function requireFeatureForUser(
  userId: string,
  feature: FeatureKey,
  client?: SupabaseClient,
): Promise<EntitlementContext> {
  const context = await getEntitlementContextForUser(userId, client)
  if (!context.subscription.isActive) {
    void recordAudit({ userName: "entitlement", userId, action: `FEATURE_ACCESS_DENIED feature=${feature} plan=${context.planId} reason=inactive` })
    throw new EntitlementError(
      "SUBSCRIPTION_INACTIVE",
      "An active subscription is required.",
      context.planId,
      minimumPlanForFeature(feature),
      feature,
    )
  }
  if (!context.entitlements.features[feature]) {
    void recordAudit({ userName: "entitlement", userId, action: `FEATURE_ACCESS_DENIED feature=${feature} plan=${context.planId}` })
    const required = minimumPlanForFeature(feature)
    throw new EntitlementError(
      "FEATURE_NOT_AVAILABLE",
      required
        ? `This feature requires the ${required[0].toUpperCase() + required.slice(1)} plan.`
        : "This feature is not available.",
      context.planId,
      required,
      feature,
    )
  }
  return context
}

export function assertPlanLimit(
  context: EntitlementContext,
  resource: ResourceKey,
  current: number,
  additional = 1,
): void {
  const limit = context.entitlements[resource]
  const requested = current + additional
  if (limit !== Number.MAX_SAFE_INTEGER && requested > limit) {
    void recordAudit({ userName: "entitlement", userId: context.userId, action: `PLAN_LIMIT_REACHED resource=${resource} plan=${context.planId} current=${current} limit=${limit}` })
    const requiredPlan = PLAN_ORDER.find(
      (planId) => getPlanEntitlements(planId)[resource] >= requested,
    ) ?? null
    throw new EntitlementError(
      resource === "monthlyConversations" ? "QUOTA_EXHAUSTED" : "PLAN_LIMIT_REACHED",
      `Your ${context.subscription.planName} plan limit for ${resource} has been reached.`,
      context.planId,
      requiredPlan,
      null,
      resource,
      limit,
      current,
    )
  }
}

export function entitlementErrorPayload(error: EntitlementError) {
  return {
    success: false as const,
    ok: false as const,
    error: error.message,
    message: error.message,
    errorType: error.code,
    currentPlan: error.planId,
    requiredPlan: error.requiredPlan,
    feature: error.feature,
    resource: error.resource,
    current: error.current,
    limit: error.limit,
  }
}
