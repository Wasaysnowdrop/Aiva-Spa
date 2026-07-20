import { describe, expect, it } from "vitest"
import { calculateModelCost, getModelPrice, MODEL_PRICING_VERSION } from "@/lib/ai/pricing"
import { canAdmin, normalizeAdminRole } from "@/lib/admin/permissions"
import { humanizeAction } from "@/lib/admin/format"

describe("admin control centre primitives", () => {
  it("calculates model costs from the versioned pricing snapshot", () => {
    const price = getModelPrice("mistral-medium-3-5")
    expect(MODEL_PRICING_VERSION).toBe("2026-07-20")
    expect(price.inputPerMillion).toBeGreaterThan(0)
    expect(calculateModelCost({ model: "mistral-medium-3-5", promptTokens: 1_000_000, completionTokens: 1_000_000 })).toBe(price.inputPerMillion + price.outputPerMillion)
  })

  it("keeps read-only admins from every mutation permission", () => {
    expect(normalizeAdminRole("read_only_admin")).toBe("read_only_admin")
    expect(canAdmin("read_only_admin", "users:write")).toBe(false)
    expect(canAdmin("support_admin", "users:write")).toBe(true)
    expect(canAdmin("support_admin", "subscriptions:write")).toBe(false)
  })

  it("formats machine audit actions for operators", () => {
    expect(humanizeAction("user.ban")).toBe("User access suspended.")
    expect(humanizeAction("SUBSCRIPTION_PLAN_CHANGED", { from: "growth", to: "pro" })).toBe("Plan changed from growth to pro.")
    expect(humanizeAction("knowledge.publish")).toBe("Knowledge publish.")
  })
})
