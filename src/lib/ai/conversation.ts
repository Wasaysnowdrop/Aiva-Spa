import { llmChat, type ChatMessage } from "./llm"
import { buildSystemPrompt } from "./prompt"
import { loadKnowledge, invalidateKnowledgeCache } from "./retrieval"
import { isAfterHours } from "./working-hours"
import { detectHumanGreeting } from "./greetings"
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
  disclaimerShown: boolean
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
      disclaimerShown: false,
      durationMs: Date.now() - start,
      retrievedIds: [],
      greetingMatched: greeting.reason,
    }
  }

  const { system, retrieved } = buildSystemPrompt(kb, input.message, {
    includeDisclaimer: true,
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

  const result = await llmChat({ messages, options: { temperature: 0.4, maxTokens: 240 } })

  return {
    reply: result.content,
    model: result.model,
    provider: result.provider,
    isFirstReply,
    afterHours,
    disclaimerShown: isFirstReply,
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
