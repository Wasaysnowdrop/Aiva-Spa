/**
 * Central registry of rate-limit policies.
 *
 * One limit per (bucket, route) — the names are referenced everywhere
 * via `LIMITS.chat`, `LIMITS.auth.signin`, etc. so it's easy to audit
 * what's protected and to tune any single value without grep-and-replace.
 *
 * Sizing rules of thumb:
 *   - Auth endpoints: tight (3-10 per minute) because each call is
 *     either a credential check or an email send.
 *   - Public chat: medium (30/min/IP) because a single visitor can
 *     reasonably send 30+ messages a minute, but a bot would not.
 *   - Public lead capture: tighter than chat because it does writes.
 *   - Per-user server actions: medium (60/min) because most actions
 *     are user-initiated and human-paced.
 *   - Cron + admin-system-health: very tight + IP-agnostic.
 */

import type { RateLimitOptions } from "./rate-limit"

const minutes = (m: number) => m * 60_000
const hours = (h: number) => h * 60 * 60_000

export const LIMITS = {
  // -------------------------------------------------------------------
  // Public widget (visitor-facing)
  // -------------------------------------------------------------------
  /** Widget visitor chat. Per-IP. */
  chat: { bucket: "public:chat", options: { maxRequests: 60, windowMs: minutes(1) } } as const,
  /** Public lead capture endpoint. Per-IP + per-spa. */
  leadsPublic: { bucket: "public:leads", options: { maxRequests: 30, windowMs: minutes(1) } } as const,
  /** Direct lead form for embed / hot path. Tighter — each call writes. */
  leadsDirect: { bucket: "public:leads:direct", options: { maxRequests: 20, windowMs: minutes(1) } } as const,
  /** Public widget config fetch. Per-IP. */
  widgetConfig: { bucket: "public:widget:config", options: { maxRequests: 120, windowMs: minutes(1) } } as const,
  /** Verify endpoint — SSRF guard + cheap protection. */
  widgetVerify: { bucket: "public:widget:verify", options: { maxRequests: 20, windowMs: minutes(1) } } as const,
  /** Domain → spa resolution. Cached at edge but still rate-limited. */
  widgetResolveHost: { bucket: "public:widget:resolve", options: { maxRequests: 120, windowMs: minutes(1) } } as const,
  /** API-key authed v1 lead intake. Per-key. */
  v1Leads: { bucket: "v1:leads", options: { maxRequests: 120, windowMs: minutes(1) } } as const,

  // -------------------------------------------------------------------
  // Public calendar (widget-side appointment booking)
  // -------------------------------------------------------------------
  calendarSlots: { bucket: "calendar:slots", options: { maxRequests: 240, windowMs: minutes(1) } } as const,
  calendarBook: { bucket: "calendar:book", options: { maxRequests: 20, windowMs: minutes(1) } } as const,
  calendarBookings: { bucket: "calendar:bookings", options: { maxRequests: 60, windowMs: minutes(1) } } as const,
  calendarReminders: { bucket: "calendar:reminders", options: { maxRequests: 20, windowMs: minutes(1) } } as const,
  calendarSettings: { bucket: "calendar:settings", options: { maxRequests: 30, windowMs: minutes(1) } } as const,

  // -------------------------------------------------------------------
  // Auth — tightest limits of all
  // -------------------------------------------------------------------
  auth: {
    /** Email + password sign-in. Per-email + per-IP. */
    signin: { bucket: "auth:signin", options: { maxRequests: 8, windowMs: minutes(1) } } as const,
    /** Per-email reset of signin. */
    signinEmail: { bucket: "auth:signin:email", options: { maxRequests: 5, windowMs: minutes(1) } } as const,
    /** Email + password sign-up. Per-email + per-IP. */
    signup: { bucket: "auth:signup", options: { maxRequests: 5, windowMs: minutes(1) } } as const,
    signupIp: { bucket: "auth:signup:ip", options: { maxRequests: 10, windowMs: hours(1) } } as const,
    /** Password reset request. Per-email. */
    resetRequest: { bucket: "auth:reset:req", options: { maxRequests: 3, windowMs: minutes(5) } } as const,
    /** Password reset confirmation. Per-user (after the link is used). */
    resetConfirm: { bucket: "auth:reset:confirm", options: { maxRequests: 5, windowMs: minutes(5) } } as const,
    /** Resend confirmation email. Per-email. */
    resend: { bucket: "auth:resend", options: { maxRequests: 3, windowMs: minutes(5) } } as const,
    /** OAuth start. Per-IP. */
    oauth: { bucket: "auth:oauth", options: { maxRequests: 20, windowMs: minutes(1) } } as const,
  },

  // -------------------------------------------------------------------
  // Authed dashboard APIs
  // -------------------------------------------------------------------
  dashboardLive: { bucket: "api:dashboard:live", options: { maxRequests: 60, windowMs: minutes(1) } } as const,
  onboardingScrape: { bucket: "api:onboarding:scrape", options: { maxRequests: 10, windowMs: minutes(1) } } as const,
  onboardingAssistant: { bucket: "api:onboarding:assistant", options: { maxRequests: 30, windowMs: minutes(1) } } as const,
  adminSystemHealth: { bucket: "api:admin:system-health", options: { maxRequests: 30, windowMs: minutes(1) } } as const,
  adminLogout: { bucket: "api:admin:logout", options: { maxRequests: 30, windowMs: minutes(1) } } as const,
  whiteLabelDomains: { bucket: "api:white-label:domains", options: { maxRequests: 30, windowMs: minutes(1) } } as const,
  cronDailySummary: { bucket: "api:cron:daily-summary", options: { maxRequests: 5, windowMs: minutes(1) } } as const,

  // -------------------------------------------------------------------
  // Authed server actions (per-user)
  // -------------------------------------------------------------------
  actionLeads: { bucket: "action:leads", options: { maxRequests: 60, windowMs: minutes(1) } } as const,
  actionWebhooks: { bucket: "action:webhooks", options: { maxRequests: 30, windowMs: minutes(1) } } as const,
  actionApiKeys: { bucket: "action:api-keys", options: { maxRequests: 15, windowMs: minutes(1) } } as const,
  actionWidget: { bucket: "action:widget", options: { maxRequests: 60, windowMs: minutes(1) } } as const,
  actionWidgetInstalls: { bucket: "action:widget-installs", options: { maxRequests: 30, windowMs: minutes(1) } } as const,
  actionKnowledge: { bucket: "action:knowledge", options: { maxRequests: 60, windowMs: minutes(1) } } as const,
  actionSettings: { bucket: "action:settings", options: { maxRequests: 30, windowMs: minutes(1) } } as const,
  actionTeam: { bucket: "action:team", options: { maxRequests: 20, windowMs: minutes(1) } } as const,
  actionSubscription: { bucket: "action:subscription", options: { maxRequests: 15, windowMs: minutes(1) } } as const,
  actionSetupAssistant: { bucket: "action:setup-assistant", options: { maxRequests: 30, windowMs: minutes(1) } } as const,
  actionAuth: { bucket: "action:auth", options: { maxRequests: 20, windowMs: minutes(1) } } as const,
  actionAdminUsers: { bucket: "action:admin:users", options: { maxRequests: 30, windowMs: minutes(1) } } as const,

  // -------------------------------------------------------------------
  // Global per-IP safety net (used in proxy.ts for everything else)
  // -------------------------------------------------------------------
  globalPerIp: { bucket: "global:per-ip", options: { maxRequests: 600, windowMs: minutes(1) } } as const,
} as const satisfies Record<string, { bucket: string; options: RateLimitOptions } | Record<string, unknown>>

export type LimitName = keyof typeof LIMITS
