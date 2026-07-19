import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { formatActivityEvent, isCustomerFacingActivity } from "@/lib/activity/formatter"

describe("customer-facing activity formatting", () => {
  it("turns a subscription event into readable plan language", () => {
    expect(formatActivityEvent({
      action: "subscription SUBSCRIPTION_PLAN_CHANGED from=growth to=pro effective_at=immediate",
      userName: "Abdul Wasay",
      createdAt: "2026-07-18T00:00:00.000Z",
      metadata: { key: "SUBSCRIPTION_PLAN_CHANGED", from: "growth", to: "pro" },
    })).toMatchObject({
      title: "Plan upgraded to Pro",
      description: "The subscription changed from Growth to Pro.",
      actorName: "Abdul Wasay",
      category: "billing",
    })
  })

  it("formats finalized onboarding counts but hides assistant-turn noise", () => {
    expect(formatActivityEvent({ action: "onboarding.finalized", metadata: { services: 10, faqs: 1, guardrails: 4 } })).toMatchObject({
      title: "Knowledge base setup completed",
      description: "10 services, 1 FAQ, and 4 safety rules were saved.",
    })
    expect(isCustomerFacingActivity({ action: "onboarding.setup_assistant_turn", metadata: {} })).toBe(false)
    expect(isCustomerFacingActivity({ action: "debug token_usage=120", metadata: {} })).toBe(false)
  })

  it("uses System and safe copy when event details are missing", () => {
    expect(formatActivityEvent({})).toMatchObject({ title: "Account activity", description: "An account update was recorded.", actorName: "System" })
  })

  it("uses wrapping layout without fixed activity-row heights", () => {
    const source = readFileSync(join(process.cwd(), "src/components/dashboard/recent-activity-feed.tsx"), "utf8")
    expect(source).toContain("min-w-0")
    expect(source).toContain("break-words")
    expect(source).not.toContain("absolute")
    expect(source).toContain("We couldn&apos;t load recent activity")
    expect(source).toContain("No recent business activity yet.")
  })
})
