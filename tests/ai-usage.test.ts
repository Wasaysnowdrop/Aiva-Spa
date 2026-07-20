import { beforeEach, describe, expect, it, vi } from "vitest"

const insert = vi.fn(async () => ({ error: null }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ insert }) }) }))

describe("AI usage persistence", () => {
  beforeEach(() => insert.mockClear())

  it("stores provider token usage as exact", async () => {
    const { recordAiUsage } = await import("@/lib/ai/usage")
    await recordAiUsage({ requestId: "exact-1", provider: "nara", model: "mistral-medium-3-5", promptText: "hello", completionText: "hi", usage: { promptTokens: 12, completionTokens: 5, totalTokens: 17 }, latencyMs: 90, status: "success" })
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ usage_source: "exact", prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 }))
  })

  it("marks missing provider usage as estimated", async () => {
    const { recordAiUsage } = await import("@/lib/ai/usage")
    await recordAiUsage({ requestId: "estimate-1", provider: "nara", model: "mistral-medium-3-5", promptText: "a longer prompt", completionText: "answer", latencyMs: 120, status: "success" })
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ usage_source: "estimated" }))
  })
})
