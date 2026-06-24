export type PlanId = "starter" | "growth" | "pro"

export type PlanDefinition = {
  id: PlanId
  name: string
  tagline: string
  priceMonthly: number
  priceYearly: number
  monthlyQuota: number
  maxWidgets: number
  maxLocations: number
  accent: string
  features: string[]
  cta: string
  whiteLabel: boolean
  maxCustomDomains: number
}

export const TRIAL_DAYS = 7
export const TRIAL_PLAN_ID: PlanId = "growth"

export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    tagline: "For a single med spa",
    priceMonthly: 50,
    priceYearly: 50 * 12 * 0.8,
    monthlyQuota: 300,
    maxWidgets: 1,
    maxLocations: 1,
    accent: "#22D3EE",
    cta: "Start with Starter",
    whiteLabel: false,
    maxCustomDomains: 0,
    features: [
      "1 website widget, 1 location",
      "AI answers from your approved knowledge base",
      "Lead capture (name, phone, email, service, time)",
      "Email notifications to staff",
      "Up to 300 conversations / month",
      "Basic lead dashboard with status",
      "Standard widget branding (logo + colors)",
      "AI conversation analytics & CSAT ratings",
      "Visitor intelligence (geo, device, referrer)",
      "Lead scoring, tagging & custom fields",
      "Daily summary email reports",
      "Auto-responder rules & quick replies",
      "Team activity log (30 days)",
      "HIPAA-aware PII handling",
    ],
  },
  growth: {
    id: "growth",
    name: "Growth",
    tagline: "For active med spas",
    priceMonthly: 100,
    priceYearly: 100 * 12 * 0.8,
    monthlyQuota: 1500,
    maxWidgets: 2,
    maxLocations: 2,
    accent: "#E2E54B",
    cta: "Choose Growth",
    whiteLabel: false,
    maxCustomDomains: 0,
    features: [
      "Everything in Starter",
      "Up to 1,500 conversations / month",
      "Full conversation history & transcripts",
      "Advanced widget customisation: position, greeting, tone, avatar, theme & per-page rules",
      "Service-specific routing & hot-lead alerts",
      "AI-powered lead scoring & smart reply suggestions",
      "Conversion funnel analytics",
      "A/B testing for greetings & CTAs",
      "Slack & Microsoft Teams notifications",
      "URL scraper for Knowledge Base (paste your site URL — services, FAQs & hours auto-fill in seconds)",
      "Built-in calendar with live booking slots & SMS/email reminders (no Google OAuth required)",
      "Multi-language widget — 12 languages with auto-detect, RTL support & visitor language switcher",
      "Email template library & saved replies",
      "Priority onboarding (under 24h)",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For multi-location groups",
    priceMonthly: 210,
    priceYearly: 210 * 12 * 0.8,
    monthlyQuota: 5000,
    maxWidgets: 5,
    maxLocations: 5,
    accent: "#FF77E9",
    cta: "Choose Pro",
    whiteLabel: true,
    maxCustomDomains: 3,
    features: [
      "Everything in Growth",
      "Up to 5 locations & unlimited widgets",
      "Up to 5,000 conversations / month",
      "Advanced analytics (conversion, after-hours, SLA, cohort)",
      "White-label widget (hide AivaSpa branding, your colors, your logo)",
      "Custom domain — map up to 3 of your own domains (e.g. chat.yourspa.com)",
      "Role-based access (owner / manager / staff / receptionist)",
      "Audit log & extended data retention (1 year)",
      "Custom data residency & retention policies",
      "Priority AI inference (faster first response)",
      "Dedicated AI model fine-tuning per brand",
      "All 12 languages + priority custom-locale requests",
      "Multi-location custom calendar with team routing",
      "Compliance & HIPAA audit reports",
      "24/7 priority support + dedicated account manager",
    ],
  },
}

export const PLAN_ORDER: PlanId[] = ["starter", "growth", "pro"]

export const TRIAL_QUOTA = PLANS[TRIAL_PLAN_ID].monthlyQuota

export function getPlan(id: string | null | undefined): PlanDefinition {
  if (id && id in PLANS) return PLANS[id as PlanId]
  return PLANS.starter
}

export function formatPrice(plan: PlanDefinition, interval: "monthly" | "yearly") {
  if (interval === "yearly") {
    const monthly = plan.priceYearly / 12
    return {
      display: `$${Math.round(monthly)}`,
      suffix: "/mo · billed yearly",
    }
  }
  return { display: `$${plan.priceMonthly}`, suffix: "/month" }
}

export function planAllowsFeature(planId: PlanId, feature: PlanFeature): boolean {
  const rank: Record<PlanId, number> = {
    starter: 1,
    growth: 2,
    pro: 3,
  }
  const required: Record<PlanFeature, number> = {
    basic: 1,
    sms: 2,
    calendar: 2,
    analytics: 3,
    multiLocation: 3,
    api: 3,
    sso: 3,
  }
  return rank[planId] >= required[feature]
}

export type PlanFeature =
  | "basic"
  | "sms"
  | "calendar"
  | "analytics"
  | "multiLocation"
  | "api"
  | "sso"
