import { createClient } from "@/lib/supabase/client"
import type {
  KnowledgeService,
  KnowledgeFaq,
  KnowledgeGuardrail,
  FaqCategory,
} from "@/lib/supabase/types"
import {
  mapKnowledgeService,
  mapKnowledgeFaq,
  mapKnowledgeGuardrail,
} from "@/lib/supabase/types"

// --- Services ---

export type ServiceInsert = {
  name: string
  category: KnowledgeService["category"]
  description?: string
  pricingRule?: string
  duration?: string
  active?: boolean
}

export type ServiceUpdate = Partial<ServiceInsert> & { id: string }

function serviceToSnake(
  s: Partial<ServiceInsert>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if ("name" in s) payload.name = s.name
  if ("category" in s) payload.category = s.category
  if ("description" in s) payload.description = s.description
  if ("pricingRule" in s) payload.pricing_rule = s.pricingRule
  if ("duration" in s) payload.duration = s.duration
  if ("active" in s) payload.active = s.active
  return payload
}

export async function getServices(): Promise<KnowledgeService[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("knowledge_services")
    .select("*")
    .order("name")

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) =>
    mapKnowledgeService(row as Record<string, unknown>),
  )
}

export async function createService(
  service: ServiceInsert,
): Promise<KnowledgeService> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("knowledge_services")
    .insert(serviceToSnake(service) as never)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapKnowledgeService(data as Record<string, unknown>)
}

export async function updateService(
  update: ServiceUpdate,
): Promise<KnowledgeService> {
  const supabase = createClient()
  const { id, ...rest } = update
  const { data, error } = await supabase
    .from("knowledge_services")
    .update(serviceToSnake(rest) as never)
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapKnowledgeService(data as Record<string, unknown>)
}

export async function deleteService(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("knowledge_services")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
}

// --- FAQs ---

export type FaqInsert = {
  question: string
  answer: string
  category: FaqCategory
}

export type FaqUpdate = Partial<FaqInsert> & { id: string }

function faqToSnake(
  f: Partial<FaqInsert>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if ("question" in f) payload.question = f.question
  if ("answer" in f) payload.answer = f.answer
  if ("category" in f) payload.category = f.category
  return payload
}

export async function getFaqs(): Promise<KnowledgeFaq[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("knowledge_faqs")
    .select("*")
    .order("created_at")

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) =>
    mapKnowledgeFaq(row as Record<string, unknown>),
  )
}

export async function createFaq(
  faq: FaqInsert,
): Promise<KnowledgeFaq> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("knowledge_faqs")
    .insert(faqToSnake(faq) as never)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapKnowledgeFaq(data as Record<string, unknown>)
}

export async function updateFaq(
  update: FaqUpdate,
): Promise<KnowledgeFaq> {
  const supabase = createClient()
  const { id, ...rest } = update
  const { data, error } = await supabase
    .from("knowledge_faqs")
    .update({ ...faqToSnake(rest), updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapKnowledgeFaq(data as Record<string, unknown>)
}

export async function deleteFaq(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("knowledge_faqs")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
}

export const faqCategories: FaqCategory[] = [
  "General",
  "Pricing",
  "Booking",
  "Safety",
  "Hours",
]

// --- Guardrails ---

import type { GuardrailRuleType } from "@/lib/supabase/types"
import { GUARDRAIL_RULE_TYPES } from "@/lib/supabase/types"

export type GuardrailInsert = {
  title: string
  body?: string
  description?: string
  ruleType?: GuardrailRuleType
  enabled?: boolean
  isActive?: boolean
}

export type GuardrailUpdate = Partial<GuardrailInsert> & { id: string }

function normalizeRuleTypeClient(value: unknown): GuardrailRuleType {
  if (typeof value !== "string") return "general"
  const v = value.trim().toLowerCase()
  return (GUARDRAIL_RULE_TYPES as readonly string[]).includes(v)
    ? (v as GuardrailRuleType)
    : "general"
}

function guardrailToSnake(
  g: Partial<GuardrailInsert>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if ("title" in g) payload.title = g.title
  const description =
    "description" in g
      ? g.description
      : "body" in g
        ? g.body
        : undefined
  if (description !== undefined) {
    const value = typeof description === "string" ? description.trim() : ""
    payload.description = value
    payload.body = value
  }
  if ("ruleType" in g) {
    payload.rule_type = normalizeRuleTypeClient(g.ruleType)
  } else {
    payload.rule_type = "general"
  }
  if ("enabled" in g) {
    payload.enabled = g.enabled
    payload.is_active = g.enabled
  }
  if ("isActive" in g) {
    payload.is_active = g.isActive
    payload.enabled = g.isActive
  }
  return payload
}

export async function getGuardrails(): Promise<KnowledgeGuardrail[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("knowledge_guardrails")
    .select("*")
    .order("created_at")

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) =>
    mapKnowledgeGuardrail(row as Record<string, unknown>),
  )
}

export async function createGuardrail(
  guardrail: GuardrailInsert,
): Promise<KnowledgeGuardrail> {
  const supabase = createClient()
  const descriptionText =
    typeof guardrail.description === "string"
      ? guardrail.description.trim()
      : typeof guardrail.body === "string"
        ? guardrail.body.trim()
        : ""
  const { data, error } = await supabase
    .from("knowledge_guardrails")
    .insert({
      ...guardrailToSnake(guardrail),
      description: descriptionText,
      body: descriptionText,
    } as never)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapKnowledgeGuardrail(data as Record<string, unknown>)
}

export async function updateGuardrail(
  update: GuardrailUpdate,
): Promise<KnowledgeGuardrail> {
  const supabase = createClient()
  const { id, ...rest } = update
  const { data, error } = await supabase
    .from("knowledge_guardrails")
    .update(guardrailToSnake(rest) as never)
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapKnowledgeGuardrail(data as Record<string, unknown>)
}

export async function deleteGuardrail(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("knowledge_guardrails")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
}
