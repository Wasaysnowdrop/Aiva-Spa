"use server"

import {
  mapKnowledgeService,
  mapKnowledgeFaq,
  mapKnowledgeGuardrail,
  type KnowledgeService,
  type KnowledgeFaq,
  type KnowledgeGuardrail,
} from "@/lib/supabase/types"
import { createClient } from "@/lib/supabase/server"
import { checkActionLimit } from "@/lib/security/check-action-limit"
import { LIMITS } from "@/lib/security/limits"

export type KnowledgeBaseSnapshot = {
  services: KnowledgeService[]
  faqs: KnowledgeFaq[]
  guardrails: KnowledgeGuardrail[]
  fetchedAt: string
}

export async function loadKnowledgeBaseAction(): Promise<KnowledgeBaseSnapshot> {
  // Soft cap so a misbehaving tab can't hammer the DB. The KB is small
  // (<200 rows typically) so this is just a safety belt.
  const limit = await checkActionLimit(LIMITS.actionKnowledge)
  if (!limit.ok) {
    return { services: [], faqs: [], guardrails: [], fetchedAt: new Date().toISOString() }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { services: [], faqs: [], guardrails: [], fetchedAt: new Date().toISOString() }
  }

  const [svc, faq, grd] = await Promise.all([
    supabase.from("knowledge_services").select("*").eq("user_id", user.id).order("name"),
    supabase.from("knowledge_faqs").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("knowledge_guardrails").select("*").eq("user_id", user.id).order("created_at"),
  ])
  return {
    services: (svc.data ?? []).map((r) =>
      mapKnowledgeService(r as Record<string, unknown>),
    ),
    faqs: (faq.data ?? []).map((r) =>
      mapKnowledgeFaq(r as Record<string, unknown>),
    ),
    guardrails: (grd.data ?? []).map((r) =>
      mapKnowledgeGuardrail(r as Record<string, unknown>),
    ),
    fetchedAt: new Date().toISOString(),
  }
}
