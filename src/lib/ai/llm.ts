import { kbAwareFallback } from "./fallback"
import { loadKnowledge } from "./retrieval"

export type ChatRole = "system" | "user" | "assistant" | "tool"

export type ChatMessage = {
  role: ChatRole
  content: string
  name?: string
}

export type LlmOptions = {
  model?: string
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  timeoutMs?: number
}

export type LlmChatInput = {
  messages: ChatMessage[]
  responseFormat?: { type: "json_object" | "text" }
  options?: LlmOptions
}

export type LlmChatResult = {
  content: string
  model: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  provider: "cloudflare" | "mock"
}

export type LlmProvider = "cloudflare" | "mock"

// Koi API token nahi hai to yeh wrong hoga — but Cloudflare pe account ID fix hai
const CLOUDFLARE_ACCOUNT_ID = "0c5413cf333f59befff997713951733a"
const CLOUDFLARE_API_BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/v1`
const DEFAULT_CLOUDFLARE_MODEL = "@cf/meta/llama-3.2-3b-instruct"
const DEFAULT_MOCK_MODEL = "aiva-mock-1"
// Tight per-request timeouts: chat UX must feel snappy. The LLM usually
// finishes in ~1-3s on fast models; GLM-5.2 with CoT can take 8-15s,
// so we use a conservative budget before falling back to the canned reply.
const DEFAULT_REQUEST_TIMEOUT_MS = 20_000
const FALLBACK_TIMEOUT_MS = 15_000
const FALLBACK_MODEL = "@cf/meta/llama-3.2-3b-instruct"

export function resolveLlmProvider(): LlmProvider {
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (token && token.trim().length > 0) {
    return "cloudflare"
  }
  return "mock"
}

function getCloudflareConfig() {
  return {
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    baseUrl: CLOUDFLARE_API_BASE,
    model: process.env.CLOUDFLARE_MODEL || DEFAULT_CLOUDFLARE_MODEL,
  }
}

export async function llmChat(input: LlmChatInput): Promise<LlmChatResult> {
  const provider = resolveLlmProvider()
  if (provider === "cloudflare") {
    try {
      const result = await callCloudflareWithFallback(input)
      if (!result.content || !result.content.trim()) {
        console.warn("LLM returned empty content, serving canned reply")
        return gracefulFallback(input)
      }
      return result
    } catch (err) {
      // NEVER throw. If anything goes wrong (timeout, network, 4xx, 5xx,
      // auth, parse), serve a graceful canned reply so the visitor always
      // gets a usable answer. The widget never breaks.
      console.warn(
        `LLM call failed (${err instanceof Error ? err.message : "unknown"}), serving canned reply`,
      )
      return gracefulFallback(input)
    }
  }
  return callMock(input)
}

function gracefulFallback(input: LlmChatInput): Promise<LlmChatResult> {
  const last = [...input.messages].reverse().find((m) => m.role === "user")
  const userText = (last?.content || "").trim()

  // Greetings — warm opener, no lead-capture, no treatment push.
  // Short-circuited so we never answer a greeting with a service
  // recommendation or a refusal.
  if (
    /^(hi|hey|hello|hola|howdy|yo|good\s+(morning|afternoon|evening|night))[\s.!?]*$/i.test(
      userText,
    )
  ) {
    const openers = [
      "Hi there! What brings you in today?",
      "Hey — glad you stopped by. Anything specific you're thinking about, or just looking around?",
      "Hello! Are you here about a treatment, or just kicking the tires?",
    ]
    return Promise.resolve({
      content: openers[Math.floor(Math.random() * openers.length)] as string,
      model: "aiva-fallback",
      provider: "mock",
    })
  }

  if (/^(thanks|thank you|thx|ty)\b/i.test(userText)) {
    return Promise.resolve({
      content: "Anytime! Let me know if anything else comes up.",
      model: "aiva-fallback",
      provider: "mock",
    })
  }

  // Everything else: hand off to the KB-aware fallback so the actual
  // question is addressed — a relevant KB entry, a polite refusal, or
  // a service-anchored clarification. Synchronous against the cached KB,
  // so the reply lands instantly instead of a generic canned opener.
  // `loadKnowledge` has a 60s in-memory cache so this is cheap.
  return loadKnowledge()
    .then((kb) => ({
      content: kbAwareFallback(userText, kb),
      model: "aiva-fallback",
      provider: "mock" as const,
    }))
    .catch(() => ({
      content: "Happy to help — what would you like to know more about?",
      model: "aiva-fallback",
      provider: "mock" as const,
    }))
}

async function callCloudflareWithFallback(input: LlmChatInput): Promise<LlmChatResult> {
  const cfg = getCloudflareConfig()
  if (!cfg.apiToken) throw new Error("CLOUDFLARE_API_TOKEN is not set")

  const requestedModel = input.options?.model || cfg.model
  const timeoutMs = input.options?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS

  try {
    return await callCloudflare(input, requestedModel, timeoutMs)
  } catch (err) {
    const isTimeout = err instanceof Error && /aborted|timeout/i.test(err.message)
    if (!isTimeout || requestedModel === FALLBACK_MODEL) {
      throw err
    }
    console.warn(
      `LLM call to ${requestedModel} failed (${err instanceof Error ? err.message : "unknown"}), retrying with ${FALLBACK_MODEL}`,
    )
    return callCloudflare(
      { ...input, options: { ...input.options, signal: undefined } },
      FALLBACK_MODEL,
      FALLBACK_TIMEOUT_MS,
    )
  }
}

async function callCloudflare(
  input: LlmChatInput,
  modelName: string,
  timeoutMs: number,
): Promise<LlmChatResult> {
  const cfg = getCloudflareConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const signal = input.options?.signal ?? controller.signal

  const body: Record<string, unknown> = {
    model: modelName,
    messages: input.messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.name ? { name: m.name } : {}),
    })),
    temperature: input.options?.temperature ?? 0.4,
    max_tokens: input.options?.maxTokens ?? 2000,
  }
  if (input.responseFormat) body.response_format = input.responseFormat

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.apiToken}`,
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!res.ok) {
      const err = await res.text().catch(() => "")
      throw new Error(`Cloudflare API request failed (${res.status}): ${err.slice(0, 200)}`)
    }

    const data = (await res.json()) as {
      result?: {
        response?: string
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      }
      choices?: { message?: { content?: string; reasoning_content?: string } }[]
      model?: string
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }

    // Cloudflare Workers AI can return in three shapes:
    // 1. OpenAI-compatible { choices: [{ message: { content } }] }
    // 2. Native Workers AI { result: { response } }
    // 3. GLM-5.2 style { choices: [{ message: { content, reasoning_content } }] }
    let content = ""
    if (data.choices?.[0]?.message?.content) {
      content = data.choices[0].message.content
    } else if (data.choices?.[0]?.message?.reasoning_content) {
      content = data.choices[0].message.reasoning_content
    } else if (data.result?.response) {
      content = data.result.response
    }
    return {
      content,
      model: data.model || modelName,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
          }
        : undefined,
      provider: "cloudflare",
    }
  } finally {
    clearTimeout(timeout)
  }
}

function callMock(input: LlmChatInput): Promise<LlmChatResult> {
  const last = [...input.messages].reverse().find((m) => m.role === "user")
  const userText = (last?.content || "").trim()

  if (
    /^(hi|hey|hello|hola|howdy|yo|good\s+(morning|afternoon|evening|night))[\s.!?]*$/i.test(
      userText,
    )
  ) {
    const openers = [
      "Hi there! What brings you in today?",
      "Hey — glad you stopped by. Anything specific you're thinking about, or just looking around?",
      "Hello! Are you here about a treatment, or just kicking the tires?",
      "Hi! What's on your mind today?",
    ]
    return Promise.resolve({
      content: openers[Math.floor(Math.random() * openers.length)] as string,
      model: DEFAULT_MOCK_MODEL,
      provider: "mock",
    })
  }

  if (/^(thanks|thank you|thx|ty)\b/i.test(userText)) {
    return Promise.resolve({
      content: "Anytime! Let me know if anything else comes up.",
      model: DEFAULT_MOCK_MODEL,
      provider: "mock",
    })
  }

  if (/(who are you|are you (a |an )?(bot|ai|human|real)|your name)/i.test(userText)) {
    return Promise.resolve({
      content:
        "I'm AivaSpa — the front-desk person here. I help with treatment questions and booking consults. What brings you in today?",
      model: DEFAULT_MOCK_MODEL,
      provider: "mock",
    })
  }

  // Everything else: route through the KB-aware fallback. This guarantees
  // that even when `CLOUDFLARE_API_TOKEN` is empty (so `callMock` is the entire
  // engine) the visitor gets a relevant answer from the spa's knowledge
  // base — or a polite, KB-grounded refusal if the question is off-topic.
  return loadKnowledge()
    .then((kb) => ({
      content: kbAwareFallback(userText, kb),
      model: DEFAULT_MOCK_MODEL,
      provider: "mock" as const,
    }))
    .catch(() => ({
      content: "Happy to help — what would you like to know more about?",
      model: DEFAULT_MOCK_MODEL,
      provider: "mock" as const,
    }))
}

// ----------------------------------------------------------------------------
// Streaming
// ----------------------------------------------------------------------------
// `streamLlmChat` mirrors `llmChat` but yields incremental text chunks from the
// upstream OpenAI-compatible endpoint (server-sent events). The widget renders
// chunks as they arrive so visitors see the reply start forming within ~1s
// instead of waiting the full LLM latency.

export type StreamOptions = Omit<LlmOptions, "maxTokens"> & {
  maxTokens?: number
}

export type StreamEvent =
  | { type: "chunk"; text: string }
  | { type: "done"; model: string; provider: "cloudflare" | "mock" }
  | { type: "error"; message: string }

export type LlmStreamHandle = AsyncIterable<StreamEvent>

export async function* streamLlmChat(input: LlmChatInput): LlmStreamHandle {
  const cfg = getCloudflareConfig()
  const provider = resolveLlmProvider()
  const modelName = input.options?.model || cfg.model
  const timeoutMs = input.options?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS

  if (provider !== "cloudflare" || !cfg.apiToken) {
    const r = callMock(input)
    const text = (await r).content
    yield { type: "chunk", text }
    yield { type: "done", model: (await r).model, provider: "mock" }
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const signal = input.options?.signal ?? controller.signal

  let res: Response
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.apiToken}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: input.messages.map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.name ? { name: m.name } : {}),
        })),
        temperature: input.options?.temperature ?? 0.4,
        max_tokens: input.options?.maxTokens ?? 800,
        stream: true,
      }),
      signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    yield {
      type: "error",
      message: err instanceof Error ? err.message : "network error",
    }
    return
  }

  if (!res.ok || !res.body) {
    clearTimeout(timeout)
    const errText = await res.text().catch(() => "")
    yield {
      type: "error",
      message: `Cloudflare stream failed (${res.status}): ${errText.slice(0, 200)}`,
    }
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  let sawAnyChunk = false

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })

      let idx: number
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trimEnd()
        buf = buf.slice(idx + 1)
        if (!line.startsWith("data:")) continue
        const data = line.slice(5).trim()
        if (!data || data === "[DONE]") continue
        try {
          const json = JSON.parse(data) as {
            choices?: { delta?: { content?: string } }[]
          }
          const chunk = json.choices?.[0]?.delta?.content
          if (chunk) {
            sawAnyChunk = true
            yield { type: "chunk", text: chunk }
          }
        } catch {
          // ignore malformed SSE lines
        }
      }
    }
  } catch (err) {
    clearTimeout(timeout)
    yield {
      type: "error",
      message: err instanceof Error ? err.message : "stream read error",
    }
    return
  } finally {
    clearTimeout(timeout)
  }

  if (!sawAnyChunk) {
    yield { type: "error", message: "empty stream" }
    return
  }
  yield { type: "done", model: modelName, provider: "cloudflare" }
}
