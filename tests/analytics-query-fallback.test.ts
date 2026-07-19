import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }))

import { getAnalyticsResult } from "@/lib/analytics/server"

type QueryResponse = {
  data: unknown[] | null
  error: { code: string; message: string; details?: string; hint?: string } | null
}

function queryBuilder(response: QueryResponse, filters: unknown[][]) {
  const builder: Record<string, unknown> = {}
  for (const method of ["select", "eq", "is", "gte", "lt"]) {
    builder[method] = (...args: unknown[]) => {
      filters.push([method, ...args])
      return builder
    }
  }
  builder.then = (resolve: (value: QueryResponse) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(response).then(resolve, reject)
  return builder
}

describe("analytics query recovery", () => {
  const filtersByTable = new Map<string, unknown[][]>()

  beforeEach(() => {
    filtersByTable.clear()
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    createClientMock.mockReset()
  })

  function mockTables(responses: Record<string, QueryResponse>) {
    createClientMock.mockResolvedValue({
      from(table: string) {
        const filters: unknown[][] = []
        filtersByTable.set(table, filters)
        return queryBuilder(responses[table], filters)
      },
    })
  }

  it("loads a full valid response using the canonical Email enum label", async () => {
    const createdAt = new Date(Date.now() - 60_000).toISOString()
    mockTables({
      chat_sessions: {
        data: [{
          id: "session-1",
          lead_id: "lead-1",
          lead_captured: true,
          source_url: "https://example.com/page",
          transcript: [
            { role: "visitor", content: "Book Botox", timestamp: createdAt },
            { role: "ai", content: "Happy to help", timestamp: new Date(Date.now() - 58_000).toISOString() },
          ],
          created_at: createdAt,
        }],
        error: null,
      },
      leads: {
        data: [{ id: "lead-1", status: "booked", service: "Botox", source_url: "https://example.com/page", created_at: createdAt }],
        error: null,
      },
      notification_logs: {
        data: [{ status: "delivered", sent_at: createdAt }],
        error: null,
      },
    })

    const result = await getAnalyticsResult("30d", "UTC")

    expect(result.error).toBeNull()
    expect(result.payload.summary).toMatchObject({
      visitorConversations: 1,
      qualifiedLeads: 1,
      bookedLeads: 1,
      notificationDeliveryRate: 100,
    })
    expect(filtersByTable.get("notification_logs")).toContainEqual(["eq", "channel", "Email"])
  })

  it("returns a safe payload instead of throwing when a query fails", async () => {
    mockTables({
      chat_sessions: { data: [], error: null },
      leads: { data: [], error: null },
      notification_logs: {
        data: null,
        error: {
          code: "22P02",
          message: 'invalid input value for enum notification_channel: "email"',
          details: "",
          hint: "",
        },
      },
    })

    const result = await getAnalyticsResult("30d", "UTC")

    expect(result.error).toMatchObject({
      stage: "query",
      queryName: "notification_logs",
      code: "22P02",
    })
    expect(result.payload.summary.visitorConversations).toBe(0)
    expect(result.payload.timeline).toEqual([])
    expect(console.error).toHaveBeenCalledWith("ANALYTICS_QUERY_FAILED", expect.objectContaining({ code: "22P02" }))
  })

  it("handles a production schema or migration mismatch as a controlled failure", async () => {
    mockTables({
      chat_sessions: {
        data: null,
        error: { code: "42703", message: "column chat_sessions.is_billable does not exist" },
      },
      leads: { data: [], error: null },
      notification_logs: { data: [], error: null },
    })

    const result = await getAnalyticsResult("7d", "UTC")

    expect(result.error).toMatchObject({
      stage: "query",
      queryName: "chat_sessions",
      code: "42703",
    })
    expect(result.payload.range.key).toBe("7d")
    expect(result.payload.timeline).toEqual([])
  })

  it("renders a safe empty result with a missing timezone and no visitor data", async () => {
    mockTables({
      chat_sessions: { data: [], error: null },
      leads: { data: [], error: null },
      notification_logs: { data: [], error: null },
    })

    const result = await getAnalyticsResult("not-valid", "")

    expect(result.error).toBeNull()
    expect(result.payload.range.key).toBe("30d")
    expect(result.payload.range.timezone).toBe("America/Los_Angeles")
    expect(result.payload.summary.visitorConversations).toBe(0)
  })
})
