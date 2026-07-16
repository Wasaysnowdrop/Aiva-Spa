"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { checkActionLimit } from "@/lib/security/check-action-limit"
import { LIMITS } from "@/lib/security/limits"

import {
  createService,
  updateService,
  deleteService,
  createFaq,
  updateFaq,
  updateGuardrail,
  createGuardrail,
  deleteGuardrail,
  deleteFaq,
} from "@/lib/db/knowledge.server"
import { updateWidgetConfig, getWidgetConfig } from "@/lib/db/widget.server"
import { recordAudit } from "@/lib/audit"
import { invalidateKnowledgeCache } from "@/lib/ai/retrieval"
import { createClient } from "@/lib/supabase/server"
import type { FaqCategory, KnowledgeCategory, GuardrailRuleType } from "@/lib/supabase/types"
import { GUARDRAIL_RULE_TYPES } from "@/lib/supabase/types"
import { normalizeServiceCategory } from "@/lib/kb/service-categories"

const faqCategoryValues = ["General", "Pricing", "Booking", "Safety", "Hours"] as const

const serviceSchema = z
  .object({
    name: z.string().min(1).max(120),
    category: z.string().trim().max(80).optional().default("Other"),
    description: z.string().max(2000).optional().default(""),
    pricingRule: z.string().max(200).optional().default(""),
    duration: z.string().max(80).optional().default(""),
    active: z.boolean().optional().default(true),
  })
  .transform((service) => ({
    ...service,
    category: normalizeServiceCategory(service.category, service.name),
  }))

const faqSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(4000),
  category: z.enum(faqCategoryValues),
})

const guardrailSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  description: z.string().min(1).max(2000).optional(),
  ruleType: z.enum(GUARDRAIL_RULE_TYPES as [GuardrailRuleType, ...GuardrailRuleType[]]).optional(),
  enabled: z.boolean().optional().default(true),
  isActive: z.boolean().optional(),
})

export type KnowledgeActionResult = { ok: boolean; error?: string; id?: string }

async function actorName(): Promise<string> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return "anonymous"
    return user.email?.split("@")[0] || user.id
  } catch {
    return "anonymous"
  }
}

function friendlyError(e: unknown, fallback: string): string {
  const raw = e instanceof Error ? e.message : fallback
  if (/knowledge_services_category_check|check constraint/i.test(raw)) {
    return "That service category is not supported. Choose a category from the list and try again."
  }
  if (/row-level security|violates row-level security/i.test(raw)) {
    return "Database rejected the write (RLS). Apply supabase/migrations/00025_kb_bulletproof_rls.sql on the remote DB (`npx supabase db push`), then restart the Next.js dev server and clear .next cache: `Remove-Item -Recurse -Force .next; npm run dev`."
  }
  if (/column .* does not exist/i.test(raw)) {
    return "Database schema is out of date. Run `npx supabase db push` to apply the latest migrations (00025_kb_bulletproof_rls.sql)."
  }
  if (/invalid input value for enum/i.test(raw)) {
    return "Service category is using a legacy enum. Apply supabase/migrations/00025_kb_bulletproof_rls.sql to switch category to free-form text."
  }
  if (/permission denied/i.test(raw)) {
    return "Supabase service role key is missing or wrong. Check SUPABASE_SERVICE_ROLE_KEY in .env.local."
  }
  return process.env.NODE_ENV === "production" ? fallback : raw
}

export async function createServiceAction(
  input: z.infer<typeof serviceSchema>,
): Promise<KnowledgeActionResult> {
  const limit = await checkActionLimit(LIMITS.actionKnowledge)
  if (!limit.ok) return { ok: false, error: limit.error }
  const parsed = serviceSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  try {
    const result = await createService(parsed.data)
    await recordAudit({
      userName: await actorName(),
      action: `kb.service_created ${result.id} (${result.name})`,
    })
    revalidatePath("/dashboard/knowledge-base")
    invalidateKnowledgeCache()
    return { ok: true, id: result.id }
  } catch (e) {
    return { ok: false, error: friendlyError(e, "Create failed") }
  }
}

export async function updateServiceAction(
  id: string,
  input: z.infer<typeof serviceSchema>,
): Promise<KnowledgeActionResult> {
  const limit = await checkActionLimit(LIMITS.actionKnowledge)
  if (!limit.ok) return { ok: false, error: limit.error }
  const parsed = serviceSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  try {
    const result = await updateService({ id, ...parsed.data })
    await recordAudit({
      userName: await actorName(),
      action: `kb.service_updated ${id} (${result.name}, active=${result.active})`,
    })
    revalidatePath("/dashboard/knowledge-base")
    invalidateKnowledgeCache()
    return { ok: true, id: result.id }
  } catch (e) {
    return { ok: false, error: friendlyError(e, "Update failed") }
  }
}

export async function deleteServiceAction(
  id: string,
): Promise<KnowledgeActionResult> {
  const limit = await checkActionLimit(LIMITS.actionKnowledge)
  if (!limit.ok) return { ok: false, error: limit.error }
  try {
    await deleteService(id)
    await recordAudit({
      userName: await actorName(),
      action: `kb.service_deleted ${id}`,
    })
    revalidatePath("/dashboard/knowledge-base")
    invalidateKnowledgeCache()
    return { ok: true, id }
  } catch (e) {
    return { ok: false, error: friendlyError(e, "Delete failed") }
  }
}

export async function toggleServiceActiveAction(
  id: string,
  active: boolean,
): Promise<KnowledgeActionResult> {
  const limit = await checkActionLimit(LIMITS.actionKnowledge)
  if (!limit.ok) return { ok: false, error: limit.error }
  try {
    const result = await updateService({ id, active })
    await recordAudit({
      userName: await actorName(),
      action: `kb.service_toggled ${id} -> active=${active}`,
    })
    revalidatePath("/dashboard/knowledge-base")
    invalidateKnowledgeCache()
    return { ok: true, id: result.id }
  } catch (e) {
    return { ok: false, error: friendlyError(e, "Toggle failed") }
  }
}

export async function createFaqAction(
  input: z.infer<typeof faqSchema>,
): Promise<KnowledgeActionResult> {
  const limit = await checkActionLimit(LIMITS.actionKnowledge)
  if (!limit.ok) return { ok: false, error: limit.error }
  const parsed = faqSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  try {
    const result = await createFaq(parsed.data)
    await recordAudit({
      userName: await actorName(),
      action: `kb.faq_created ${result.id} (${truncate(result.question, 60)})`,
    })
    revalidatePath("/dashboard/knowledge-base")
    invalidateKnowledgeCache()
    return { ok: true, id: result.id }
  } catch (e) {
    return { ok: false, error: friendlyError(e, "Create failed") }
  }
}

export async function updateFaqAction(
  id: string,
  input: z.infer<typeof faqSchema>,
): Promise<KnowledgeActionResult> {
  const limit = await checkActionLimit(LIMITS.actionKnowledge)
  if (!limit.ok) return { ok: false, error: limit.error }
  const parsed = faqSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  try {
    const result = await updateFaq({ id, ...parsed.data })
    await recordAudit({
      userName: await actorName(),
      action: `kb.faq_updated ${id} (${truncate(result.question, 60)})`,
    })
    revalidatePath("/dashboard/knowledge-base")
    invalidateKnowledgeCache()
    return { ok: true, id: result.id }
  } catch (e) {
    return { ok: false, error: friendlyError(e, "Update failed") }
  }
}

export async function deleteFaqAction(
  id: string,
): Promise<KnowledgeActionResult> {
  const limit = await checkActionLimit(LIMITS.actionKnowledge)
  if (!limit.ok) return { ok: false, error: limit.error }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Not authenticated" }
  }
  try {
    await deleteFaq(id)
    await recordAudit({
      userName: user.email?.split("@")[0] || user.id,
      action: `kb.faq_deleted ${id}`,
    })
    revalidatePath("/dashboard/knowledge-base")
    invalidateKnowledgeCache()
    return { ok: true, id }
  } catch (e) {
    return { ok: false, error: friendlyError(e, "Delete failed") }
  }
}

export async function toggleGuardrailAction(
  id: string,
  enabled: boolean,
): Promise<KnowledgeActionResult> {
  const limit = await checkActionLimit(LIMITS.actionKnowledge)
  if (!limit.ok) return { ok: false, error: limit.error }
  try {
    const result = await updateGuardrail({ id, enabled })
    await recordAudit({
      userName: await actorName(),
      action: `kb.guardrail_toggled ${id} -> enabled=${enabled} (${truncate(result.title, 60)})`,
    })
    revalidatePath("/dashboard/knowledge-base")
    invalidateKnowledgeCache()
    return { ok: true, id: result.id }
  } catch (e) {
    return { ok: false, error: friendlyError(e, "Toggle failed") }
  }
}

export async function createGuardrailAction(
  input: z.infer<typeof guardrailSchema>,
): Promise<KnowledgeActionResult> {
  const limit = await checkActionLimit(LIMITS.actionKnowledge)
  if (!limit.ok) return { ok: false, error: limit.error }
  const parsed = guardrailSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  try {
    const result = await createGuardrail(parsed.data)
    await recordAudit({
      userName: await actorName(),
      action: `kb.guardrail_created ${result.id} (${truncate(result.title, 60)})`,
    })
    revalidatePath("/dashboard/knowledge-base")
    invalidateKnowledgeCache()
    return { ok: true, id: result.id }
  } catch (e) {
    return { ok: false, error: friendlyError(e, "Create failed") }
  }
}

export async function updateGuardrailBodyAction(
  id: string,
  input: z.infer<typeof guardrailSchema>,
): Promise<KnowledgeActionResult> {
  const limit = await checkActionLimit(LIMITS.actionKnowledge)
  if (!limit.ok) return { ok: false, error: limit.error }
  const parsed = guardrailSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  try {
    const result = await updateGuardrail({ id, ...parsed.data })
    await recordAudit({
      userName: await actorName(),
      action: `kb.guardrail_updated ${id} (${truncate(result.title, 60)})`,
    })
    revalidatePath("/dashboard/knowledge-base")
    invalidateKnowledgeCache()
    return { ok: true, id: result.id }
  } catch (e) {
    return { ok: false, error: friendlyError(e, "Update failed") }
  }
}

export async function deleteGuardrailAction(
  id: string,
): Promise<KnowledgeActionResult> {
  const limit = await checkActionLimit(LIMITS.actionKnowledge)
  if (!limit.ok) return { ok: false, error: limit.error }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Not authenticated" }
  }
  try {
    await deleteGuardrail(id)
    await recordAudit({
      userName: user.email?.split("@")[0] || user.id,
      action: `kb.guardrail_deleted ${id}`,
    })
    revalidatePath("/dashboard/knowledge-base")
    invalidateKnowledgeCache()
    return { ok: true, id }
  } catch (e) {
    return { ok: false, error: friendlyError(e, "Delete failed") }
  }
}

const consentSchema = z.object({
  consentText: z.string().min(1).max(2000),
})

export async function updateConsentTextAction(
  input: z.infer<typeof consentSchema>,
): Promise<KnowledgeActionResult> {
  const limit = await checkActionLimit(LIMITS.actionKnowledge)
  if (!limit.ok) return { ok: false, error: limit.error }
  const parsed = consentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  try {
    const existing = await getWidgetConfig()
    if (!existing) return { ok: false, error: "No widget config found" }
    await updateWidgetConfig({ consentText: parsed.data.consentText })
    await recordAudit({
      userName: await actorName(),
      action: `widget.consent_text_updated`,
    })
    revalidatePath("/dashboard/knowledge-base")
    revalidatePath("/dashboard/widget")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: friendlyError(e, "Save failed") }
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s
}

export type KnowledgeCategoryForForm = KnowledgeCategory
export type FaqCategoryForForm = FaqCategory
