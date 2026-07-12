import { beforeEach, describe, expect, it, vi } from "vitest"

import { installSupabaseMocks } from "./helpers/mock-supabase"

describe("tenant-scoped KB loading", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("filters by owner and removes duplicate services, FAQs, and guardrails", async () => {
    const { admin } = installSupabaseMocks()
    admin.setResult("knowledge_services", "select", {
      data: [
        { id: "s1", user_id: "owner-1", name: "Botox", category: "Injectables", description: "Approved", pricing_rule: "Consultation", duration: "", active: true },
        { id: "s2", user_id: "owner-1", name: " botox ", category: "Injectables", description: "Duplicate", pricing_rule: "Consultation", duration: "", active: true },
      ],
      error: null,
    })
    admin.setResult("knowledge_faqs", "select", {
      data: [
        { id: "f1", user_id: "owner-1", question: "How do I book?", answer: "Request a consult", category: "Booking" },
        { id: "f2", user_id: "owner-1", question: " HOW DO I BOOK? ", answer: "Duplicate", category: "Booking" },
      ],
      error: null,
    })
    admin.setResult("knowledge_guardrails", "select", {
      data: [
        { id: "g1", user_id: "owner-1", title: "No medical advice", body: "Defer to provider", description: "Defer to provider", enabled: true, is_active: true, rule_type: "medical" },
        { id: "g2", user_id: "owner-1", title: "No medical advice", body: "Defer to provider", description: "Defer to provider", enabled: true, is_active: true, rule_type: "medical" },
      ],
      error: null,
    })
    admin.setResult("widget_config", "select", { data: null, error: null })

    const { loadKnowledge, invalidateKnowledgeCache } = await import("@/lib/ai/retrieval")
    invalidateKnowledgeCache()
    const kb = await loadKnowledge("owner-1")

    expect(kb.services).toHaveLength(1)
    expect(kb.faqs).toHaveLength(1)
    expect(kb.guardrails).toHaveLength(1)
    for (const table of ["knowledge_services", "knowledge_faqs", "knowledge_guardrails"]) {
      expect(admin.callsFor(table, "eq")).toContainEqual({
        table,
        op: "eq",
        args: ["user_id", "owner-1"],
      })
    }
  })
})