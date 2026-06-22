import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
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

// KB read/write helpers.
//
// Each helper that mutates a row takes the current authenticated user id
// (`auth.users.id`) and stamps it onto `user_id`. Reads always include
// `user_id IS NULL` so legacy / seed rows stay visible to everyone until
// they're touched by a user. RLS (migration 00022_kb_user_scoping.sql)
// enforces the same predicate on the browser client, so the dashboard
// realtime fetch and the server action read agree.
//
// Server actions look up the user via the SSR cookie client
// (`createClient()`); the admin client is used for the actual mutation
// so a stale cookie in the action request can never block a write.

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
    } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")
    return user.id
  } catch (e) {
    const message = e instanceof Error ? e.message : "auth lookup failed"
    throw new Error(`KB write requires an authenticated user (${message})`)
  }
}

export async function getServices(): Promise<KnowledgeService[]> {
  const supabase = createAdminClient()
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } } as never))
  let query = supabase
    .from("knowledge_services")
    .select("*")
    .order("name")
  if (user?.id) {
    query = query.or(`user_id.is.null,user_id.eq.${user.id}`)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) =>
    mapKnowledgeService(row as Record<string, unknown>),
  )
}

export async function createService(
  service: ServiceInsert,
  userId?: string,
): Promise<KnowledgeService> {
  const ownerId = userId ?? (await resolveCurrentUserId())
  const supabase = createAdminClient()
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
    console.error("[kb] createService failed", { payload, error })
    throw new Error(error.message)
  }
  return mapKnowledgeService(data as Record<string, unknown>)
}

export async function updateService(
  update: ServiceUpdate,
): Promise<KnowledgeService> {
  const ownerId = await resolveCurrentUserId()
  const supabase = createAdminClient()
  const { id, ...rest } = update
  const { data, error } = await supabase
    .from("knowledge_services")
    .update({
      ...serviceToSnake(rest),
      user_id: ownerId,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", id)
    .select()
    .single()
  if (error) {
    console.error("[kb] updateService failed", { id, error })
    throw new Error(error.message)
  }
  return mapKnowledgeService(data as Record<string, unknown>)
}

export async function deleteService(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("knowledge_services")
    .delete()
    .eq("id", id)
  if (error) {
    console.error("[kb] deleteService failed", { id, error })
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
  const supabase = createAdminClient()
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } } as never))
  let query = supabase
    .from("knowledge_faqs")
    .select("*")
    .order("created_at")
  if (user?.id) {
    query = query.or(`user_id.is.null,user_id.eq.${user.id}`)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) =>
    mapKnowledgeFaq(row as Record<string, unknown>),
  )
}

export async function createFaq(
  faq: FaqInsert,
  userId?: string,
): Promise<KnowledgeFaq> {
  const ownerId = userId ?? (await resolveCurrentUserId())
  const supabase = createAdminClient()
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
    console.error("[kb] createFaq failed", { payload, error })
    throw new Error(error.message)
  }
  return mapKnowledgeFaq(data as Record<string, unknown>)
}

export async function updateFaq(
  update: FaqUpdate,
): Promise<KnowledgeFaq> {
  const ownerId = await resolveCurrentUserId()
  const supabase = createAdminClient()
  const { id, ...rest } = update
  const { data, error } = await supabase
    .from("knowledge_faqs")
    .update({ ...faqToSnake(rest), user_id: ownerId, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .select()
    .single()
  if (error) {
    console.error("[kb] updateFaq failed", { id, error })
    throw new Error(error.message)
  }
  return mapKnowledgeFaq(data as Record<string, unknown>)
}

export async function deleteFaq(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("knowledge_faqs")
    .delete()
    .eq("id", id)
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

export type GuardrailInsert = {
  title: string
  body: string
  enabled?: boolean
}

export type GuardrailUpdate = Partial<GuardrailInsert> & { id: string }

function guardrailToSnake(
  g: Partial<GuardrailInsert>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if ("title" in g) payload.title = g.title
  if ("body" in g) payload.body = g.body
  if ("enabled" in g) payload.enabled = g.enabled
  return payload
}

export async function getGuardrails(): Promise<KnowledgeGuardrail[]> {
  const supabase = createAdminClient()
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } } as never))
  let query = supabase
    .from("knowledge_guardrails")
    .select("*")
    .order("created_at")
  if (user?.id) {
    query = query.or(`user_id.is.null,user_id.eq.${user.id}`)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) =>
    mapKnowledgeGuardrail(row as Record<string, unknown>),
  )
}

export async function createGuardrail(
  guardrail: GuardrailInsert,
  userId?: string,
): Promise<KnowledgeGuardrail> {
  const ownerId = userId ?? (await resolveCurrentUserId())
  const supabase = createAdminClient()
  const payload = {
    ...guardrailToSnake(guardrail),
    user_id: ownerId,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from("knowledge_guardrails")
    .insert(payload as never)
    .select()
    .single()
  if (error) {
    console.error("[kb] createGuardrail failed", { payload, error })
    throw new Error(error.message)
  }
  return mapKnowledgeGuardrail(data as Record<string, unknown>)
}

export async function updateGuardrail(
  update: GuardrailUpdate,
): Promise<KnowledgeGuardrail> {
  const ownerId = await resolveCurrentUserId()
  const supabase = createAdminClient()
  const { id, ...rest } = update
  const { data, error } = await supabase
    .from("knowledge_guardrails")
    .update({
      ...guardrailToSnake(rest),
      user_id: ownerId,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", id)
    .select()
    .single()
  if (error) {
    console.error("[kb] updateGuardrail failed", { id, error })
    throw new Error(error.message)
  }
  return mapKnowledgeGuardrail(data as Record<string, unknown>)
}

export async function deleteGuardrail(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("knowledge_guardrails")
    .delete()
    .eq("id", id)
  if (error) {
    console.error("[kb] deleteGuardrail failed", { id, error })
    throw new Error(error.message)
  }
}
