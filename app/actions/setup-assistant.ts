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
import { mapWidgetConfig } from "@/lib/supabase/types"
import type { KnowledgeCategory, FaqCategory, WidgetConfig } from "@/lib/supabase/types"

export type FinalizeSetupResult = {
  ok: boolean
  error?: string
  inserted?: {
    services: number
    faqs: number
    widgetUpdated: boolean
    settingsUpdated: boolean
  }
}

function toServiceCategory(input: string): KnowledgeCategory {
  const map: Record<string, KnowledgeCategory> = {
    Injectables: "Injectables",
    Skin: "Skin",
    Body: "Body",
    Laser: "Laser",
    Other: "Skin",
  }
  return map[input] ?? "Skin"
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

export async function finalizeSetupAssistant(
  draftInput: unknown,
): Promise<FinalizeSetupResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Not authenticated" }
  }

  const parsed = knowledgeBaseSchema.safeParse(draftInput)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid KB" }
  }
  const kb = parsed.data

  const admin = createAdminClient()

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

  let widgetUpdated = false
  try {
    const { data: existing } = await admin
      .from("widget_config")
      .select("*")
      .limit(1)
      .maybeSingle()
    if (existing) {
      const snake: Record<string, unknown> = {
        brand_name: widget.brandName,
        logo_initial: widget.logoInitial,
        welcome_message: widget.welcomeMessage,
        consent_text: widget.consentText,
        working_hours: widget.workingHours,
        extended_kb: widget.extendedKb,
      }
      const { error } = await admin
        .from("widget_config")
        .update(snake as never)
        .eq("id", (existing as { id: string }).id)
      if (!error) widgetUpdated = true
      else console.warn("widget_config update failed", error.message)
    } else {
      const { error } = await admin.from("widget_config").insert({
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
        extended_kb: widget.extendedKb,
      } as never)
      if (!error) widgetUpdated = true
      else console.warn("widget_config insert failed", error.message)
    }
    void mapWidgetConfig
  } catch (e) {
    console.warn("widget_config persist failed", e)
  }

  let servicesInserted = 0
  if (kb.services && kb.services.length > 0) {
    try {
      const rows = kb.services.map((s) => ({
        name: s.name,
        category: toServiceCategory(s.category),
        description: s.description,
        pricing_rule: s.priceRange
          ? `Indicative range ${s.priceRange.currency} ${s.priceRange.min}–${s.priceRange.max} ${s.priceRange.unit} (indicative only)`
          : "Confirmed at consultation",
        duration: s.duration || "",
        active: true,
      }))
      const { data, error } = await admin
        .from("knowledge_services")
        .insert(rows as never)
        .select("id")
      if (!error && Array.isArray(data)) servicesInserted = data.length
      else if (error) console.warn("knowledge_services insert failed", error.message)
    } catch (e) {
      console.warn("knowledge_services persist failed", e)
    }
  }

  let faqsInserted = 0
  if (kb.faqs && kb.faqs.length > 0) {
    try {
      const rows = kb.faqs.map((f) => ({
        question: f.question,
        answer: f.answer,
        category: toFaqCategory(f.category),
      }))
      const { data, error } = await admin
        .from("knowledge_faqs")
        .insert(rows as never)
        .select("id")
      if (!error && Array.isArray(data)) faqsInserted = data.length
      else if (error) console.warn("knowledge_faqs insert failed", error.message)
    } catch (e) {
      console.warn("knowledge_faqs persist failed", e)
    }
  }

  let settingsUpdated = false
  try {
    const website = pickStr(kb.business?.website)
    const address =
      kb.business?.addresses?.[0]
        ? `${kb.business.addresses[0].line1}${
            kb.business.addresses[0].city ? `, ${kb.business.addresses[0].city}` : ""
          }${kb.business.addresses[0].region ? `, ${kb.business.addresses[0].region}` : ""}`
        : ""
    const { data: existing } = await admin
      .from("spa_settings")
      .select("id")
      .limit(1)
      .maybeSingle()
    if (existing) {
      const payload: Record<string, unknown> = {}
      if (brandName) payload.spa_name = brandName
      if (website) payload.website = website
      if (address) payload.address = address
      if (Object.keys(payload).length > 0) {
        const { error } = await admin
          .from("spa_settings")
          .update(payload as never)
          .eq("id", (existing as { id: string }).id)
        if (!error) settingsUpdated = true
        else console.warn("spa_settings update failed", error.message)
      } else {
        settingsUpdated = true
      }
    }
  } catch (e) {
    console.warn("spa_settings persist failed", e)
  }

  try {
    const meta: Record<string, unknown> = {
      ...user.user_metadata,
      spa_name: brandName,
      onboarding_kb: kb,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
    }
    const website = pickStr(kb.business?.website)
    if (website) meta.website = website
    if (kb.notifications?.emailRecipients && kb.notifications.emailRecipients[0]) {
      meta.notification_email = kb.notifications.emailRecipients[0]
    }
    if (kb.brand_voice?.tone) meta.brand_tone = kb.brand_voice.tone
    if (kb.brand_voice?.greeting) meta.widget_greeting = kb.brand_voice.greeting
    delete meta.onboarding_kb_draft
    delete meta.onboarding_setup_section
    await admin.auth.admin.updateUserById(user.id, { user_metadata: meta })
  } catch (e) {
    console.warn("user_metadata persist failed", e)
  }

  invalidateKnowledgeCache()
  void recordAuditForUser(user, `onboarding.finalized services=${servicesInserted} faqs=${faqsInserted}`)

  try {
    await ensureTrialSubscription(user.id)
  } catch {
    // Non-fatal
  }

  return {
    ok: true,
    inserted: {
      services: servicesInserted,
      faqs: faqsInserted,
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
