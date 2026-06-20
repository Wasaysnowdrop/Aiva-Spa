import { llmChat, streamLlmChat, type ChatMessage } from "./llm"
import { buildSystemPrompt } from "./prompt"
import { loadKnowledge, invalidateKnowledgeCache } from "./retrieval"
import { isAfterHours } from "./working-hours"
import { detectHumanGreeting } from "./greetings"
import { kbAwareFallback } from "./fallback"
import type { KnowledgeBundle } from "./retrieval"
import {
  buildLanguageDirective,
  isSupportedLanguage,
  type LanguageCode,
} from "@/lib/i18n"
import type {
  Lead,
  TranscriptMessage,
  WorkingHours,
} from "@/lib/supabase/types"

export type ConversationTurnInput = {
  sessionId: string
  message: string
  history?: { role: "visitor" | "user" | "assistant" | "ai"; content: string }[]
  spaId?: string
  language?: LanguageCode | null
}

export type ConversationTurnResult = {
  reply: string
  model: string
  provider: "openai" | "mock" | "deterministic"
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
  const kb = await loadKnowledge()
  const history = mapHistory(input.history)
  const isFirstReply = !input.history || input.history.length === 0
  const afterHours = isAfterHours(kb.widget.workingHours)

  const greeting = detectHumanGreeting(input.message, {
    isFirstReply,
    afterHours,
  })
  if (greeting.matched) {
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

  const result = await llmChat({ messages, options: { temperature: 0.4, maxTokens: 240, timeoutMs: 12_000 } })

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

export function appendTurnToTranscript(
  transcript: TranscriptMessage[],
  role: "visitor" | "ai",
  content: string,
): TranscriptMessage[] {
  const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  return [
    ...transcript,
    {
      id,
      role,
      content,
      timestamp: new Date().toISOString(),
    },
  ]
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

function applyThinkStrippingIncremental(
  pending: string,
  inThink: boolean,
): { emit: string; inThink: boolean; remaining: string } {
  const THINK_OPEN = "think>"
  const THINK_OPEN_FULL = "<" + THINK_OPEN
  const THINK_CLOSE = "think>"
  const THINK_CLOSE_FULL = "</" + THINK_CLOSE

  let buf = pending
  let think = inThink
  let emit = ""

  while (buf.length > 0) {
    if (think) {
      const closeIdx = buf.indexOf(THINK_CLOSE_FULL)
      if (closeIdx === -1) {
        // hold back a possible prefix of the close tag
        const keep = Math.min(buf.length, THINK_CLOSE_FULL.length - 1)
        buf = buf.slice(buf.length - keep)
        break
      }
      think = false
      buf = buf.slice(closeIdx + THINK_CLOSE_FULL.length)
    } else {
      const openIdx = buf.indexOf(THINK_OPEN_FULL)
      if (openIdx === -1) {
        // hold back a possible prefix of the open tag
        const keep = Math.min(buf.length, THINK_OPEN_FULL.length - 1)
        const safe = buf.slice(0, buf.length - keep)
        emit += safe
        buf = buf.slice(buf.length - keep)
        break
      }
      if (openIdx > 0) {
        emit += buf.slice(0, openIdx)
      }
      think = true
      buf = buf.slice(openIdx + THINK_OPEN_FULL.length)
    }
  }

  return { emit, inThink: think, remaining: buf }
}

export async function streamConversationTurn(
  input: StreamConversationInput,
): Promise<ConversationTurnResult> {
  const start = Date.now()
  const kb = await loadKnowledge()
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
  let providerName: "openai" | "mock" | "deterministic" = "openai"
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
      options: { temperature: 0.4, maxTokens: 240, timeoutMs: 12_000 },
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
// down or `OPENAI_API_KEY` is empty the visitor gets a relevant answer —
// or a polite, grounded refusal if the question is clearly out of scope.
// All this runs synchronously against the cached KB (60s TTL), so the reply
// is delivered instantly with no model latency.
function gracefulCannedReply(
  messages: ChatMessage[],
  kb: KnowledgeBundle,
): string {
  const last = [...messages].reverse().find((m) => m.role === "user")
  const userText = (last?.content || "").trim()

  if (/^(hi|hey|hello|hola|howdy|yo|good\s+(morning|afternoon|evening|night))[\s.!?]*$/i.test(userText)) {
    return "Hi there! What brings you in today?"
  }
  if (/^(thanks|thank you|thx|ty)\b/i.test(userText)) {
    return "Anytime! Let me know if anything else comes up."
  }

  // Hand off to the KB-aware fallback so the actual question is always
  // addressed (not replaced with a generic opener).
  return kbAwareFallback(userText, kb)
}

export function buildSummaryForStaff(lead: Lead): string {
  const lines: string[] = [
    `New consultation request from ${lead.name}.`,
    `Service interest: ${lead.service}.`,
    `Preferred time: ${lead.preferredTime}.`,
  ]
  if (lead.phone) lines.push(`Phone: ${lead.phone}`)
  if (lead.email) lines.push(`Email: ${lead.email}`)
  if (lead.sourceUrl) lines.push(`Source: ${lead.sourceUrl}`)
  if (lead.afterHours) lines.push("Captured after hours.")
  return lines.join("\n")
}

export { invalidateKnowledgeCache, loadKnowledge }
export type { KnowledgeBundle, WorkingHours }
