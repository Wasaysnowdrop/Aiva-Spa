import { createAdminClient } from "@/lib/supabase/admin"
import { MODEL_PRICING_VERSION, calculateModelCost, getModelPrice } from "./pricing"

export type AiUsagePurpose = "visitor_chat" | "onboarding" | "faq_extraction" | "service_extraction" | "compliance_check" | "internal_admin" | "fallback"
export type AiUsageContext = { businessId?: string | null; conversationId?: string | null; purpose?: AiUsagePurpose }

const estimateTokens = (text: string) => Math.max(1, Math.ceil(text.length / 4))

export async function recordAiUsage(input: {
  requestId: string
  context?: AiUsageContext
  provider: string
  model: string
  promptText: string
  completionText: string
  usage?: { promptTokens?: number; completionTokens?: number; cachedTokens?: number; totalTokens?: number }
  latencyMs: number
  status: "success" | "error" | "fallback"
  errorCode?: string | null
}): Promise<void> {
  const exact = Boolean(input.usage)
  const promptTokens = input.usage?.promptTokens ?? estimateTokens(input.promptText)
  const completionTokens = input.usage?.completionTokens ?? estimateTokens(input.completionText)
  const cachedTokens = input.usage?.cachedTokens ?? 0
  const totalTokens = input.usage?.totalTokens ?? promptTokens + completionTokens + cachedTokens
  const price = getModelPrice(input.model)
  try {
    const admin = createAdminClient()
    const { error } = await admin.from("ai_usage").insert({
      business_id: input.context?.businessId ?? null,
      conversation_id: input.context?.conversationId ?? null,
      request_id: input.requestId,
      provider: input.provider,
      model: input.model,
      purpose: input.status === "fallback" ? "fallback" : (input.context?.purpose ?? "internal_admin"),
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cached_tokens: cachedTokens,
      total_tokens: totalTokens,
      usage_source: exact ? "exact" : "estimated",
      latency_ms: Math.max(0, Math.round(input.latencyMs)),
      status: input.status,
      error_code: input.errorCode ?? null,
      estimated_cost_usd: calculateModelCost({ model: input.model, promptTokens, completionTokens, cachedTokens }),
      price_version: MODEL_PRICING_VERSION,
      pricing_snapshot: price,
    } as never)
    if (error && process.env.NODE_ENV !== "test") console.error("[ai-usage] insert failed", error.message)
  } catch (error) {
    if (process.env.NODE_ENV !== "test") console.error("[ai-usage] persistence unavailable", error)
  }
}
