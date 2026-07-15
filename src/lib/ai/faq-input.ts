import { z } from "zod"

import type { KnowledgeBaseFaq } from "./setup-assistant-schema"

const MEANINGLESS_FAQ_VALUES = new Set([
  "yes", "no", "ok", "okay", "skip", "none", "idk", "i don't know", "i dont know", "not sure",
])

const faqExtractionItemSchema = z.object({
  question: z.string().trim().min(5).max(500),
  answer: z.string().trim().min(3).max(2000),
  category: z.enum(["General", "Pricing", "Booking", "Safety", "Hours"]).optional().default("General"),
})

/** Strict boundary for optional AI extraction. Deterministic parsing remains authoritative. */
export const faqExtractionResponseSchema = z.object({
  isValid: z.boolean(),
  faqs: z.array(faqExtractionItemSchema).max(50).default([]),
  originalText: z.string().max(2000).optional().default(""),
})

export type FaqValidationReason =
  | "EMPTY"
  | "MEANINGLESS"
  | "PUNCTUATION_ONLY"
  | "UNPARSEABLE"
  | "QUESTION_TOO_SHORT"
  | "ANSWER_TOO_SHORT"

export type FaqValidationResult = {
  valid: boolean
  cleaned: string
  faqs: KnowledgeBaseFaq[]
  reason?: FaqValidationReason
}

export function normalizeFaqInput(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/[ \t]+/g, " "))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function cleanQuestion(value: string): string {
  return value
    .replace(/^[-*\u2022\s]*(?:\d+[.)]\s*)?(?:faq\s*\d*\s*[:.\-]?\s*)?(?:(?:question|q)\s*[:\-]\s*)?/i, "")
    .trim()
    .slice(0, 500)
}

function cleanAnswer(value: string): string {
  return value
    .replace(/^[-*\u2022\s]*(?:(?:approved\s+)?answer|a)\s*[:\-]\s*/i, "")
    .trim()
    .slice(0, 2000)
}

function comparable(value: string): string {
  return value.toLocaleLowerCase().replace(/[.!?,;:]+$/g, "").trim()
}

function meaningful(value: string, minimum: number): boolean {
  const cleaned = value.trim()
  return cleaned.length >= minimum && /[\p{L}]/u.test(cleaned) && !MEANINGLESS_FAQ_VALUES.has(comparable(cleaned))
}

function makeFaq(
  question: string,
  answer: string,
  category: KnowledgeBaseFaq["category"] = "General",
): KnowledgeBaseFaq | null {
  const cleanedQuestion = cleanQuestion(question)
  const cleanedAnswer = cleanAnswer(answer)
  if (!meaningful(cleanedQuestion, 5) || !meaningful(cleanedAnswer, 3)) return null
  return { question: cleanedQuestion, answer: cleanedAnswer, category }
}

function fromJson(input: string): KnowledgeBaseFaq[] | null {
  if (!/^\s*[\[{]/.test(input)) return null
  try {
    const parsed = JSON.parse(input) as unknown
    const items = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { faqs?: unknown }).faqs)
        ? (parsed as { faqs: unknown[] }).faqs
        : [parsed]
    const faqs = items.flatMap((item) => {
      if (!item || typeof item !== "object") return []
      const record = item as Record<string, unknown>
      const question = typeof record.question === "string" ? record.question : typeof record.q === "string" ? record.q : ""
      const answer = typeof record.answer === "string" ? record.answer : typeof record.a === "string" ? record.a : ""
      const category = faqExtractionItemSchema.shape.category.safeParse(record.category)
      const faq = makeFaq(question, answer, category.success ? category.data : "General")
      return faq ? [faq] : []
    })
    return faqs
  } catch {
    return []
  }
}

function extractLabeledPairs(input: string): KnowledgeBaseFaq[] {
  const faqs: KnowledgeBaseFaq[] = []
  const pattern = /(?:^|[\n;])\s*[-*\u2022\s]*(?:\d+[.)]\s*)?(?:faq\s*\d*\s*[:.\-]?\s*)?(?:question|q)\s*[:\-]\s*(.+?)\s*(?:\n|;)\s*(?:(?:approved\s+)?answer|a)\s*[:\-]\s*([\s\S]*?)(?=(?:\n{2,}|[\n;])\s*[-*\u2022\s]*(?:\d+[.)]\s*)?(?:faq\s*\d*\s*[:.\-]?\s*)?(?:question|q)\s*[:\-]|$)/gim
  for (const match of input.matchAll(pattern)) {
    const faq = makeFaq(match[1], match[2])
    if (faq) faqs.push(faq)
  }
  return faqs
}

function extractLoosePairs(input: string): KnowledgeBaseFaq[] {
  const separated = input
    .replace(/;\s*(?=(?:[-*\u2022]\s*|\d+[.)]\s*)?(?:faq\b|(?:question|q)\s*[:\-]))/gi, "\n\n")
    .replace(/;\s*(?=(?:[-*\u2022]\s*|\d+[.)]\s*)?(?:faq\b|(?:question|q)\b|[^;\n?]{3,}\?))/gi, "\n\n")
    .replace(/\n(?=\s*(?:[-*\u2022]\s*|\d+[.)]\s*)(?:faq\b|(?:question|q)\b|[^\n?]{3,}\?))/gi, "\n\n")
  const blocks = separated.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
  const faqs: KnowledgeBaseFaq[] = []

  for (const rawBlock of blocks) {
    const block = rawBlock.replace(/^[-*\u2022\s]*(?:\d+[.)]\s*)?(?:faq\s*\d*\s*[:.\-]?\s*)?/i, "").trim()
    const pipe = block.match(/^(.+?)\s*\|\s*([\s\S]+)$/)
    if (pipe) {
      const faq = makeFaq(pipe[1], pipe[2])
      if (faq) faqs.push(faq)
      continue
    }

    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean)
    if (lines.length >= 2) {
      const faq = makeFaq(lines[0], lines.slice(1).join(" "))
      if (faq) faqs.push(faq)
      continue
    }

    const questionEnd = block.indexOf("?")
    if (questionEnd >= 0) {
      const faq = makeFaq(block.slice(0, questionEnd + 1), block.slice(questionEnd + 1))
      if (faq) faqs.push(faq)
    }
  }
  return faqs
}

function dedupeFaqs(faqs: KnowledgeBaseFaq[]): KnowledgeBaseFaq[] {
  const byQuestion = new Map<string, KnowledgeBaseFaq>()
  for (const faq of faqs) {
    const key = faq.question.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
    if (key) byQuestion.set(key, faq)
  }
  return [...byQuestion.values()].slice(0, 50)
}

export function parseFaqInput(input: string): KnowledgeBaseFaq[] {
  const normalized = normalizeFaqInput(input)
  const jsonFaqs = fromJson(normalized)
  if (jsonFaqs !== null) return dedupeFaqs(jsonFaqs)
  const labeled = extractLabeledPairs(normalized)
  if (labeled.length > 0) return dedupeFaqs(labeled)
  return dedupeFaqs(extractLoosePairs(normalized))
}

export function validateFaqInput(input: string): FaqValidationResult {
  const cleaned = normalizeFaqInput(input)
  if (!cleaned) return { valid: false, cleaned, faqs: [], reason: "EMPTY" }
  if (MEANINGLESS_FAQ_VALUES.has(comparable(cleaned))) {
    return { valid: false, cleaned, faqs: [], reason: "MEANINGLESS" }
  }
  if (!/[\p{L}]/u.test(cleaned)) return { valid: false, cleaned, faqs: [], reason: "PUNCTUATION_ONLY" }
  const faqs = parseFaqInput(cleaned)
  if (faqs.length === 0) return { valid: false, cleaned, faqs, reason: "UNPARSEABLE" }
  return { valid: true, cleaned, faqs }
}

export function faqInputHash(input: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

export function logFaqDevelopment(label: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") console.info(label, details)
}
