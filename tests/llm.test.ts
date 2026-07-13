import { afterEach, describe, expect, it, vi } from "vitest"

import { llmChat, resolveLlmProvider, streamLlmChat } from "@/lib/ai/llm"

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
  vi.unstubAllGlobals()
})

describe("Nara LLM client", () => {
  it("uses the configured Nara endpoint and Mistral model", async () => {
    process.env.NARA_API_KEY = "test-nara-key"
    delete process.env.NARA_API_BASE_URL
    delete process.env.NARA_MODEL
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "mistral-medium-3-5",
          choices: [{ message: { content: "Hello from Nara" } }],
          usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await llmChat({ messages: [{ role: "user", content: "Hello" }] })

    expect(resolveLlmProvider()).toBe("nara")
    expect(result).toMatchObject({
      content: "Hello from Nara",
      model: "mistral-medium-3-5",
      provider: "nara",
      usage: { promptTokens: 4, completionTokens: 3, totalTokens: 7 },
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://router.bynara.id/v1/chat/completions")
    expect(init.headers).toMatchObject({ authorization: "Bearer test-nara-key" })
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "mistral-medium-3-5" })
  })

  it("throws instead of using canned responses when strict AI mode has no key", async () => {
    delete process.env.NARA_API_KEY

    await expect(
      llmChat({
        messages: [{ role: "user", content: "Hello" }],
        failureMode: "throw",
      }),
    ).rejects.toThrow(/NARA_API_KEY is not configured/)
  })

  it("normalizes full-line and quoted Vercel environment values", async () => {
    const pastedBlock = [
      'NARA_API_KEY="\u200Btest-nara-key"',
      "NARA_API_BASE_URL=https://router.bynara.id/v1/",
      "NARA_MODEL='mistral-medium-3-5'",
    ].join("\n")
    process.env.NARA_API_KEY = pastedBlock
    process.env.NARA_API_BASE_URL = pastedBlock
    process.env.NARA_MODEL = pastedBlock
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    await llmChat({ messages: [{ role: "user", content: "Hello" }] })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://router.bynara.id/v1/chat/completions")
    expect(init.headers).toMatchObject({ authorization: "Bearer test-nara-key" })
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "mistral-medium-3-5" })
  })

  it("propagates Nara failures in strict AI mode", async () => {
    process.env.NARA_API_KEY = "test-nara-key"
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("upstream failed", { status: 503 })))

    await expect(
      llmChat({
        messages: [{ role: "user", content: "Hello" }],
        failureMode: "throw",
      }),
    ).rejects.toThrow(/Nara API request failed \(503\)/)
  })

  it("streams responses through Nara with the same model", async () => {
    process.env.NARA_API_KEY = "test-nara-key"
    delete process.env.NARA_API_BASE_URL
    delete process.env.NARA_MODEL
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n'))
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n"))
        controller.close()
      },
    })
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const events = []
    for await (const event of streamLlmChat({
      messages: [{ role: "user", content: "Hello" }],
    })) {
      events.push(event)
    }

    expect(events).toEqual([
      { type: "chunk", text: "Hi" },
      { type: "done", model: "mistral-medium-3-5", provider: "nara" },
    ])
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "mistral-medium-3-5",
      stream: true,
    })
  })
})