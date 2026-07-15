import { z } from "zod"

import type { KnowledgeBase } from "./setup-assistant-schema"

const MEANINGLESS_TONE_VALUES = new Set([
  "yes",
  "no",
  "ok",
  "okay",
  "skip",
  "none",
  "i don't know",
  "i dont know",
  "not sure",
])

export const toneExtractionResponseSchema = z.object({
  isValid: z.boolean(),
  toneSummary: z.string().trim().min(3).max(500),
  toneRaw: z.string().trim().min(3).max(500),
  avoid: z.array(z.string().trim().min(2).max(120)).max(20).default([]),
  prefer: z.array(z.string().trim().min(2).max(120)).max(20).default([]),
})

export type ToneValidationResult = {
  valid: boolean
  cleaned: string
  reason?: "EMPTY" | "TOO_SHORT" | "MEANINGLESS" | "PUNCTUATION_ONLY"
}

export function normalizeToneInput(input: string): string {
  return input.replace(/\r\n?/g, "\n").replace(/\s+/g, " ").trim()
}

export function validateToneInput(input: string): ToneValidationResult {
  const cleaned = normalizeToneInput(input)
  if (!cleaned) return { valid: false, cleaned, reason: "EMPTY" }
  if (cleaned.length < 3) return { valid: false, cleaned, reason: "TOO_SHORT" }
  if (!/[\p{L}]/u.test(cleaned)) {
    return { valid: false, cleaned, reason: "PUNCTUATION_ONLY" }
  }
  const comparable = cleaned.toLocaleLowerCase().replace(/[.!?,;:]+$/g, "").trim()
  if (MEANINGLESS_TONE_VALUES.has(comparable)) {
    return { valid: false, cleaned, reason: "MEANINGLESS" }
  }
  return { valid: true, cleaned }
}

function inferTone(cleaned: string): NonNullable<KnowledgeBase["brand_voice"]>["tone"] {
  if (/\bluxur(?:y|ious)\b/i.test(cleaned)) return "luxury"
  if (/\bplayful\b/i.test(cleaned)) return "playful"
  if (/\bcasual\b/i.test(cleaned)) return "casual"
  if (/\bformal\b/i.test(cleaned)) return "formal"
  return "warm"
}

function collectAvoidPhrases(cleaned: string): string[] {
  const avoid = new Set<string>()
  if (/\bmedical claims?\b/i.test(cleaned)) avoid.add("medical claims")
  if (/\b(?:never\s+)?pressure(?:\s+(?:visitors?|clients?|patients?))?|pressure tactics?\b/i.test(cleaned)) {
    avoid.add("pressure tactics")
  }
  if (/\bguarantee(?:d|s)?\b/i.test(cleaned)) avoid.add("guaranteed outcomes")
  if (/\bdiagnos(?:e|es|is|ing)\b/i.test(cleaned)) avoid.add("diagnosis")
  return [...avoid]
}

function collectPreferPhrases(cleaned: string): string[] {
  const prefer = new Set<string>()
  if (/\bclear\b/i.test(cleaned) && /\bconcise\b/i.test(cleaned)) {
    prefer.add("clear and concise")
  }
  if (/\b(?:guide|encourage)\b[\s\S]*\bconsultation\b/i.test(cleaned)) {
    prefer.add("guide visitors toward booking a consultation")
  }
  return [...prefer]
}

export function parseToneInput(
  input: string,
  existing?: KnowledgeBase["brand_voice"],
): NonNullable<KnowledgeBase["brand_voice"]> | null {
  const validation = validateToneInput(input)
  if (!validation.valid) return null
  const cleaned = validation.cleaned.slice(0, 500)
  return {
    tone: inferTone(cleaned),
    customTone: cleaned,
    greeting: existing?.greeting?.trim()
      || "Hi! Are you looking to book a consultation or ask about a treatment?",
    avoidPhrases: Array.from(new Set([
      ...(existing?.avoidPhrases ?? []),
      ...collectAvoidPhrases(cleaned),
    ])).slice(0, 20),
    preferPhrases: Array.from(new Set([
      ...(existing?.preferPhrases ?? []),
      ...collectPreferPhrases(cleaned),
    ])).slice(0, 20),
  }
}

export function toneInputHash(input: string): string {
  const normalized = normalizeToneInput(input).toLocaleLowerCase()
  let hash = 0x811c9dc5
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

export type ToneDevelopmentEvent =
  | "TONE_RAW_INPUT"
  | "TONE_VALIDATION_RESULT"
  | "TONE_ATTEMPT_INCREMENTED"
  | "TONE_SAVE_STARTED"
  | "TONE_SAVE_SUCCESS"
  | "TONE_SAVE_FAILED"
  | "TONE_AI_REQUEST_STARTED"
  | "TONE_AI_TIMEOUT"
  | "TONE_AI_RETRY"
  | "TONE_AI_SUCCESS"
  | "TONE_FALLBACK_APPLIED"
  | "TONE_STEP_COMPLETED"
  | "TONE_DUPLICATE_SUBMISSION_IGNORED"
  | "TONE_STALE_RESPONSE_IGNORED"

export function logToneDevelopment(label: ToneDevelopmentEvent, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") console.info(label, details)
}
