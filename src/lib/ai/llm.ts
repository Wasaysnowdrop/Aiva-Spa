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
  provider: "openai" | "mock"
}

export type LlmProvider = "openai" | "mock"

const DEFAULT_OPENAI_BASE_URL = "https://api.tokenrouter.com/v1"
const DEFAULT_OPENAI_MODEL = "MiniMax-M3"
const DEFAULT_MOCK_MODEL = "aiva-mock-1"
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000
const FALLBACK_TIMEOUT_MS = 45_000
// Only one model exposed on the current TokenRouter key, so the "fallback" is
// the same model — we still retry with a fresh AbortController / shorter
// timeout to recover from transient gateway failures.
const FALLBACK_MODEL = "MiniMax-M3"

export function resolveLlmProvider(): LlmProvider {
  const key = process.env.OPENAI_API_KEY
  return key && key.trim().length > 0 ? "openai" : "mock"
}

function getOpenAiConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL,
    model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
  }
}

export async function llmChat(input: LlmChatInput): Promise<LlmChatResult> {
  const provider = resolveLlmProvider()
  if (provider === "openai") {
    try {
      const result = await callOpenAiWithFallback(input)
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

function gracefulFallback(input: LlmChatInput): LlmChatResult {
  const last = [...input.messages].reverse().find((m) => m.role === "user")
  const userText = (last?.content || "").toLowerCase().trim()

  const isFirstReply = input.messages.filter((m) => m.role === "user").length <= 1

  // Greetings — warm opener, no lead-capture, no treatment push
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
    return {
      content: openers[Math.floor(Math.random() * openers.length)] as string,
      model: "aiva-fallback",
      provider: "mock",
    }
  }

  if (/^(thanks|thank you|thx|ty)\b/i.test(userText)) {
    return {
      content: "Anytime! Let me know if anything else comes up.",
      model: "aiva-fallback",
      provider: "mock",
    }
  }

  // Real content
  let content =
    "Happy to help — what would you like to know more about?"
  if (/(\bhow much\b|\bwhat(?:'s| is) the price\b|\bcost\b|\bprice (for|of)\b)/i.test(userText)) {
    content =
      "Pricing depends on the treatment and what's right for you — that's why we confirm exact numbers during a consult. There's no hard number I can quote here, but the team can give you a real quote once they know which treatment and which area. Want to set one up?"
  } else if (/(book|appointment|consult|schedule)/.test(userText)) {
    content =
      "Happy to help you book. Could you share your name, phone, and the treatment you're interested in? Our team will confirm within 1 business hour."
  } else if (/(price|cost|how much)/.test(userText)) {
    content =
      "Pricing varies by treatment and individual needs — a licensed provider confirms exact pricing during your consultation. Want to book a free consult?"
  } else if (/(hour|open|close|when)/.test(userText)) {
    content =
      "Our typical hours are Tue–Fri 9 AM–7 PM, Sat 9 AM–5 PM, and Sun 11 AM–4 PM (closed Mon). I am here 24/7 and the team will follow up on any leads."
  } else if (/(who are you|are you (a |an )?(bot|ai|human|real)|your name)/i.test(userText)) {
    content =
      "I'm AivaSpa — the front-desk person here. I help with treatment questions and booking consults. What brings you in today?"
  } else if (isFirstReply) {
    content = "Hey — what can I help you with today?"
  }
  return { content, model: "aiva-fallback", provider: "mock" }
}

async function callOpenAiWithFallback(input: LlmChatInput): Promise<LlmChatResult> {
  const cfg = getOpenAiConfig()
  if (!cfg.apiKey) throw new Error("OPENAI_API_KEY is not set")

  const requestedModel = input.options?.model || cfg.model
  const timeoutMs = input.options?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS

  try {
    return await callOpenAi(input, requestedModel, timeoutMs)
  } catch (err) {
    const isTimeout = err instanceof Error && /aborted|timeout/i.test(err.message)
    if (!isTimeout || requestedModel === FALLBACK_MODEL) {
      throw err
    }
    // Primary model timed out — try the smaller fallback model for a faster
    // reply. Pass a fresh AbortSignal (the previous controller is already
    // aborted, which would cancel the retry) and a shorter timeout — the
    // small model should respond well under the primary budget.
    console.warn(
      `LLM call to ${requestedModel} failed (${err instanceof Error ? err.message : "unknown"}), retrying with ${FALLBACK_MODEL}`,
    )
    return callOpenAi(
      { ...input, options: { ...input.options, signal: undefined } },
      FALLBACK_MODEL,
      FALLBACK_TIMEOUT_MS,
    )
  }
}

async function callOpenAi(
  input: LlmChatInput,
  modelName: string,
  timeoutMs: number,
): Promise<LlmChatResult> {
  const cfg = getOpenAiConfig()
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
      throw new Error(`OpenAI request failed (${res.status}): ${err.slice(0, 200)}`)
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
      model?: string
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }

    const content = stripThinkBlocks(data.choices?.[0]?.message?.content ?? "")
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
      provider: "openai",
    }
  } finally {
    clearTimeout(timeout)
  }
}

// MiniMax-style models emit a hidden chain-of-thought inside
// `<think>...</think>` tags before the user-visible reply. Never show that to
// visitors — drop the block (and any leading whitespace) and return whatever
// remains, falling back to the original string if nothing is left.
function stripThinkBlocks(raw: string): string {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trimStart()
  return cleaned.length > 0 ? cleaned : raw.trim()
}

function callMock(input: LlmChatInput): Promise<LlmChatResult> {
  const last = [...input.messages].reverse().find((m) => m.role === "user")
  const userText = (last?.content || "").toLowerCase().trim()

  // Greetings
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

  const isFirstReply = input.messages.filter((m) => m.role === "user").length <= 1
  let reply =
    "Happy to help — what would you like to know more about?"

  if (/(book|appointment|consult|schedule|avail)/.test(userText)) {
    reply =
      "Great, I can help you book a consultation. Could you share your name, phone, email, and the treatment you're interested in? I'll pass it to the team and they'll confirm within 1 business hour."
  } else if (/(botox|filler|facial|laser|microneedl|coolsculpt|em sculpt|hydra)/.test(userText)) {
    reply =
      "Yes, we offer that treatment. Pricing depends on the units or area and is confirmed by a licensed provider during your consultation. Want me to set up a quick chat with our team?"
  } else if (/(price|cost|how much|expensive|cheap)/.test(userText)) {
    reply =
      "Pricing varies by treatment and individual needs — a licensed provider confirms exact pricing during your consultation. Would you like to book a free consult so we can give you an accurate quote?"
  } else if (/(hour|open|close|when|day)/.test(userText)) {
    reply =
      "Our typical hours are Tue–Fri 9 AM–7 PM, Sat 9 AM–5 PM, and Sun 11 AM–4 PM (closed Mon). I'm available 24/7 right here, and our team will follow up on any leads."
  } else if (isFirstReply) {
    const openers = [
      "Hey — what can I help you with today?",
      "Hi there! What's on your mind?",
      "Hello! What brings you in?",
    ]
    reply = openers[Math.floor(Math.random() * openers.length)] as string
  } else if (input.messages.length > 8) {
    reply =
      "I'd love to get you to the right person. Could I take your name, phone, and a quick note about what you're looking for? Our team will follow up shortly."
  }

  return Promise.resolve({
    content: reply,
    model: DEFAULT_MOCK_MODEL,
    provider: "mock",
  })
}
