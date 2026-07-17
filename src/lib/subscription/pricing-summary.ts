import type { SubscriptionSnapshot, SubscriptionStatus } from "./index"
import type { PlanId } from "./plans"

/**
 * The deliberately small, JSON-safe subscription shape accepted by client UI.
 * SubscriptionSnapshot itself contains Date and function values and must never
 * cross a React Server Component boundary.
 */
export type PricingSubscriptionSummary = {
  planId: PlanId
  status: SubscriptionStatus
  isActive: boolean
  canStartTrial: boolean
}

export function toPricingSubscriptionSummary(
  subscription: SubscriptionSnapshot,
): PricingSubscriptionSummary {
  return {
    planId: subscription.planId,
    status: subscription.status,
    isActive: subscription.isActive,
    canStartTrial: subscription.canStartTrial,
  }
}