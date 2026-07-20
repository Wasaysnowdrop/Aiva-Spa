import { kbAwareFallback } from "./fallback"
import { loadKnowledge, type KnowledgeBundle } from "./retrieval"
import { recordAiUsage, type AiUsageContext } from "./usage"

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
  fallbackKnowledge?: KnowledgeBundle
  failureMode?: "fallback" | "throw"
  options?: LlmOptions
  usageContext?: AiUsageContext
}

export type LlmChatResult = {
  content: string
  model: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  provider: "nara" | "mock"
}

export type LlmProvider = "nara" | "mock"

const DEFAULT_NARA_API_BASE_URL = "https://router.bynara.id/v1"
const DEFAULT_NARA_MODEL = "mistral-medium-3-5"
const DEFAULT_MOCK_MODEL = "aiva-mock-1"
// Tight per-request timeouts: chat UX must feel snappy. The LLM usually
// finishes in ~1-3s on fast models; GLM-5.2 with CoT can take 8-15s,
// so we use a conservative budget before falling back to the canned reply.
const DEFAULT_REQUEST_TIMEOUT_MS = 20_000

export function resolveLlmProvider(): LlmProvider {
  const token = readNaraEnv("NARA_API_KEY")
  if (token && token.trim().length > 0) {
    return "nara"
  }
  return "mock"
}

function readNaraEnv(name: "NARA_API_KEY" | "NARA_API_BASE_URL" | "NARA_MODEL"): string {
  let value = (process.env[name] ?? "").replace(/\r\n?/g, "\n").trim()
  const unwrap = () => {
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1).trim()
    }
  }

  unwrap()
  const assignment = value.match(new RegExp(`(?:^|\\n)\\s*${name}\\s*=\\s*([^\\n]+)`, "i"))
  if (assignment?.[1]) {
    value = assignment[1].trim()
  } else {
    value = value.replace(new RegExp(`^${name}\\s*=\\s*`, "i"), "").trim()
  }
  unwrap()
  value = value.replace(/[\u200B-\u200D\uFEFF]/g, "").trim()
  return name === "NARA_API_KEY" ? value.replace(/\s+/g, "") : value
}

function getNaraConfig() {
  return {
    apiKey: readNaraEnv("NARA_API_KEY"),
    baseUrl: (readNaraEnv("NARA_API_BASE_URL") || DEFAULT_NARA_API_BASE_URL).replace(/\/$/, ""),
    model: readNaraEnv("NARA_MODEL") || DEFAULT_NARA_MODEL,
  }
}

export async function llmChat(input: LlmChatInput): Promise<LlmChatResult> {
  const startedAt = Date.now()
  const requestId = crypto.randomUUID()
  const promptText = input.messages.map((message) => message.content).join("\n")
  const provider = resolveLlmProvider()
  if (provider === "nara") {
    try {
      const result = await callNara(input)
      if (!result.content || !result.content.trim()) {
        if (input.failureMode === "throw") throw new Error("LLM returned empty content")
        console.warn("LLM returned empty content, serving canned reply")
        const fallback = await gracefulFallback(input)
        await recordAiUsage({ requestId, context: input.usageContext, provider: "nara", model: result.model, promptText, completionText: fallback.content, usage: result.usage, latencyMs: Date.now() - startedAt, status: "fallback", errorCode: "empty_response" })
        return fallback
      }
      await recordAiUsage({ requestId, context: input.usageContext, provider: result.provider, model: result.model, promptText, completionText: result.content, usage: result.usage, latencyMs: Date.now() - startedAt, status: "success" })
      return result
    } catch (err) {
      if (input.failureMode === "throw") {
        await recordAiUsage({ requestId, context: input.usageContext, provider: "nara", model: input.options?.model ?? "unknown", promptText, completionText: "", latencyMs: Date.now() - startedAt, status: "error", errorCode: err instanceof Error ? err.name : "provider_error" })
        throw err
      }
      // Widget chat remains resilient when the upstream provider is unavailable.
      console.warn(
        `LLM call failed (${err instanceof Error ? err.message : "unknown"}), serving canned reply`,
      )
      const fallback = await gracefulFallback(input)
      await recordAiUsage({ requestId, context: input.usageContext, provider: "nara", model: fallback.model, promptText, completionText: fallback.content, latencyMs: Date.now() - startedAt, status: "fallback", errorCode: err instanceof Error ? err.name : "provider_error" })
      return fallback
    }
  }
  if (input.failureMode === "throw") {
    throw new Error("NARA_API_KEY is not configured")
  }
  const fallback = await callMock(input)
  await recordAiUsage({ requestId, context: input.usageContext, provider: fallback.provider, model: fallback.model, promptText, completionText: fallback.content, latencyMs: Date.now() - startedAt, status: "fallback", errorCode: "provider_not_configured" })
  return fallback
}
function loadFallbackKnowledge(input: LlmChatInput): Promise<KnowledgeBundle> {
  return input.fallbackKnowledge
    ? Promise.resolve(input.fallbackKnowledge)
    : loadKnowledge()
}

function gracefulFallback(input: LlmChatInput): Promise<LlmChatResult> {
  const last = [...input.messages].reverse().find((m) => m.role === "user")
  const userText = (last?.content || "").trim()

  // Greetings — warm opener, no lead-capture, no treatment push.
  // Short-circuited so we never answer a greeting with a service
  // recommendation or a refusal.
  const PURE_GREETING =
    /^(hi|hey|hello|hola|howdy|yo|good\s+(morning|afternoon|evening|night))[\s.!?]*$/i
  if (PURE_GREETING.test(userText)) {
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

  // Greeting + more content — "Hi, what services do you offer?"
  // The pure-greeting regex above requires the entire message to be only the
  // greeting. These messages START with a greeting, so we route through
  // kbAwareFallback but prefix with a warm greeting so it never feels robotic.
  const GREETING_LEAD =
    /^(hi|hey|hello|hola|howdy|yo|good\s+(morning|afternoon|evening|night))[\s.!?,\-;:)][\s\S]/i
  if (GREETING_LEAD.test(userText)) {
    return loadFallbackKnowledge(input)
      .then((kb) => ({
        content: `Hey! ${kbAwareFallback(userText, kb)}`,
        model: "aiva-fallback",
        provider: "mock" as const,
      }))
      .catch(() => ({
        content: "Hey! What can I help you with today?",
        model: "aiva-fallback",
        provider: "mock" as const,
      }))
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
  return loadFallbackKnowledge(input)
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



async function callNara(input: LlmChatInput): Promise<LlmChatResult> {
  const cfg = getNaraConfig()
  if (!cfg.apiKey) throw new Error("NARA_API_KEY is not set")
  const modelName = input.options?.model || cfg.model
  const timeoutMs = input.options?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
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
        authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!res.ok) {
      const err = await res.text().catch(() => "")
      throw new Error(`Nara API request failed (${res.status}): ${err.slice(0, 200)}`)
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

    // Nara returns the standard OpenAI-compatible response shape:
    // { choices: [{ message: { content } }] }
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
      provider: "nara",
    }
  } finally {
    clearTimeout(timeout)
  }
}

function callMock(input: LlmChatInput): Promise<LlmChatResult> {
  const last = [...input.messages].reverse().find((m) => m.role === "user")
  const userText = (last?.content || "").trim()

  const PURE_GREETING =
    /^(hi|hey|hello|hola|howdy|yo|good\s+(morning|afternoon|evening|night))[\s.!?]*$/i
  if (PURE_GREETING.test(userText)) {
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

  // Greeting + more content — "Hi, what services do you offer?"
  const GREETING_LEAD =
    /^(hi|hey|hello|hola|howdy|yo|good\s+(morning|afternoon|evening|night))[\s.!?,\-;:)][\s\S]/i
  if (GREETING_LEAD.test(userText)) {
    return loadFallbackKnowledge(input)
      .then((kb) => ({
        content: `Hey! ${kbAwareFallback(userText, kb)}`,
        model: DEFAULT_MOCK_MODEL,
        provider: "mock" as const,
      }))
      .catch(() => ({
        content: "Hey! What can I help you with today?",
        model: DEFAULT_MOCK_MODEL,
        provider: "mock" as const,
      }))
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
  // that even when `NARA_API_KEY` is empty (so `callMock` is the entire
  // engine) the visitor gets a relevant answer from the spa's knowledge
  // base — or a polite, KB-grounded refusal if the question is off-topic.
  return loadFallbackKnowledge(input)
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
  | { type: "done"; model: string; provider: "nara" | "mock" }
  | { type: "error"; message: string }

export type LlmStreamHandle = AsyncIterable<StreamEvent>

export async function* streamLlmChat(input: LlmChatInput): LlmStreamHandle {
  const startedAt = Date.now()
  const requestId = crypto.randomUUID()
  const promptText = input.messages.map((message) => message.content).join("\n")
  const cfg = getNaraConfig()
  const provider = resolveLlmProvider()
  const modelName = input.options?.model || cfg.model
  const timeoutMs = input.options?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS

  if (provider !== "nara" || !cfg.apiKey) {
    const result = await callMock(input)
    await recordAiUsage({ requestId, context: input.usageContext, provider: result.provider, model: result.model, promptText, completionText: result.content, latencyMs: Date.now() - startedAt, status: "fallback", errorCode: "provider_not_configured" })
    yield { type: "chunk", text: result.content }
    yield { type: "done", model: result.model, provider: "mock" }
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const signal = input.options?.signal ?? controller.signal
  let res: Response
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: modelName,
        messages: input.messages.map((message) => ({ role: message.role, content: message.content, ...(message.name ? { name: message.name } : {}) })),
        temperature: input.options?.temperature ?? 0.4,
        max_tokens: input.options?.maxTokens ?? 800,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal,
    })
  } catch (error) {
    clearTimeout(timeout)
    const message = error instanceof Error ? error.message : "network error"
    await recordAiUsage({ requestId, context: input.usageContext, provider: "nara", model: modelName, promptText, completionText: "", latencyMs: Date.now() - startedAt, status: "error", errorCode: error instanceof Error ? error.name : "network_error" })
    yield { type: "error", message }
    return
  }

  if (!res.ok || !res.body) {
    clearTimeout(timeout)
    const errText = await res.text().catch(() => "")
    await recordAiUsage({ requestId, context: input.usageContext, provider: "nara", model: modelName, promptText, completionText: "", latencyMs: Date.now() - startedAt, status: "error", errorCode: `http_${res.status}` })
    yield { type: "error", message: `Nara stream failed (${res.status}): ${errText.slice(0, 200)}` }
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  let completionText = ""
  let sawAnyChunk = false
  let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined
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
          const json = JSON.parse(data) as { choices?: { delta?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }
          if (json.usage) usage = { promptTokens: json.usage.prompt_tokens ?? 0, completionTokens: json.usage.completion_tokens ?? 0, totalTokens: json.usage.total_tokens ?? 0 }
          const chunk = json.choices?.[0]?.delta?.content
          if (chunk) { sawAnyChunk = true; completionText += chunk; yield { type: "chunk", text: chunk } }
        } catch { /* ignore malformed provider chunks */ }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "stream read error"
    await recordAiUsage({ requestId, context: input.usageContext, provider: "nara", model: modelName, promptText, completionText, usage, latencyMs: Date.now() - startedAt, status: "error", errorCode: error instanceof Error ? error.name : "stream_error" })
    yield { type: "error", message }
    return
  } finally {
    clearTimeout(timeout)
  }

  if (!sawAnyChunk) {
    await recordAiUsage({ requestId, context: input.usageContext, provider: "nara", model: modelName, promptText, completionText: "", usage, latencyMs: Date.now() - startedAt, status: "error", errorCode: "empty_stream" })
    yield { type: "error", message: "empty stream" }
    return
  }
  await recordAiUsage({ requestId, context: input.usageContext, provider: "nara", model: modelName, promptText, completionText, usage, latencyMs: Date.now() - startedAt, status: "success" })
  yield { type: "done", model: modelName, provider: "nara" }
}
