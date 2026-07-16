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
  errorType?:
    | "AUTH_ERROR"
    | "VALIDATION_ERROR"
    | "INVALID_SERVICE_CATEGORY"
    | "DATABASE_ERROR"
    | "PUBLISH_FAILED"
  stage?: string
  code?: string
  details?: string
  hint?: string
  table?: string
  failedService?: string
  originalCategory?: unknown
  normalizedCategory?: string
  invalidServices?: Array<{ name: string; category: string }>
  inserted?: {
    services: number
    faqs: number
    guardrails: number
    widgetUpdated: boolean
    settingsUpdated: boolean
  }
}

type PublishContext = {
  userId: string | null
  businessId: string | null
  onboardingSessionId: string | null
}

type DatabaseError = {
  message?: string
  code?: string
  details?: string
  hint?: string
}

const PUBLISH_RPC = "publish_onboarding_knowledge_base"

function publishInfo(
  event: string,
  context: PublishContext,
  fields: Record<string, unknown> = {},
): void {
  console.info(event, { ...context, ...fields })
}

function publishFailure(
  event: "PUBLISH_FAILED" | "PUBLISH_ROLLED_BACK",
  context: PublishContext,
  fields: Record<string, unknown>,
): void {
  console.error(event, { ...context, ...fields })
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string | null {
  const value = metadata?.[key]
  return typeof value === "string" && value.trim() ? value : null
}

function stageFromDatabaseError(error: DatabaseError): string {
  const raw = `${error.message ?? ""} ${error.details ?? ""}`
  const explicit = raw.match(/PUBLISH_STAGE=([a-z_]+)/i)?.[1]
  if (explicit) return explicit.toLowerCase()
  if (/knowledge_services|service_category/i.test(raw)) return "services_upsert"
  if (/knowledge_faqs|faq_category/i.test(raw)) return "faqs"
  if (/knowledge_guardrails/i.test(raw)) return "policies"
  if (/widget_config|widget_position/i.test(raw)) return "brand_voice"
  if (/notification/i.test(raw)) return "notifications"
  if (/auth\.users|metadata/i.test(raw)) return "publish_status"
  return "publish_rpc"
}

function tableFromStage(stage: string): string {
  if (stage.startsWith("services")) return "knowledge_services"
  if (stage === "faqs") return "knowledge_faqs"
  if (stage === "policies") return "knowledge_guardrails"
  if (stage === "brand_voice") return "widget_config"
  if (stage === "notifications" || stage === "publish_status") return "auth.users"
  return PUBLISH_RPC
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
  let context: PublishContext = {
    userId: null,
    businessId: null,
    onboardingSessionId: null,
  }
  publishInfo("PUBLISH_STARTED", context, { operation: "finalize_setup_assistant" })

  const limit = await checkActionLimit(LIMITS.actionSetupAssistant)
  if (!limit.ok) {
    publishFailure("PUBLISH_FAILED", context, {
      operation: "rate_limit",
      stage: "rate_limit",
      message: limit.error,
    })
    return { ok: false, errorType: "PUBLISH_FAILED", stage: "rate_limit", error: limit.error }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    publishFailure("PUBLISH_FAILED", context, {
      operation: "auth.getUser",
      stage: "authentication",
      code: authError?.code,
      message: authError?.message ?? "No authenticated user",
    })
    return { ok: false, errorType: "AUTH_ERROR", stage: "authentication", error: "Not authenticated" }
  }

  context = {
    userId: user.id,
    // Knowledge-base ownership is user-scoped in this schema, so the owner ID
    // is the authoritative business/workspace scope used by the publish RPC.
    businessId: user.id,
    onboardingSessionId:
      metadataString(user.user_metadata, "onboarding_session_id")
      ?? metadataString(user.user_metadata, "onboarding_setup_session_id"),
  }
  publishInfo("PUBLISH_AUTH_VALIDATED", context, { operation: "auth.getUser" })

  const parsed = knowledgeBaseSchema.safeParse(draftInput)
  if (!parsed.success) {
    publishFailure("PUBLISH_FAILED", context, {
      operation: "knowledgeBaseSchema.safeParse",
      stage: "payload_validation",
      failingPayloadFieldNames: parsed.error.issues.map((issue) => issue.path.join(".")),
    })
    return {
      ok: false,
      errorType: "VALIDATION_ERROR",
      stage: "payload_validation",
      error: parsed.error.issues[0]?.message ?? "Invalid KB",
    }
  }
  const kb = parsed.data
  publishInfo("PUBLISH_BUSINESS_LOADED", context, {
    operation: "owner_scoped_business",
    businessPayloadFields: Object.keys(kb.business ?? {}),
  })

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
  publishInfo("PUBLISH_SERVICES_NORMALIZED", context, {
    operation: "normalize_services",
    serviceCount: normalizedServices.length,
  })
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
    publishFailure("PUBLISH_FAILED", context, {
      operation: "validate_services",
      stage: "services_validation",
      table: "knowledge_services",
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
      stage: "services_validation",
      table: "knowledge_services",
      error: "We couldn't publish one or more services because their categories were not recognised. The issue has been logged. Please try again.",
      invalidServices: invalidServices.map((service) => ({
        name: service.name,
        category: service.category,
      })),
    }
  }
  publishInfo("PUBLISH_SERVICES_VALIDATED", context, {
    operation: "validate_services",
    table: "knowledge_services",
    allowedCategories: SERVICE_CATEGORIES,
  })

  console.info("PUBLISH_SERVICE_PAYLOAD", {
    ...context,
    services: serviceRows.map((service) => ({
      name: service.name,
      originalCategory: originalCategories.get(normalizeServiceName(service.name)) ?? null,
      normalizedCategory: service.category,
    })),
  })

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

  publishInfo("PUBLISH_PAYLOAD_BUILT", context, {
    operation: PUBLISH_RPC,
    table: PUBLISH_RPC,
    payloadFieldNames: Object.keys(rpcPayload),
    serviceRowFieldNames: serviceRows[0] ? Object.keys(serviceRows[0]) : [],
    faqRowFieldNames: faqRows[0] ? Object.keys(faqRows[0]) : [],
    guardrailRowFieldNames: guardrailRows[0] ? Object.keys(guardrailRows[0]) : [],
  })

  const { data: publishData, error: publishError } = await admin.rpc(
    PUBLISH_RPC as never,
    rpcPayload as never,
  )

  if (publishError) {
    const databaseError = publishError as DatabaseError
    const stage = stageFromDatabaseError(databaseError)
    const table = tableFromStage(stage)
    const failedService = stage.startsWith("services") && serviceRows.length === 1
      ? serviceRows[0]
      : undefined
    const failureFields = {
      operation: PUBLISH_RPC,
      stage,
      table,
      code: databaseError.code,
      message: databaseError.message,
      details: databaseError.details,
      hint: databaseError.hint,
      failingPayloadFieldNames: Object.keys(rpcPayload),
      failedServiceName: failedService?.name,
      originalCategory: failedService
        ? originalCategories.get(normalizeServiceName(failedService.name)) ?? null
        : undefined,
      normalizedCategory: failedService?.category,
      allowedCategories: SERVICE_CATEGORIES,
      services: serviceRows.map((service) => ({
        serviceName: service.name,
        originalCategory: originalCategories.get(normalizeServiceName(service.name)) ?? null,
        normalizedCategory: service.category,
      })),
    }
    publishFailure("PUBLISH_FAILED", context, failureFields)
    publishFailure("PUBLISH_ROLLED_BACK", context, failureFields)
    const categoryFailure = /INVALID_SERVICE_CATEGORY|knowledge_services_category_check/i.test(
      `${databaseError.message ?? ""} ${databaseError.details ?? ""}`,
    )
    const isDevelopment = process.env.NODE_ENV === "development"
    return {
      ok: false,
      errorType: categoryFailure ? "INVALID_SERVICE_CATEGORY" : "DATABASE_ERROR",
      stage,
      code: databaseError.code,
      table,
      failedService: failedService?.name,
      originalCategory: failedService
        ? originalCategories.get(normalizeServiceName(failedService.name)) ?? null
        : undefined,
      normalizedCategory: failedService?.category,
      error: isDevelopment
        ? databaseError.message ?? "Database publish failed"
        : categoryFailure
          ? "We couldn't publish one or more services because their categories were not recognised. The issue has been logged. Please try again."
          : "We couldn't publish your knowledge base. Nothing was changed. Please try again.",
      ...(isDevelopment
        ? { details: databaseError.details, hint: databaseError.hint }
        : {}),
    }
  }

  const published = (publishData ?? {}) as Partial<NonNullable<FinalizeSetupResult["inserted"]>>
  const servicesInserted = Number(published.services ?? serviceRows.length)
  const faqsInserted = Number(published.faqs ?? faqRows.length)
  const guardrailsInserted = Number(published.guardrails ?? guardrailRows.length)
  const widgetUpdated = published.widgetUpdated ?? true
  const settingsUpdated = published.settingsUpdated ?? false

  publishInfo("PUBLISH_SERVICES_SAVED", context, {
    operation: "services_upsert",
    table: "knowledge_services",
    rows: servicesInserted,
  })
  publishInfo("PUBLISH_FAQS_SAVED", context, {
    operation: "faqs_replace",
    table: "knowledge_faqs",
    rows: faqsInserted,
  })
  publishInfo("PUBLISH_POLICIES_SAVED", context, {
    operation: "policies_replace",
    table: "knowledge_guardrails",
    rows: guardrailsInserted,
  })
  publishInfo("PUBLISH_BRAND_VOICE_SAVED", context, {
    operation: "widget_upsert",
    table: "widget_config",
    updated: widgetUpdated,
  })
  publishInfo("PUBLISH_NOTIFICATIONS_SAVED", context, {
    operation: "metadata_publish",
    table: "auth.users",
    configuredEmailRecipient: Boolean(kb.notifications?.emailRecipients?.[0]),
  })
  publishInfo("PUBLISH_STATUS_UPDATED", context, {
    operation: "metadata_publish",
    table: "auth.users",
    onboardingCompleted: true,
  })
  publishInfo("PUBLISH_COMMITTED", context, {
    operation: PUBLISH_RPC,
    table: PUBLISH_RPC,
  })

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
