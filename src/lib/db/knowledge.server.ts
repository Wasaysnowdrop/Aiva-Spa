import "server-only"

import { createClient } from "@/lib/supabase/server"
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

async function resolveCurrentUserId(): Promise<string> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error
    } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Not authenticated")
    return user.id
  } catch (e) {
    const message = e instanceof Error ? e.message : "auth lookup failed"
    throw new Error(`KB write requires an authenticated user (${message})`)
  }
}

function logKbError(stage: string, payload: unknown, error: unknown) {
  console.error(`[kb] ${stage} failed`, {
    payload,
    error:
      error && typeof error === "object"
        ? {
            message: (error as { message?: string }).message,
            code: (error as { code?: string }).code,
            details: (error as { details?: string }).details,
            hint: (error as { hint?: string }).hint,
          }
        : error,
  })
}

export async function getServices(): Promise<KnowledgeService[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from("knowledge_services")
    .select("*")
    .eq("user_id", user.id)
    .order("name")
  
  if (error) {
    logKbError("getServices", null, error)
    throw new Error(error.message)
  }
  
  return (data ?? []).map((row) =>
    mapKnowledgeService(row as Record<string, unknown>),
  )
}

export async function createService(
  service: ServiceInsert,
  userId?: string,
): Promise<KnowledgeService> {
  const supabase = await createClient()
  const ownerId = userId ?? (await resolveCurrentUserId())
  
  const payload = {
    ...serviceToSnake(service),
    user_id: ownerId,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("knowledge_services")
    .insert(payload as never)
    .select()
    .single()
    
  if (error) {
    logKbError("createService", payload, error)
    throw new Error(error.message)
  }
  
  return mapKnowledgeService(data as Record<string, unknown>)
}

export async function updateService(
  update: ServiceUpdate,
): Promise<KnowledgeService> {
  const supabase = await createClient()
  const ownerId = await resolveCurrentUserId()
  const { id, ...rest } = update
  
  const snakeUpdate = {
    ...serviceToSnake(rest),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("knowledge_services")
    .update(snakeUpdate as never)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single()
    
  if (error) {
    logKbError("updateService", { id, ...rest }, error)
    throw new Error(error.message)
  }
  
  return mapKnowledgeService(data as Record<string, unknown>)
}

export async function deleteService(id: string): Promise<void> {
  const supabase = await createClient()
  const ownerId = await resolveCurrentUserId()
  
  const { error } = await supabase
    .from("knowledge_services")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId)
    
  if (error) {
    logKbError("deleteService", { id }, error)
    throw new Error(error.message)
  }
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from("knowledge_faqs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at")
    
  if (error) throw new Error(error.message)
  
  return (data ?? []).map((row) =>
    mapKnowledgeFaq(row as Record<string, unknown>),
  )
}

export async function createFaq(
  faq: FaqInsert,
  userId?: string,
): Promise<KnowledgeFaq> {
  const supabase = await createClient()
  const ownerId = userId ?? (await resolveCurrentUserId())
  
  const payload = {
    ...faqToSnake(faq),
    user_id: ownerId,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("knowledge_faqs")
    .insert(payload as never)
    .select()
    .single()
    
  if (error) {
    logKbError("createFaq", payload, error)
    throw new Error(error.message)
  }
  
  return mapKnowledgeFaq(data as Record<string, unknown>)
}

export async function updateFaq(
  update: FaqUpdate,
): Promise<KnowledgeFaq> {
  const supabase = await createClient()
  const ownerId = await resolveCurrentUserId()
  const { id, ...rest } = update
  
  const snakeUpdate = {
    ...faqToSnake(rest),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("knowledge_faqs")
    .update(snakeUpdate as never)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single()
    
  if (error) {
    logKbError("updateFaq", { id }, error)
    throw new Error(error.message)
  }
  
  return mapKnowledgeFaq(data as Record<string, unknown>)
}

export async function deleteFaq(id: string): Promise<void> {
  const supabase = await createClient()
  const ownerId = await resolveCurrentUserId()
  
  const { error } = await supabase
    .from("knowledge_faqs")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId)
    
  if (error) {
    console.error("[kb] deleteFaq failed", { id, error })
    throw new Error(error.message)
  }
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

function normalizeRuleType(value: unknown): GuardrailRuleType {
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
    payload.rule_type = normalizeRuleType(g.ruleType)
  } else if (Object.prototype.hasOwnProperty.call(g, "ruleType")) {
    payload.rule_type = "general"
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from("knowledge_guardrails")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at")
    
  if (error) throw new Error(error.message)
  
  return (data ?? []).map((row) =>
    mapKnowledgeGuardrail(row as Record<string, unknown>),
  )
}

export async function createGuardrail(
  guardrail: GuardrailInsert,
  userId?: string,
): Promise<KnowledgeGuardrail> {
  const supabase = await createClient()
  const ownerId = userId ?? (await resolveCurrentUserId())
  
  const descriptionText =
    typeof guardrail.description === "string"
      ? guardrail.description.trim()
      : typeof guardrail.body === "string"
        ? guardrail.body.trim()
        : ""
        
  const payload = {
    ...guardrailToSnake(guardrail),
    description: descriptionText,
    body: descriptionText,
    user_id: ownerId,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("knowledge_guardrails")
    .insert(payload as never)
    .select()
    .single()
    
  if (error) {
    logKbError("createGuardrail", payload, error)
    throw new Error(error.message)
  }
  
  return mapKnowledgeGuardrail(data as Record<string, unknown>)
}

export async function updateGuardrail(
  update: GuardrailUpdate,
): Promise<KnowledgeGuardrail> {
  const supabase = await createClient()
  const ownerId = await resolveCurrentUserId()
  const { id, ...rest } = update
  
  const snakeUpdate = {
    ...guardrailToSnake(rest),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("knowledge_guardrails")
    .update(snakeUpdate as never)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single()
    
  if (error) {
    logKbError("updateGuardrail", { id, ...rest }, error)
    throw new Error(error.message)
  }
  
  return mapKnowledgeGuardrail(data as Record<string, unknown>)
}

export async function deleteGuardrail(id: string): Promise<void> {
  const supabase = await createClient()
  const ownerId = await resolveCurrentUserId()
  
  const { error } = await supabase
    .from("knowledge_guardrails")
    .delete()
    .eq("id", id)
    .eq("user_id", ownerId)
    
  if (error) {
    logKbError("deleteGuardrail", { id }, error)
    throw new Error(error.message)
  }
}
