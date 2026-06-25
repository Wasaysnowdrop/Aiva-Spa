export type PlanId = "starter" | "growth" | "pro"

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

export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    tagline: "For single-location med spas",
    priceMonthly: 79,
    monthlyQuota: 300,
    maxWidgets: 1,
    maxLocations: 1,
    maxStaffEmails: 1,
    accent: "#22D3EE",
    cta: "Choose Starter",
    ctaHref: "/checkout/starter",
    whiteLabel: false,
    maxCustomDomains: 0,
    features: [
      "AI chat widget for your website",
      "Answers from your approved knowledge base",
      "Lead capture: name, phone, email, service, preferred time",
      "Email notifications to staff",
      "Basic leads dashboard",
      "Standard widget branding and colors",
      "Basic FAQ and service answers",
      "Safe fallback for medical questions",
      "Done-for-you setup included",
    ],
  },
  growth: {
    id: "growth",
    name: "Growth",
    tagline: "For active med spas",
    priceMonthly: 149,
    monthlyQuota: 1500,
    maxWidgets: 2,
    maxLocations: 2,
    maxStaffEmails: 3,
    accent: "#E2E54B",
    cta: "Start 7-day free trial",
    ctaHref: "/checkout/growth",
    whiteLabel: false,
    maxCustomDomains: 0,
    features: [
      "Everything in Starter",
      "Up to 1,500 conversations/month",
      "Full conversation history and transcripts",
      "Lead scoring, tagging, and custom lead fields",
      "Service-specific routing and hot-lead alerts",
      "Calendar booking link support",
      "Conversion funnel analytics",
      "Visitor intelligence: location, device, referrer",
      "Custom widget colors and greeting",
      "Slack and Microsoft Teams notifications",
      "Multi-language widget support",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For multi-location groups",
    priceMonthly: 299,
    monthlyQuota: 5000,
    maxWidgets: Number.MAX_SAFE_INTEGER,
    maxLocations: 5,
    maxStaffEmails: 10,
    accent: "#FF77E9",
    cta: "Book demo",
    ctaHref: "mailto:sales@aivaspa.com?subject=Book%20a%20demo",
    whiteLabel: true,
    maxCustomDomains: 5,
    features: [
      "Everything in Growth",
      "Up to 5 locations and unlimited widgets",
      "Up to 5,000 conversations/month",
      "White-label widget: hide AivaSpa branding",
      "Custom domain support",
      "Role-based access: owner, manager, staff, receptionist",
      "Multi-location calendar routing",
      "Advanced analytics",
      "Audit log and HIPAA compliance reports",
      "Dedicated account manager",
      "White-glove setup included",
    ],
  },
}

export const PLAN_ORDER: PlanId[] = ["starter", "growth", "pro"]

export const TRIAL_QUOTA = PLANS[TRIAL_PLAN_ID].monthlyQuota

export function getPlan(id: string | null | undefined): PlanDefinition {
  if (id && id in PLANS) return PLANS[id as PlanId]
  return PLANS.starter
}

export function formatPrice(plan: PlanDefinition) {
  return { display: `$${plan.priceMonthly}`, suffix: "/month" }
}

// ── Feature permissions map ──────────────────────────────────────────

export type PlanPermissions = {
  can_use_widget: boolean
  max_conversations: number
  max_locations: number
  max_staff_emails: number
  conversation_history: boolean
  lead_scoring: boolean
  lead_tagging: boolean
  custom_fields: boolean
  calendar_support: boolean
  sms_reminders: boolean
  analytics: "basic" | "growth" | "advanced"
  visitor_intelligence: boolean
  slack_notifications: boolean
  teams_notifications: boolean
  multi_language: boolean
  white_label: boolean
  custom_domain: boolean
  role_based_access: boolean
  audit_logs: boolean
  dedicated_manager: boolean
}

const PERMISSIONS: Record<PlanId, PlanPermissions> = {
  starter: {
    can_use_widget: true,
    max_conversations: 300,
    max_locations: 1,
    max_staff_emails: 1,
    conversation_history: false,
    lead_scoring: false,
    lead_tagging: false,
    custom_fields: false,
    calendar_support: false,
    sms_reminders: false,
    analytics: "basic",
    visitor_intelligence: false,
    slack_notifications: false,
    teams_notifications: false,
    multi_language: false,
    white_label: false,
    custom_domain: false,
    role_based_access: false,
    audit_logs: false,
    dedicated_manager: false,
  },
  growth: {
    can_use_widget: true,
    max_conversations: 1500,
    max_locations: 2,
    max_staff_emails: 3,
    conversation_history: true,
    lead_scoring: true,
    lead_tagging: true,
    custom_fields: true,
    calendar_support: true,
    sms_reminders: true,
    analytics: "growth",
    visitor_intelligence: true,
    slack_notifications: true,
    teams_notifications: true,
    multi_language: true,
    white_label: false,
    custom_domain: false,
    role_based_access: false,
    audit_logs: false,
    dedicated_manager: false,
  },
  pro: {
    can_use_widget: true,
    max_conversations: 5000,
    max_locations: 5,
    max_staff_emails: 10,
    conversation_history: true,
    lead_scoring: true,
    lead_tagging: true,
    custom_fields: true,
    calendar_support: true,
    sms_reminders: true,
    analytics: "advanced",
    visitor_intelligence: true,
    slack_notifications: true,
    teams_notifications: true,
    multi_language: true,
    white_label: true,
    custom_domain: true,
    role_based_access: true,
    audit_logs: true,
    dedicated_manager: true,
  },
}

export function getFeaturePermissions(planId: PlanId): PlanPermissions {
  return PERMISSIONS[planId]
}

export function planAllowsFeature(
  planId: PlanId,
  feature: keyof PlanPermissions,
): boolean {
  return Boolean(PERMISSIONS[planId]?.[feature])
}
