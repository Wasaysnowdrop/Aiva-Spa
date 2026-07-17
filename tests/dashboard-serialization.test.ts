import { describe, expect, it } from "vitest"

import { isSuccessfulPublishResult } from "@/lib/ai/publish-result"
import { deriveSnapshot } from "@/lib/subscription"
import { toPricingSubscriptionSummary } from "@/lib/subscription/pricing-summary"

describe("dashboard server/client serialization contracts", () => {
  it("removes function-bearing subscription fields before rendering client UI", () => {
    const serverSnapshot = deriveSnapshot(null)
    expect(typeof serverSnapshot.hasAccess).toBe("function")

    const clientSummary = toPricingSubscriptionSummary(serverSnapshot)

    expect(clientSummary).toEqual({
      planId: "starter",
      status: "none",
      isActive: false,
      canStartTrial: false,
    })
    expect(Object.values(clientSummary).some((value) => typeof value === "function")).toBe(false)
    expect(JSON.parse(JSON.stringify(clientSummary))).toEqual(clientSummary)
  })

  it("accepts navigation only after an explicit committed publish response", () => {
    expect(isSuccessfulPublishResult({ ok: true })).toBe(false)
    expect(isSuccessfulPublishResult({ ok: true, success: true, published: true })).toBe(false)
    expect(isSuccessfulPublishResult({
      ok: true,
      success: true,
      published: true,
      knowledgeBaseId: "workspace-1",
      redirectTo: "/dashboard",
    })).toBe(true)
    expect(isSuccessfulPublishResult({
      ok: true,
      success: true,
      published: true,
      knowledgeBaseId: "workspace-1",
      redirectTo: "/dashboard/knowledge-base",
    })).toBe(false)
  })
})