import { beforeEach, describe, expect, it, vi } from "vitest"

import { installSupabaseMocks } from "./helpers/mock-supabase"

describe("knowledge-base dashboard loading", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("validates fetched rows and returns a safe partial snapshot", async () => {
    const { server, admin } = installSupabaseMocks()
    server.setAuthUser({ id: "workspace-kb-1", email: "owner@example.com" })
    admin.setResult("knowledge_services", "select", {
      data: [{ id: "service-1", user_id: "workspace-kb-1", name: "Botox", category: "Injectables" }],
      error: null,
    })
    admin.setResult("knowledge_faqs", "select", {
      data: { id: "not-an-array" },
      error: null,
    })
    admin.setResult("knowledge_guardrails", "select", {
      data: null,
      error: { message: "temporary database error", code: "XX000" },
    })
    vi.spyOn(console, "info").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})

    const { loadKnowledgeBaseAction } = await import("@/app/actions/knowledge-load")
    const result = await loadKnowledgeBaseAction()

    expect(result.status).toBe("partial")
    expect(result.services).toHaveLength(1)
    expect(result.services[0]).toMatchObject({ id: "service-1", name: "Botox", category: "Injectables" })
    expect(result.faqs).toEqual([])
    expect(result.guardrails).toEqual([])
    expect(result.issues).toEqual(["knowledge_guardrails", "knowledge_faqs"])
  })

  it("returns a stable empty snapshot for an unauthenticated request", async () => {
    const { server } = installSupabaseMocks()
    server.setAuthUser(null)
    vi.spyOn(console, "warn").mockImplementation(() => {})

    const { loadKnowledgeBaseAction } = await import("@/app/actions/knowledge-load")
    const result = await loadKnowledgeBaseAction()

    expect(result).toMatchObject({
      status: "unauthenticated",
      services: [],
      faqs: [],
      guardrails: [],
    })
  })
})