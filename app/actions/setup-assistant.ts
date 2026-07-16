"use server"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  knowledgeBaseSchema,
  type KnowledgeBase,
} from "@/lib/ai/setup-assistant-schema"
import { ensureTrialSubscription } from "@/lib/subscription"
import { recordAuditForUser } from "@/lib/audit"
import { invalidateKnowledgeCache } from "@/lib/ai/retrieval"
import { checkActionLimit } from "@/lib/security/check-action-limit"
import { LIMITS } from "@/lib/security/limits"
import type { FaqCategory, WidgetConfig } from "@/lib/supabase/types"
import {
  dedupeServicesByNormalizedName,
  isServiceCategory,
  normalizeServiceCategory,
  normalizeServiceName,
  SERVICE_CATEGORIES,
} from "@/lib/kb/service-categories"

export type FinalizeSetupResult = {
  ok: boolean
  error?: string
  errorType?: "AUTH_ERROR" | "VALIDATION_ERROR" | "INVALID_SERVICE_CATEGORY" | "PUBLISH_FAILED"
  invalidServices?: Array<{ name: string; category: string }>
  inserted?: {
    services: number
    faqs: number
    guardrails: number
    widgetUpdated: boolean
    settingsUpdated: boolean
  }
}

function toFaqCategory(input: string): FaqCategory {
  const allowed: FaqCategory[] = ["General", "Pricing", "Booking", "Safety", "Hours"]
  return (allowed as string[]).includes(input) ? (input as FaqCategory) : "General"
}

function pickStr(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "object" && value !== null) {
    const obj = value as { value?: unknown }
    if (typeof obj.value === "string") return obj.value
  }
  return ""
}

function buildSchedule(kb: KnowledgeBase): WidgetConfig["workingHours"] {
  const tz = kb.hours?.timezone || "America/Los_Angeles"
  const schedule = (kb.hours?.schedule ?? []).map((s) => ({
    day: s.day,
    open: Boolean(s.open),
    from: s.from || "09:00",
    to: s.to || "17:00",
  }))
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const fullSchedule = days.map((day) => {
    const existing = schedule.find((s) => s.day === day)
    return existing ?? { day, open: false, from: "09:00", to: "17:00" }
  })
  return {
    enabled: !kb.hours?.open247,
    tz,
    schedule: fullSchedule,
  }
}

function buildConsentText(kb: KnowledgeBase): string {
  return (
    kb.disclaimers?.consent ||
    "By chatting with us you agree to be contacted about your inquiry. See our privacy policy for how we handle your data."
  )
}

function buildWelcomeMessage(kb: KnowledgeBase): string {
  return (
    kb.brand_voice?.greeting ||
    "Hi! Are you looking to book a consultation or ask about a treatment?"
  )
}

function buildBrandName(kb: KnowledgeBase, fallback: string): string {
  const name = pickStr(kb.business?.name)
  return name || fallback || "Your Med Spa"
}

function buildLogoInitial(brand: string): string {
  const trimmed = brand.trim()
  if (!trimmed) return "M"
  return trimmed[0]!.toUpperCase()
}
function originalServiceCategories(draftInput: unknown): Map<string, unknown> {
  const categories = new Map<string, unknown>()
  if (!draftInput || typeof draftInput !== "object") return categories
  const rawServices = (draftInput as { services?: unknown }).services
  if (!Array.isArray(rawServices)) return categories
  for (const rawService of rawServices) {
    if (!rawService || typeof rawService !== "object") continue
    const service = rawService as { name?: unknown; category?: unknown }
    if (typeof service.name !== "string") continue
    const key = normalizeServiceName(service.name)
    if (key && !categories.has(key)) categories.set(key, service.category ?? null)
  }
  return categories
}

export async function finalizeSetupAssistant(
  draftInput: unknown,
): Promise<FinalizeSetupResult> {
  const limit = await checkActionLimit(LIMITS.actionSetupAssistant)
  if (!limit.ok) return { ok: false, error: limit.error }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, errorType: "AUTH_ERROR", error: "Not authenticated" }
  }

  const parsed = knowledgeBaseSchema.safeParse(draftInput)
  if (!parsed.success) {
    return {
      ok: false,
      errorType: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid KB",
    }
  }
  const kb = parsed.data

  const admin = createAdminClient()
  const originalCategories = originalServiceCategories(draftInput)

  const brandName = buildBrandName(kb, pickStr(user.user_metadata?.spa_name))
  const widget = {
    brandName,
    logoInitial: buildLogoInitial(brandName),
    primaryColor: "#E2E54B",
    position: "bottom-right" as const,
    welcomeMessage: buildWelcomeMessage(kb),
    proactiveEnabled: true,
    proactiveDelaySeconds: 8,
    proactiveMessage: "Still browsing? I can answer questions or set up a consultation in seconds.",
    showBranding: true,
    collectEmail: true,
    collectPhone: true,
    consentText: buildConsentText(kb),
    workingHours: buildSchedule(kb),
    extendedKb: kb as unknown as Record<string, unknown>,
  }

  const normalizedServices = dedupeServicesByNormalizedName(
    (kb.services ?? []).map((service) => ({
      ...service,
      name: service.name.trim().replace(/\s+/g, " "),
      category: normalizeServiceCategory(service.category, service.name),
    })),
  )
  const serviceRows = normalizedServices.map((service) => ({
    name: service.name,
    category: service.category,
    description: service.description,
    pricing_rule: service.priceRange
      ? `Indicative range ${service.priceRange.currency} ${service.priceRange.min}–${service.priceRange.max} ${service.priceRange.unit} (indicative only)`
      : "Confirmed at consultation",
    duration: service.duration || "",
    active: true,
  }))

  const invalidServices = normalizedServices.filter((service) => !isServiceCategory(service.category))
  if (invalidServices.length > 0) {
    console.error("KNOWLEDGE_SERVICE_PUBLISH_FAILED", {
      userId: user.id,
      allowedCategories: SERVICE_CATEGORIES,
      services: invalidServices.map((service) => ({
        serviceName: service.name,
        originalCategory: originalCategories.get(normalizeServiceName(service.name)) ?? null,
        normalizedCategory: service.category,
      })),
    })
    return {
      ok: false,
      errorType: "INVALID_SERVICE_CATEGORY",
      error: "We couldn't publish one or more services because their categories were not recognised. The issue has been logged. Please try again.",
      invalidServices: invalidServices.map((service) => ({
        name: service.name,
        category: service.category,
      })),
    }
  }

  const faqRows = (kb.faqs ?? []).map((faq) => ({
    question: faq.question,
    answer: faq.answer,
    category: toFaqCategory(faq.category),
  }))

  const guardrailRows = [
    kb.disclaimers?.pricing
      ? { title: "Pricing guidance", description: kb.disclaimers.pricing, rule_type: "pricing" }
      : null,
    kb.disclaimers?.medical
      ? { title: "Medical guidance", description: kb.disclaimers.medical, rule_type: "medical" }
      : null,
    ...(kb.brand_voice?.avoidPhrases ?? []).map((phrase) => ({
      title: `Avoid phrase: ${phrase}`.slice(0, 120),
      description: `The AI must not use the phrase "${phrase}".`,
      rule_type: "general",
    })),
  ]
    .filter((row): row is { title: string; description: string; rule_type: string } => Boolean(row))
    .map((row) => ({
      ...row,
      body: row.description,
      enabled: true,
      is_active: true,
    }))

  const normalizedKb: KnowledgeBase = { ...kb, services: normalizedServices }
  const website = pickStr(kb.business?.website)
  const address = kb.business?.addresses?.[0]
    ? `${kb.business.addresses[0].line1}${
        kb.business.addresses[0].city ? `, ${kb.business.addresses[0].city}` : ""
      }${kb.business.addresses[0].region ? `, ${kb.business.addresses[0].region}` : ""}`
    : ""
  const meta: Record<string, unknown> = {
    ...user.user_metadata,
    spa_name: brandName,
    onboarding_kb: normalizedKb,
    onboarding_completed: true,
    onboarding_completed_at: new Date().toISOString(),
  }
  if (website) meta.website = website
  if (kb.notifications?.emailRecipients?.[0]) {
    meta.notification_email = kb.notifications.emailRecipients[0]
  }
  if (kb.brand_voice?.tone) meta.brand_tone = kb.brand_voice.tone
  if (kb.brand_voice?.greeting) meta.widget_greeting = kb.brand_voice.greeting
  delete meta.onboarding_kb_draft
  delete meta.onboarding_setup_section

  const rpcPayload = {
    p_user_id: user.id,
    p_services: serviceRows,
    p_faqs: faqRows,
    p_guardrails: guardrailRows,
    p_widget: {
      brand_name: widget.brandName,
      logo_initial: widget.logoInitial,
      primary_color: widget.primaryColor,
      position: widget.position,
      welcome_message: widget.welcomeMessage,
      proactive_enabled: widget.proactiveEnabled,
      proactive_delay_seconds: widget.proactiveDelaySeconds,
      proactive_message: widget.proactiveMessage,
      show_branding: widget.showBranding,
      collect_email: widget.collectEmail,
      collect_phone: widget.collectPhone,
      consent_text: widget.consentText,
      working_hours: widget.workingHours,
      extended_kb: normalizedKb,
    },
    p_settings: { spa_name: brandName, website, address },
    p_user_metadata: meta,
  }

  const { data: publishData, error: publishError } = await admin.rpc(
    "publish_onboarding_knowledge_base" as never,
    rpcPayload as never,
  )

  if (publishError) {
    const databaseError = publishError as {
      message?: string
      code?: string
      details?: string
      hint?: string
    }
    console.error("KNOWLEDGE_SERVICE_PUBLISH_FAILED", {
      userId: user.id,
      allowedCategories: SERVICE_CATEGORIES,
      services: serviceRows.map((service) => ({
        serviceName: service.name,
        originalCategory: originalCategories.get(normalizeServiceName(service.name)) ?? null,
        normalizedCategory: service.category,
      })),
      database: {
        message: databaseError.message,
        code: databaseError.code,
        details: databaseError.details,
        hint: databaseError.hint,
      },
    })
    const categoryFailure = /INVALID_SERVICE_CATEGORY|knowledge_services_category_check/i.test(
      `${databaseError.message ?? ""} ${databaseError.details ?? ""}`,
    )
    return {
      ok: false,
      errorType: categoryFailure ? "INVALID_SERVICE_CATEGORY" : "PUBLISH_FAILED",
      error: categoryFailure
        ? "We couldn't publish one or more services because their categories were not recognised. The issue has been logged. Please try again."
        : "We couldn't publish your knowledge base. Nothing was changed. Please try again.",
    }
  }

  const published = (publishData ?? {}) as Partial<NonNullable<FinalizeSetupResult["inserted"]>>
  const servicesInserted = Number(published.services ?? serviceRows.length)
  const faqsInserted = Number(published.faqs ?? faqRows.length)
  const guardrailsInserted = Number(published.guardrails ?? guardrailRows.length)
  const widgetUpdated = published.widgetUpdated ?? true
  const settingsUpdated = published.settingsUpdated ?? false

  invalidateKnowledgeCache()
  recordAuditForUser(user, `onboarding.finalized services=${servicesInserted} faqs=${faqsInserted} guardrails=${guardrailsInserted}`)

  try {
    await ensureTrialSubscription(user.id)
  } catch {
    // Non-fatal
  }

  // Make sure subsequent reads see the new KB / widget config instead of
  // stale caches.
  try {
    const { revalidatePath } = await import("next/cache")
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/widget")
    revalidatePath("/dashboard/knowledge-base")
    revalidatePath("/dashboard/analytics")
    revalidatePath("/embed-demo")
    revalidatePath("/", "layout")
  } catch {
    // Non-fatal
  }

  return {
    ok: true,
    inserted: {
      services: servicesInserted,
      faqs: faqsInserted,
      guardrails: guardrailsInserted,
      widgetUpdated,
      settingsUpdated,
    },
  }
}

export async function completeSetupAssistantAndRedirect(draftInput: unknown): Promise<void> {
  const result = await finalizeSetupAssistant(draftInput)
  if (!result.ok) {
    throw new Error(result.error ?? "Failed to finalize setup")
  }
  redirect("/dashboard")
}
