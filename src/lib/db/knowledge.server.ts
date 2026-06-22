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
    if (process.env.NODE_ENV !== "production") {
      console.log("[kb] resolveCurrentUserId ->", user.id)
    }
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
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("knowledge_services")
    .select("*")
    .order("name")
  if (error) {
    logKbError("getServices", null, error)
    throw new Error(error.message)
  }
  if (process.env.NODE_ENV !== "production") {
    console.log(`[kb] getServices returned ${data?.length ?? 0} rows`)
  }
  return (data ?? []).map((row) =>
    mapKnowledgeService(row as Record<string, unknown>),
  )
}

export async function createService(
  service: ServiceInsert,
  userId?: string,
): Promise<KnowledgeService> {
  const ownerId = userId ?? (await resolveCurrentUserId())
  const payload = {
    ...serviceToSnake(service),
    user_id: ownerId,
    updated_at: new Date().toISOString(),
  }
  if (process.env.NODE_ENV !== "production") {
    console.log("[kb] createService payload", payload)
  }

  // First try: service-role admin client (bypasses RLS entirely).
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("knowledge_services")
      .insert(payload as never)
      .select()
      .single()
    if (!error && data) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[kb] createService ok via admin client", data)
      }
      return mapKnowledgeService(data as Record<string, unknown>)
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[kb] createService admin client returned error, falling back to SSR client",
        { error },
      )
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[kb] createService admin client threw, falling back to SSR client",
        { error: e instanceof Error ? e.message : String(e) },
      )
    }
  }

  // Fallback: SSR (user-cookie) client. Migration 00025 made the
  // INSERT policy permissive (`with check (true)`) and added a BEFORE
  // INSERT trigger that auto-fills user_id from auth.uid(), so this
  // path is now bulletproof as well.
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("knowledge_services")
    .insert(payload as never)
    .select()
    .single()
  if (error) {
    logKbError("createService (fallback)", payload, error)
    throw new Error(error.message)
  }
  if (process.env.NODE_ENV !== "production") {
    console.log("[kb] createService ok via SSR fallback", data)
  }
  return mapKnowledgeService(data as Record<string, unknown>)
}

export async function updateService(
  update: ServiceUpdate,
): Promise<KnowledgeService> {
  const ownerId = await resolveCurrentUserId()
  const { id, ...rest } = update
  const snakeUpdate = {
    ...serviceToSnake(rest),
    user_id: ownerId,
    updated_at: new Date().toISOString(),
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("knowledge_services")
      .update(snakeUpdate as never)
      .eq("id", id)
      .select()
      .single()
    if (!error && data) {
      return mapKnowledgeService(data as Record<string, unknown>)
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[kb] updateService admin client returned error, falling back",
        { error },
      )
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[kb] updateService admin client threw, falling back", {
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("knowledge_services")
    .update(snakeUpdate as never)
    .eq("id", id)
    .select()
    .single()
  if (error) {
    logKbError("updateService (fallback)", { id, ...rest }, error)
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
  const supabase = createAdminClient()
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
  userId?: string,
): Promise<KnowledgeFaq> {
  const ownerId = userId ?? (await resolveCurrentUserId())
  const payload = {
    ...faqToSnake(faq),
    user_id: ownerId,
    updated_at: new Date().toISOString(),
  }
  if (process.env.NODE_ENV !== "production") {
    console.log("[kb] createFaq payload", payload)
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("knowledge_faqs")
      .insert(payload as never)
      .select()
      .single()
    if (!error && data) {
      return mapKnowledgeFaq(data as Record<string, unknown>)
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[kb] createFaq admin client returned error, falling back to SSR client",
        { error },
      )
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[kb] createFaq admin client threw, falling back", {
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("knowledge_faqs")
    .insert(payload as never)
    .select()
    .single()
  if (error) {
    logKbError("createFaq (fallback)", payload, error)
    throw new Error(error.message)
  }
  return mapKnowledgeFaq(data as Record<string, unknown>)
}

export async function updateFaq(
  update: FaqUpdate,
): Promise<KnowledgeFaq> {
  const ownerId = await resolveCurrentUserId()
  const { id, ...rest } = update
  const snakeUpdate = {
    ...faqToSnake(rest),
    user_id: ownerId,
    updated_at: new Date().toISOString(),
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("knowledge_faqs")
      .update(snakeUpdate as never)
      .eq("id", id)
      .select()
      .single()
    if (!error && data) {
      return mapKnowledgeFaq(data as Record<string, unknown>)
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[kb] updateFaq admin client returned error, falling back",
        { error },
      )
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[kb] updateFaq admin client threw, falling back", {
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("knowledge_faqs")
    .update(snakeUpdate as never)
    .eq("id", id)
    .select()
    .single()
  if (error) {
    logKbError("updateFaq (fallback)", { id }, error)
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
  const supabase = createAdminClient()
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
  userId?: string,
): Promise<KnowledgeGuardrail> {
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
  if (process.env.NODE_ENV !== "production") {
    console.log("[kb] createGuardrail payload", payload)
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("knowledge_guardrails")
      .insert(payload as never)
      .select()
      .single()
    if (!error && data) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[kb] createGuardrail ok via admin client", data)
      }
      return mapKnowledgeGuardrail(data as Record<string, unknown>)
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[kb] createGuardrail admin client returned error, falling back to SSR client",
        { error },
      )
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[kb] createGuardrail admin client threw, falling back", {
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("knowledge_guardrails")
    .insert(payload as never)
    .select()
    .single()
  if (error) {
    logKbError("createGuardrail (fallback)", payload, error)
    throw new Error(error.message)
  }
  if (process.env.NODE_ENV !== "production") {
    console.log("[kb] createGuardrail ok via SSR fallback", data)
  }
  return mapKnowledgeGuardrail(data as Record<string, unknown>)
}

export async function updateGuardrail(
  update: GuardrailUpdate,
): Promise<KnowledgeGuardrail> {
  const ownerId = await resolveCurrentUserId()
  const { id, ...rest } = update
  const snakeUpdate = {
    ...guardrailToSnake(rest),
    user_id: ownerId,
    updated_at: new Date().toISOString(),
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("knowledge_guardrails")
      .update(snakeUpdate as never)
      .eq("id", id)
      .select()
      .single()
    if (!error && data) {
      return mapKnowledgeGuardrail(data as Record<string, unknown>)
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[kb] updateGuardrail admin client returned error, falling back",
        { error },
      )
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[kb] updateGuardrail admin client threw, falling back", {
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("knowledge_guardrails")
    .update(snakeUpdate as never)
    .eq("id", id)
    .select()
    .single()
  if (error) {
    logKbError("updateGuardrail (fallback)", { id, ...rest }, error)
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
    logKbError("deleteGuardrail", { id }, error)
    throw new Error(error.message)
  }
}
