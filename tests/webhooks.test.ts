import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { isValidWebhookUrl, WEBHOOK_EVENTS } from "@/lib/webhooks/types"

const realFetch = globalThis.fetch

describe("webhook URL validation", () => {
  it("accepts public https URLs", () => {
    expect(isValidWebhookUrl("https://example.com/webhook")).toBe(true)
    expect(isValidWebhookUrl("https://api.acme.com/v1/hooks/leads")).toBe(true)
  })

  it("accepts public http URLs (e.g. self-hosted receivers)", () => {
    expect(isValidWebhookUrl("http://hooks.example.org/inbox")).toBe(true)
  })

  it("rejects localhost, loopback, and internal hosts", () => {
    expect(isValidWebhookUrl("http://localhost:3000/webhook")).toBe(false)
    expect(isValidWebhookUrl("http://127.0.0.1:8080/hook")).toBe(false)
    expect(isValidWebhookUrl("http://0.0.0.0/hook")).toBe(false)
    expect(isValidWebhookUrl("https://api.local/hook")).toBe(false)
    expect(isValidWebhookUrl("https://db.internal/hook")).toBe(false)
  })

  it("rejects non-http(s) protocols and invalid URLs", () => {
    expect(isValidWebhookUrl("ftp://example.com")).toBe(false)
    expect(isValidWebhookUrl("javascript:alert(1)")).toBe(false)
    expect(isValidWebhookUrl("not-a-url")).toBe(false)
    expect(isValidWebhookUrl("")).toBe(false)
  })
})

describe("WEBHOOK_EVENTS catalogue", () => {
  it("contains the documented event names", () => {
    const expected = [
      "lead.created",
      "lead.updated",
      "lead.merged",
      "lead.deleted",
      "conversation.started",
      "conversation.completed",
    ]
    for (const e of expected) {
      expect(WEBHOOK_EVENTS).toContain(e)
    }
  })
})

describe("HMAC sign + verify roundtrip", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it("signs and verifies a payload deterministically", async () => {
    const { signPayload, verifySignature } = await import("@/lib/webhooks")
    const secret = "whsec_test_super_secret"
    const body = JSON.stringify({ event: "lead.created", data: { id: "abc" } })
    const timestamp = "1700000000"
    const sig = signPayload(secret, body, timestamp)
    expect(sig).toMatch(/^[a-f0-9]{64}$/)
    expect(verifySignature(secret, body, timestamp, sig)).toBe(true)
  })

  it("rejects a tampered body", async () => {
    const { signPayload, verifySignature } = await import("@/lib/webhooks")
    const secret = "whsec_test_super_secret"
    const ts = "1700000000"
    const sig = signPayload(secret, "{}", ts)
    expect(verifySignature(secret, '{"x":1}', ts, sig)).toBe(false)
  })

  it("rejects a different secret", async () => {
    const { signPayload, verifySignature } = await import("@/lib/webhooks")
    const ts = "1700000000"
    const body = "abc"
    const sig = signPayload("whsec_a", body, ts)
    expect(verifySignature("whsec_b", body, ts, sig)).toBe(false)
  })

  it("returns false on length-mismatched signatures (no throws)", async () => {
    const { verifySignature } = await import("@/lib/webhooks")
    expect(verifySignature("x", "y", "1", "short")).toBe(false)
  })
})

describe("deliverToWebhook", () => {
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it("POSTs the JSON body with HMAC headers and returns ok on 2xx", async () => {
    const { deliverToWebhook, signPayload } = await import("@/lib/webhooks")
    const fetchMock = vi.fn(async () =>
      new Response("ok", { status: 200 }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await deliverToWebhook(
      {
        id: "wh_1",
        userId: "u_1",
        url: "https://example.com/hook",
        secret: "whsec_test",
        events: ["lead.created"],
        active: true,
        description: "",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
      "lead.created",
      { id: "lead_1" },
    )

    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const calledUrl = call[0]
    const calledInit = call[1]
    expect(calledUrl).toBe("https://example.com/hook")
    const headers = calledInit.headers as Record<string, string>
    expect(headers["X-AivaSpa-Event"]).toBe("lead.created")
    expect(headers["X-AivaSpa-Webhook-Id"]).toBe("wh_1")
    expect(headers["X-AivaSpa-Signature"]).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/)
    expect(headers["User-Agent"]).toContain("AivaSpa-Webhooks")
    const body = JSON.parse(calledInit.body as string)
    expect(body.event).toBe("lead.created")
    expect(body.data).toEqual({ id: "lead_1" })
    expect(typeof body.delivered_at).toBe("string")
    // Round-trip the signature to confirm it matches the body
    const m = headers["X-AivaSpa-Signature"].match(/^t=(\d+),v1=([a-f0-9]+)$/)
    expect(m).not.toBeNull()
    const expected = signPayload("whsec_test", calledInit.body as string, m![1])
    expect(expected).toBe(m![2])
  })

  it("returns ok=false on 4xx/5xx with the response status", async () => {
    const { deliverToWebhook } = await import("@/lib/webhooks")
    globalThis.fetch = (async () =>
      new Response("boom", { status: 502 })) as unknown as typeof fetch
    const result = await deliverToWebhook(
      {
        id: "wh_1",
        userId: "u_1",
        url: "https://example.com/hook",
        secret: "s",
        events: ["lead.created"],
        active: true,
        description: "",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
      "lead.created",
      {},
    )
    expect(result.ok).toBe(false)
    expect(result.status).toBe(502)
    expect(result.body).toBe("boom")
  })

  it("returns ok=false with an error on network failure", async () => {
    const { deliverToWebhook } = await import("@/lib/webhooks")
    globalThis.fetch = (async () => {
      throw new Error("connection refused")
    }) as unknown as typeof fetch
    const result = await deliverToWebhook(
      {
        id: "wh_1",
        userId: "u_1",
        url: "https://example.com/hook",
        secret: "s",
        events: ["lead.created"],
        active: true,
        description: "",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
      "lead.created",
      {},
    )
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/connection refused/)
  })
})

describe("fireEvent / fireEventForAll", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it("fireEvent delivers to every matching, active webhook for a user and logs the delivery", async () => {
    const { installSupabaseMocks } = await import("./helpers/mock-supabase")
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1", email: "owner@spa.com" })
    server.setResult("webhooks", "select", {
      data: [
        {
          id: "wh_a",
          user_id: "u_1",
          url: "https://a.example.com/h",
          secret: "sa",
          events: ["lead.created"],
          active: true,
          description: "",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "wh_b",
          user_id: "u_1",
          url: "https://b.example.com/h",
          secret: "sb",
          events: ["lead.created", "lead.updated"],
          active: true,
          description: "",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "wh_inactive",
          user_id: "u_1",
          url: "https://c.example.com/h",
          secret: "sc",
          events: ["lead.created"],
          active: false,
          description: "",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "wh_other_event",
          user_id: "u_1",
          url: "https://d.example.com/h",
          secret: "sd",
          events: ["lead.deleted"],
          active: true,
          description: "",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      error: null,
    })

    const fetchMock: ((
      input: string,
      init?: RequestInit,
    ) => Promise<Response>) & { mock: { calls: Array<[string, RequestInit]> } } =
      vi.fn(async () => new Response("", { status: 200 })) as never
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { fireEvent } = await import("@/lib/webhooks")
    await fireEvent("u_1", "lead.created", { id: "L1" })

    // Only wh_a and wh_b are active + subscribed to lead.created
    const urls = fetchMock.mock.calls.map((c) => c[0])
    expect(urls).toContain("https://a.example.com/h")
    expect(urls).toContain("https://b.example.com/h")
    expect(urls).not.toContain("https://c.example.com/h")
    expect(urls).not.toContain("https://d.example.com/h")
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // A delivery log row was written for each successful delivery
    const deliveryInserts = server
      .getCalls()
      .filter((c) => c.table === "webhook_deliveries" && c.op === "insert")
    expect(deliveryInserts.length).toBe(2)
  })

  it("logs a failed delivery when the endpoint returns 5xx", async () => {
    const { installSupabaseMocks } = await import("./helpers/mock-supabase")
    const { server } = installSupabaseMocks()
    server.setAuthUser({ id: "u_1" })
    server.setResult("webhooks", "select", {
      data: [
        {
          id: "wh_fail",
          user_id: "u_1",
          url: "https://fail.example.com/h",
          secret: "sf",
          events: ["lead.created"],
          active: true,
          description: "",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      error: null,
    })
    globalThis.fetch = (async () =>
      new Response("down", { status: 503 })) as unknown as typeof fetch

    const { fireEvent } = await import("@/lib/webhooks")
    await fireEvent("u_1", "lead.created", {})

    const deliveryInserts = server
      .getCalls()
      .filter((c) => c.table === "webhook_deliveries" && c.op === "insert")
    expect(deliveryInserts.length).toBe(1)
    const payload = deliveryInserts[0].args[0] as {
      success: boolean
      response_status: number
    }
    expect(payload.success).toBe(false)
    expect(payload.response_status).toBe(503)
  })
})

describe("generateWebhookSecret", () => {
  it("produces a whsec_-prefixed secret of 32 hex bytes", async () => {
    const { generateWebhookSecret } = await import("@/lib/webhooks")
    const s = generateWebhookSecret()
    expect(s).toMatch(/^whsec_[a-f0-9]{48}$/)
  })

  it("produces unique values across calls", async () => {
    const { generateWebhookSecret } = await import("@/lib/webhooks")
    const a = generateWebhookSecret()
    const b = generateWebhookSecret()
    expect(a).not.toBe(b)
  })
})
