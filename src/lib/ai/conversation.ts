import { llmChat, streamLlmChat, type ChatMessage } from "./llm"
import { buildSystemPrompt } from "./prompt"
import { loadKnowledge, invalidateKnowledgeCache } from "./retrieval"
import { isAfterHours } from "./working-hours"
import { detectHumanGreeting } from "./greetings"
import { isUnknownServiceQuestion, kbAwareFallback } from "./fallback"
import type { KnowledgeBundle } from "./retrieval"
import {
  buildLanguageDirective,
  isSupportedLanguage,
  type LanguageCode,
} from "@/lib/i18n"
import type {
  WorkingHours,
} from "@/lib/supabase/types"

export type ConversationTurnInput = {
  sessionId: string
  message: string
  history?: { role: "visitor" | "user" | "assistant" | "ai"; content: string }[]
  spaId?: string
  userId?: string
  language?: LanguageCode | null
}

export type ConversationTurnResult = {
  reply: string
  model: string
  provider: "nara" | "mock" | "deterministic"
  isFirstReply: boolean
  afterHours: boolean
  durationMs: number
  retrievedIds: string[]
  greetingMatched?: "pure_greeting" | "small_talk" | "thanks"
}

function mapHistory(
  history: { role: "visitor" | "user" | "assistant" | "ai"; content: string }[] | undefined,
): { role: "user" | "assistant"; content: string }[] {
  if (!history) return []
  return history.map((m) => ({
    role: m.role === "visitor" || m.role === "user" ? "user" : "assistant",
    content: m.content,
  }))
}

export async function runConversationTurn(
  input: ConversationTurnInput,
): Promise<ConversationTurnResult> {
  const start = Date.now()
  console.log("[chat] runConversationTurn: incoming message", {
    sessionId: input.sessionId,
    messageLength: input.message?.length ?? 0,
    historyLength: input.history?.length ?? 0,
  })
  const kb = await loadKnowledge(input.userId)
  console.log("[chat] Knowledge Base loaded", {
    services: kb.services.length,
    faqs: kb.faqs.length,
    guardrails: kb.guardrails.length,
    brand: kb.widget.brandName,
  })
  const history = mapHistory(input.history)
  const isFirstReply = !input.history || input.history.length === 0
  const afterHours = isAfterHours(kb.widget.workingHours)

  const greeting = detectHumanGreeting(input.message, {
    isFirstReply,
    afterHours,
  })
  if (greeting.matched) {
    console.log("[chat] greeting matched, returning deterministic reply", {
      reason: greeting.reason,
    })
    return {
      reply: greeting.reply,
      model: "aiva-greeting",
      provider: "deterministic",
      isFirstReply,
      afterHours,
      durationMs: Date.now() - start,
      retrievedIds: [],
      greetingMatched: greeting.reason,
    }
  }

  const { system, retrieved } = buildSystemPrompt(kb, input.message)
  if (retrieved.length === 0 && isUnknownServiceQuestion(input.message)) {
    return {
      reply: kbAwareFallback(input.message, kb),
      model: "aiva-kb-guard",
      provider: "deterministic",
      isFirstReply,
      afterHours,
      durationMs: Date.now() - start,
      retrievedIds: [],
    }
  }
  console.log("[chat] Prompt generated", {
    systemLength: system.length,
    retrievedCount: retrieved.length,
  })
  const languageDirective =
    input.language && isSupportedLanguage(input.language)
      ? buildLanguageDirective(input.language)
      : ""
  const finalSystem = system + languageDirective

  const messages: ChatMessage[] = [
    { role: "system", content: finalSystem },
    ...history,
    { role: "user", content: input.message },
  ]

  console.log("[chat] Sending request to AI", {
    messageCount: messages.length,
    temperature: 0.7,
  })
  const result = await llmChat({
    messages,
    fallbackKnowledge: kb,
    usageContext: { businessId: input.userId, purpose: "visitor_chat" },
    options: { temperature: 0.7, maxTokens: 800, timeoutMs: 20_000 },
  })
  console.log("[chat] AI response received", {
    model: result.model,
    provider: result.provider,
    contentLength: result.content?.length ?? 0,
    durationMs: Date.now() - start,
  })

  if (!result.content || !result.content.trim()) {
    console.warn("[chat] AI returned blank content, applying safe fallback")
  }

  return {
    reply: result.content,
    model: result.model,
    provider: result.provider,
    isFirstReply,
    afterHours,
    durationMs: Date.now() - start,
    retrievedIds: retrieved.map((r) =>
      r.kind === "service" ? r.service.id : r.faq.id,
    ),
  }
}

// ----------------------------------------------------------------------------
// Streaming variant
// ----------------------------------------------------------------------------
// Yields the LLM reply in real time via `onChunk` while still returning the
// same `ConversationTurnResult` shape that the JSON path uses. Internally:
//   - loads KB once (cached for 60s),
//   - resolves greetings deterministically (no LLM hit),
//   - streams chunks from the OpenAI-compatible endpoint while stripping
//     `think` blocks incrementally so visitors never see the model's
//     chain-of-thought.
// If the stream errors mid-flight we still emit a graceful canned fallback so
// the visitor always gets a usable reply.

export type StreamConversationInput = ConversationTurnInput & {
  onChunk: (visibleText: string) => void
}

// ----------------------------------------------------------------------------
// Streaming variant
// ----------------------------------------------------------------------------
// Yields the LLM reply in real time via `onChunk` while still returning the
// same `ConversationTurnResult` shape that the JSON path uses. Internally:
//   - loads KB once (cached for 60s),
//   - resolves greetings deterministically (no LLM hit),
//   - streams chunks from the OpenAI-compatible endpoint while stripping
//     `think` blocks incrementally so visitors never see the model's
//     chain-of-thought.
// If the stream errors mid-flight we still emit a graceful canned fallback so
// the visitor always gets a usable reply.

function applyThinkStrippingIncremental(
  pending: string,
  inThink: boolean,
): { emit: string; inThink: boolean; remaining: string } {
  // Some OpenAI-compatible gateways emit the model's chain-of-thought
  // wrapped in HTML-encoded tags inside the JSON string value —
  // `&lt;think&gt;` / `&lt;/think&gt;` instead of the literal `<think>` /
  // `</think>`. The downstream JSON parser gives us the raw string back
  // (HTML entities are NOT unescaped by JSON), so we have to recognize
  // both shapes here.
  const THINK_OPEN_LITERAL = "<think>"
  const THINK_CLOSE_LITERAL = "</think>"
  const THINK_OPEN_ENCODED = "&lt;think&gt;"
  const THINK_CLOSE_ENCODED = "&lt;/think&gt;"

  let buf = pending
  let think = inThink
  let emit = ""

  const indexOfAnyOpen = (s: string): number => {
    const a = s.indexOf(THINK_OPEN_LITERAL)
    const b = s.indexOf(THINK_OPEN_ENCODED)
    if (a === -1) return b
    if (b === -1) return a
    return Math.min(a, b)
  }
  const indexOfAnyClose = (s: string): number => {
    const a = s.indexOf(THINK_CLOSE_LITERAL)
    const b = s.indexOf(THINK_CLOSE_ENCODED)
    if (a === -1) return b
    if (b === -1) return a
    return Math.min(a, b)
  }
  // Use the longer of the two tag shapes as the "hold back" window so we
  // never split a tag across chunk boundaries.
  const OPEN_TAG_LEN = Math.max(THINK_OPEN_LITERAL.length, THINK_OPEN_ENCODED.length)
  const CLOSE_TAG_LEN = Math.max(
    THINK_CLOSE_LITERAL.length,
    THINK_CLOSE_ENCODED.length,
  )

  while (buf.length > 0) {
    if (think) {
      const closeIdx = indexOfAnyClose(buf)
      if (closeIdx === -1) {
        // Hold back a possible prefix of the close tag.
        const keep = Math.min(buf.length, CLOSE_TAG_LEN - 1)
        buf = buf.slice(buf.length - keep)
        break
      }
      think = false
      buf = buf.slice(closeIdx + CLOSE_TAG_LEN)
    } else {
      const openIdx = indexOfAnyOpen(buf)
      if (openIdx === -1) {
        // Hold back a possible prefix of the open tag.
        const keep = Math.min(buf.length, OPEN_TAG_LEN - 1)
        const safe = buf.slice(0, buf.length - keep)
        emit += safe
        buf = buf.slice(buf.length - keep)
        break
      }
      if (openIdx > 0) {
        emit += buf.slice(0, openIdx)
      }
      think = true
      buf = buf.slice(openIdx + OPEN_TAG_LEN)
    }
  }

  return { emit, inThink: think, remaining: buf }
}

export async function streamConversationTurn(
  input: StreamConversationInput,
): Promise<ConversationTurnResult> {
  const start = Date.now()
  const kb = await loadKnowledge(input.userId)
  const history = mapHistory(input.history)
  const isFirstReply = !input.history || input.history.length === 0
  const afterHours = isAfterHours(kb.widget.workingHours)

  const greeting = detectHumanGreeting(input.message, {
    isFirstReply,
    afterHours,
  })
  if (greeting.matched) {
    input.onChunk(greeting.reply)
    return {
      reply: greeting.reply,
      model: "aiva-greeting",
      provider: "deterministic",
      isFirstReply,
      afterHours,
      durationMs: Date.now() - start,
      retrievedIds: [],
      greetingMatched: greeting.reason,
    }
  }

  const { system, retrieved } = buildSystemPrompt(kb, input.message)
  if (retrieved.length === 0 && isUnknownServiceQuestion(input.message)) {
    const reply = kbAwareFallback(input.message, kb)
    input.onChunk(reply)
    return {
      reply,
      model: "aiva-kb-guard",
      provider: "deterministic",
      isFirstReply,
      afterHours,
      durationMs: Date.now() - start,
      retrievedIds: [],
    }
  }
  const languageDirective =
    input.language && isSupportedLanguage(input.language)
      ? buildLanguageDirective(input.language)
      : ""
  const finalSystem = system + languageDirective

  const messages: ChatMessage[] = [
    { role: "system", content: finalSystem },
    ...history,
    { role: "user", content: input.message },
  ]

  let fullText = ""
  let pending = ""
  let inThink = false
  let modelName = "unknown"
  let providerName: "nara" | "mock" | "deterministic" = "nara"
  let streamed = false
  let fallbackInjected = false

  const flushPending = () => {
    const { emit, inThink: nextThink, remaining } = applyThinkStrippingIncremental(
      pending,
      inThink,
    )
    inThink = nextThink
    pending = remaining
    if (emit) {
      fullText += emit
      input.onChunk(emit)
      streamed = true
    }
  }

  try {
    for await (const ev of streamLlmChat({
      messages,
      fallbackKnowledge: kb,
      usageContext: { businessId: input.userId, purpose: "visitor_chat" },
      options: { temperature: 0.7, maxTokens: 800, timeoutMs: 20_000 },
    })) {
      if (ev.type === "chunk") {
        pending += ev.text
        flushPending()
      } else if (ev.type === "done") {
        modelName = ev.model
        providerName = ev.provider
      } else if (ev.type === "error") {
        throw new Error(ev.message)
      }
    }
  } catch (err) {
    console.warn(
      `[conversation] LLM stream failed (${err instanceof Error ? err.message : "unknown"}), serving canned fallback`,
    )
    const fb = gracefulCannedReply(messages, kb)
    if (streamed && fullText.trim().length > 0) {
      // Mid-stream failure: append fallback as a continuation so the visitor
      // still gets a complete-looking reply.
      const tail = " " + fb
      fullText += tail
      input.onChunk(tail)
    } else {
      // Nothing usable streamed: replace with the canned reply.
      const delta = fb.slice(fullText.length)
      if (delta) {
        fullText = fb
        input.onChunk(delta)
        streamed = true
      }
    }
    fallbackInjected = true
    providerName = "mock"
    modelName = "aiva-fallback"
  }

  // Flush any leftover text outside an unterminated think block.
  if (!inThink && pending.length > 0) {
    fullText += pending
    input.onChunk(pending)
    streamed = true
    pending = ""
  }

  if (!streamed || !fullText.trim()) {
    const fb = gracefulCannedReply(messages, kb)
    const delta = fb.slice(fullText.length)
    if (delta) {
      fullText += delta
      input.onChunk(delta)
    }
    fallbackInjected = true
    providerName = "mock"
    modelName = "aiva-fallback"
  }

  if (fallbackInjected && fullText.trim().length > 0) {
    // Strip any leftover think tag fragments.
    fullText = fullText.replace(/<\/?think[^>]*>/gi, "").trimStart()
  }

  return {
    reply: fullText,
    model: modelName,
    provider: providerName,
    isFirstReply,
    afterHours,
    durationMs: Date.now() - start,
    retrievedIds: retrieved.map((r) =>
      r.kind === "service" ? r.service.id : r.faq.id,
    ),
  }
}

// Deterministic canned reply used when the LLM is unavailable. KB-aware:
// looks up the visitor's actual message against the spa's services + FAQs
// (using the same retrieval the LLM would use), so even when the model is
// down or `NARA_API_KEY` is empty the visitor gets a relevant answer —
// or a polite, grounded refusal if the question is clearly out of scope.
// All this runs synchronously against the cached KB (60s TTL), so the reply
// is delivered instantly with no model latency.
function gracefulCannedReply(
  messages: ChatMessage[],
  kb: KnowledgeBundle,
): string {
  const last = [...messages].reverse().find((m) => m.role === "user")
  const userText = (last?.content || "").trim()

  const PURE_GREETING =
    /^(hi|hey|hello|hola|howdy|yo|good\s+(morning|afternoon|evening|night))[\s.!?]*$/i
  if (PURE_GREETING.test(userText)) {
    return "Hi there! What brings you in today?"
  }

  // Messages starting with a greeting but continuing with content.
  const GREETING_LEAD =
    /^(hi|hey|hello|hola|howdy|yo|good\s+(morning|afternoon|evening|night))[\s.!?,\-;:)][\s\S]/i
  if (GREETING_LEAD.test(userText)) {
    return "Hey! " + kbAwareFallback(userText, kb)
  }

  if (/^(thanks|thank you|thx|ty)\b/i.test(userText)) {
    return "Anytime! Let me know if anything else comes up."
  }

  // Hand off to the KB-aware fallback so the actual question is always
  // addressed (not replaced with a generic opener).
  return kbAwareFallback(userText, kb)
}

export { invalidateKnowledgeCache, loadKnowledge }
export type { KnowledgeBundle, WorkingHours }
