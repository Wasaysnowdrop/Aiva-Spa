export type PlanId = "starter" | "growth" | "pro"

export const UNLIMITED = Number.MAX_SAFE_INTEGER

export const FEATURE_KEYS = [
  "widget",
  "approved_knowledge_base",
  "lead_capture",
  "email_notifications",
  "basic_leads_dashboard",
  "basic_faqs",
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
  "multi_location",
  "white_label",
  "custom_domain",
  "role_based_access",
  "advanced_analytics",
  "audit_log",
  "hipaa_reports",
  "dedicated_account_manager",
] as const

export type FeatureKey = (typeof FEATURE_KEYS)[number]

export type PlanEntitlements = {
  features: Readonly<Record<FeatureKey, boolean>>
  monthlyConversations: number
  widgets: number
  locations: number
  staffEmailRecipients: number
  teamMembers: number
  languages: number
  customDomains: number
}

export type PlanDefinition = {
  id: PlanId
  name: string
  tagline: string
  priceMonthly: number
  monthlyQuota: number
  maxWidgets: number
  maxLocations: number
  maxStaffEmails: number
  accent: string
  features: string[]
  cta: string
  ctaHref: string
  whiteLabel: boolean
  maxCustomDomains: number
}

export const TRIAL_DAYS = 7
export const TRIAL_PLAN_ID: PlanId = "growth"

const starterFeatures: Record<FeatureKey, boolean> = {
  widget: true,
  approved_knowledge_base: true,
  lead_capture: true,
  email_notifications: true,
  basic_leads_dashboard: true,
  basic_faqs: true,
  conversation_history: false,
  lead_scoring: false,
  lead_tagging: false,
  custom_fields: false,
  service_routing: false,
  calendar_booking_links: false,
  conversion_analytics: false,
  visitor_intelligence: false,
  custom_widget_colors: false,
  slack_notifications: false,
  teams_notifications: false,
  multi_language_widget: false,
  multi_location: false,
  white_label: false,
  custom_domain: false,
  role_based_access: false,
  advanced_analytics: false,
  audit_log: false,
  hipaa_reports: false,
  dedicated_account_manager: false,
}

const growthFeatures: Record<FeatureKey, boolean> = {
  ...starterFeatures,
  conversation_history: true,
  lead_scoring: true,
  lead_tagging: true,
  custom_fields: true,
  service_routing: true,
  calendar_booking_links: true,
  conversion_analytics: true,
  visitor_intelligence: true,
  custom_widget_colors: true,
  slack_notifications: true,
  teams_notifications: true,
  multi_language_widget: true,
  multi_location: true,
}

const proFeatures: Record<FeatureKey, boolean> = {
  ...growthFeatures,
  white_label: true,
  custom_domain: true,
  role_based_access: true,
  advanced_analytics: true,
  audit_log: true,
  hipaa_reports: true,
  dedicated_account_manager: true,
}

export const PLAN_ENTITLEMENTS: Readonly<Record<PlanId, PlanEntitlements>> = {
  starter: { features: starterFeatures, monthlyConversations: 300, widgets: 1, locations: 1, staffEmailRecipients: 1, teamMembers: 1, languages: 1, customDomains: 0 },
  growth: { features: growthFeatures, monthlyConversations: 1_500, widgets: 2, locations: 2, staffEmailRecipients: 3, teamMembers: 1, languages: 12, customDomains: 0 },
  pro: { features: proFeatures, monthlyConversations: 5_000, widgets: UNLIMITED, locations: 5, staffEmailRecipients: 10, teamMembers: UNLIMITED, languages: 12, customDomains: 5 },
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: "starter", name: "Starter", tagline: "For single-location med spas", priceMonthly: 79,
    monthlyQuota: PLAN_ENTITLEMENTS.starter.monthlyConversations, maxWidgets: PLAN_ENTITLEMENTS.starter.widgets,
    maxLocations: PLAN_ENTITLEMENTS.starter.locations, maxStaffEmails: PLAN_ENTITLEMENTS.starter.staffEmailRecipients,
    accent: "#22D3EE", cta: "Choose Starter", ctaHref: "/checkout/starter",
    whiteLabel: PLAN_ENTITLEMENTS.starter.features.white_label, maxCustomDomains: PLAN_ENTITLEMENTS.starter.customDomains,
    features: [
      "AI chat widget for your website", "Answers from your approved knowledge base",
      "Lead capture: name, phone, email, service, preferred time", "Email notifications to staff",
      "Basic leads dashboard", "Standard widget branding and colors", "Basic FAQ and service answers",
      "Safe fallback for medical questions", "Done-for-you setup included",
    ],
  },
  growth: {
    id: "growth", name: "Growth", tagline: "For active med spas", priceMonthly: 149,
    monthlyQuota: PLAN_ENTITLEMENTS.growth.monthlyConversations, maxWidgets: PLAN_ENTITLEMENTS.growth.widgets,
    maxLocations: PLAN_ENTITLEMENTS.growth.locations, maxStaffEmails: PLAN_ENTITLEMENTS.growth.staffEmailRecipients,
    accent: "#E2E54B", cta: "Start 7-day free trial", ctaHref: "/checkout/growth",
    whiteLabel: PLAN_ENTITLEMENTS.growth.features.white_label, maxCustomDomains: PLAN_ENTITLEMENTS.growth.customDomains,
    features: [
      "Everything in Starter", "Up to 1,500 conversations/month", "Full conversation history and transcripts",
      "Lead scoring, tagging, and custom lead fields", "Service-specific routing and hot-lead alerts",
      "Calendar booking link support", "Conversion funnel analytics", "Visitor intelligence: location, device, referrer",
      "Custom widget colors and greeting", "Slack and Microsoft Teams notifications", "Multi-language widget support",
    ],
  },
  pro: {
    id: "pro", name: "Pro", tagline: "For multi-location groups", priceMonthly: 299,
    monthlyQuota: PLAN_ENTITLEMENTS.pro.monthlyConversations, maxWidgets: PLAN_ENTITLEMENTS.pro.widgets,
    maxLocations: PLAN_ENTITLEMENTS.pro.locations, maxStaffEmails: PLAN_ENTITLEMENTS.pro.staffEmailRecipients,
    accent: "#FF77E9", cta: "Book demo", ctaHref: "mailto:sales@aivaspa.com?subject=Book%20a%20demo",
    whiteLabel: PLAN_ENTITLEMENTS.pro.features.white_label, maxCustomDomains: PLAN_ENTITLEMENTS.pro.customDomains,
    features: [
      "Everything in Growth", "Up to 5 locations and unlimited widgets", "Up to 5,000 conversations/month",
      "White-label widget: hide AivaSpa branding", "Custom domain support",
      "Role-based access: owner, manager, staff, receptionist", "Multi-location calendar routing",
      "Advanced analytics", "Audit log and HIPAA compliance reports", "Dedicated account manager",
      "White-glove setup included",
    ],
  },
}

export const PLAN_ORDER: PlanId[] = ["starter", "growth", "pro"]
export const TRIAL_QUOTA = PLAN_ENTITLEMENTS[TRIAL_PLAN_ID].monthlyConversations

export function getPlan(id: string | null | undefined): PlanDefinition {
  if (id && id in PLANS) return PLANS[id as PlanId]
  return PLANS.starter
}

export function formatPrice(plan: PlanDefinition) {
  return { display: `$${plan.priceMonthly}`, suffix: "/month" }
}

export function getPlanEntitlements(planId: PlanId): PlanEntitlements {
  return PLAN_ENTITLEMENTS[planId]
}

export function planAllowsFeature(planId: PlanId, feature: FeatureKey): boolean {
  return PLAN_ENTITLEMENTS[planId].features[feature]
}

export function planRank(planId: PlanId): number {
  return PLAN_ORDER.indexOf(planId)
}

export function minimumPlanForFeature(feature: FeatureKey): PlanId | null {
  return PLAN_ORDER.find((planId) => planAllowsFeature(planId, feature)) ?? null
}

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && value in PLANS
}

export function planFromVariantId(variantId: string | null | undefined): PlanId | null {
  if (!variantId) return null
  const entries: Array<[PlanId, string | undefined]> = [
    ["starter", process.env.LEMON_SQUEEZY_STARTER_VARIANT_ID],
    ["growth", process.env.LEMON_SQUEEZY_GROWTH_VARIANT_ID],
    ["pro", process.env.LEMON_SQUEEZY_PRO_VARIANT_ID],
  ]
  return entries.find(([, configured]) => configured && configured === variantId)?.[0] ?? null
}
