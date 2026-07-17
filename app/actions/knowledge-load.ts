"use server"

import { randomUUID } from "node:crypto"
import { z } from "zod"

import {
  mapKnowledgeService,
  mapKnowledgeFaq,
  mapKnowledgeGuardrail,
  type KnowledgeService,
  type KnowledgeFaq,
  type KnowledgeGuardrail,
} from "@/lib/supabase/types"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { checkActionLimit } from "@/lib/security/check-action-limit"
import { LIMITS } from "@/lib/security/limits"

export type KnowledgeBaseSnapshot = {
  services: KnowledgeService[]
  faqs: KnowledgeFaq[]
  guardrails: KnowledgeGuardrail[]
  fetchedAt: string
  status?: "ok" | "partial" | "unauthenticated" | "rate_limited"
  issues?: string[]
}

const knowledgeRowsSchema = z.array(z.record(z.string(), z.unknown()))

function emptySnapshot(
  status: NonNullable<KnowledgeBaseSnapshot["status"]>,
  issues: string[] = [],
): KnowledgeBaseSnapshot {
  return {
    services: [],
    faqs: [],
    guardrails: [],
    fetchedAt: new Date().toISOString(),
    status,
    ...(issues.length > 0 ? { issues } : {}),
  }
}

function safeRows(
  value: unknown,
  table: string,
  issues: string[],
  requestId: string,
): Array<Record<string, unknown>> {
  const parsed = knowledgeRowsSchema.safeParse(value)
  if (parsed.success) return parsed.data

  issues.push(table)
  console.error("KNOWLEDGE_BASE_PAGE_DATA_INVALID", {
    route: "/dashboard/knowledge-base",
    requestId,
    table,
    invalidIssueCount: parsed.error.issues.length,
  })
  return []
}

export async function loadKnowledgeBaseAction(): Promise<KnowledgeBaseSnapshot> {
  const requestId = randomUUID()

  // Soft cap so a misbehaving tab can't hammer the DB. The KB is small
  // (<200 rows typically) so this is just a safety belt.
  const limit = await checkActionLimit(LIMITS.actionKnowledge)
  if (!limit.ok) {
    console.warn("KNOWLEDGE_BASE_PAGE_FETCH_RATE_LIMITED", {
      route: "/dashboard/knowledge-base",
      requestId,
    })
    return emptySnapshot("rate_limited")
  }

  // Get user ID from SSR cookies (auth only)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.warn("KNOWLEDGE_BASE_PAGE_FETCH_UNAUTHENTICATED", {
      route: "/dashboard/knowledge-base",
      requestId,
    })
    return emptySnapshot("unauthenticated")
  }

  console.info("KNOWLEDGE_BASE_PAGE_FETCH_STARTED", {
    route: "/dashboard/knowledge-base",
    requestId,
    businessId: user.id,
    knowledgeBaseId: user.id,
  })

  // Use admin client for DB reads — bypasses RLS, scoped by user_id in app code
  const admin = createAdminClient()
  const [svc, faq, grd] = await Promise.all([
    admin.from("knowledge_services").select("*").eq("user_id", user.id).order("name"),
    admin.from("knowledge_faqs").select("*").eq("user_id", user.id).order("created_at"),
    admin.from("knowledge_guardrails").select("*").eq("user_id", user.id).order("created_at"),
  ])
  const queryResults = [
    ["knowledge_services", svc.error],
    ["knowledge_faqs", faq.error],
    ["knowledge_guardrails", grd.error],
  ] as const
  const issues = queryResults
    .filter(([, error]) => Boolean(error))
    .map(([table]) => table)

  for (const [table, queryError] of queryResults) {
    if (!queryError) continue
    console.error("KNOWLEDGE_BASE_PAGE_FETCH_FAILED", {
      route: "/dashboard/knowledge-base",
      requestId,
      businessId: user.id,
      knowledgeBaseId: user.id,
      table,
      code: queryError.code ?? null,
    })
  }

  const services = safeRows(svc.data ?? [], "knowledge_services", issues, requestId).map(mapKnowledgeService)
  const faqs = safeRows(faq.data ?? [], "knowledge_faqs", issues, requestId).map(mapKnowledgeFaq)
  const guardrails = safeRows(grd.data ?? [], "knowledge_guardrails", issues, requestId).map(mapKnowledgeGuardrail)
  const status = issues.length > 0 ? "partial" : "ok"

  console.info("KNOWLEDGE_BASE_PAGE_FETCH_SUCCESS", {
    route: "/dashboard/knowledge-base",
    requestId,
    businessId: user.id,
    knowledgeBaseId: user.id,
    currentStatus: status,
    serviceCount: services.length,
    faqCount: faqs.length,
    guardrailCount: guardrails.length,
    issueTables: [...new Set(issues)],
  })

  return {
    services,
    faqs,
    guardrails,
    fetchedAt: new Date().toISOString(),
    status,
    ...(issues.length > 0 ? { issues: [...new Set(issues)] } : {}),
  }
}
