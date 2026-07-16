import { z } from "zod"

import type { KnowledgeBaseService } from "./setup-assistant-schema"
import { normalizeServiceCategory } from "@/lib/kb/service-categories"

const MEANINGLESS_SERVICES_ANSWERS = new Set([
  "yes", "no", "ok", "okay", "skip", "none", "i don't know", "i dont know", "not sure",
])

const SERVICE_PREFIX = /^(?:(?:we|our (?:business|spa|clinic))\s+)?(?:offer|offers|provide|provides|specialize in|specializes in)\s+|^our services include\s+/i

const serviceExtractionItemSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    category: z.string().trim().max(80).catch("").optional().default(""),
    description: z.string().trim().max(500).optional().default(""),
  })
  .transform((service) => ({
    ...service,
    category: normalizeServiceCategory(service.category, service.name),
  }))

/** Schema kept at the AI boundary if service extraction is re-enabled later. */
export const servicesExtractionResponseSchema = z.object({
  isValid: z.boolean(),
  services: z.array(serviceExtractionItemSchema).max(100).default([]),
  originalText: z.string().max(2000).optional().default(""),
})

export type ServicesValidationResult = {
  valid: boolean
  cleaned: string
  reason?: "EMPTY" | "TOO_SHORT" | "MEANINGLESS" | "PUNCTUATION_ONLY"
}

export function normalizeServicesInput(input: string): string {
  return input.replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean).join("\n").replace(/[ \t]+/g, " ").trim()
}

function stripServicePrefix(value: string): string {
  let cleaned = value.trim()
  for (let pass = 0; pass < 2; pass += 1) cleaned = cleaned.replace(SERVICE_PREFIX, "").trim()
  return cleaned
}

export function validateServicesInput(input: string): ServicesValidationResult {
  const normalized = normalizeServicesInput(input)
  const cleaned = stripServicePrefix(normalized).replace(/[.!?]+$/g, "").trim()
  if (!cleaned) return { valid: false, cleaned, reason: "EMPTY" }
  if (cleaned.length < 3) return { valid: false, cleaned, reason: "TOO_SHORT" }
  const comparable = cleaned.toLowerCase().replace(/[?]/g, "'").replace(/[.!?,;:]+$/g, "").trim()
  if (MEANINGLESS_SERVICES_ANSWERS.has(comparable)) return { valid: false, cleaned, reason: "MEANINGLESS" }
  if (!/[\p{L}]/u.test(cleaned)) return { valid: false, cleaned, reason: "PUNCTUATION_ONLY" }
  return { valid: true, cleaned }
}

function inferCategory(name: string): KnowledgeBaseService["category"] {
  return normalizeServiceCategory(undefined, name)
}

function looksLikeKnownService(value: string): boolean {
  return /botox|filler|hydrafacial|facial|microneedl|chemical peel|laser|hair removal|prp|skin rejuven|acne treatment|consultation|inject|dysport|xeomin|sculptra|coolsculpt|emsculpt/i.test(value)
}

function cleanServicePart(value: string): string {
  return stripServicePrefix(value).replace(/^and\s+/i, "").replace(/^[-\u2013\u2014\u2022*\d.)\s]+/, "").replace(/^[,;:\s]+|[,;:.\s]+$/g, "").trim()
}

function splitConjunctionSafely(parts: string[], hadExplicitSeparator: boolean): string[] {
  const output: string[] = []
  for (const part of parts) {
    const segments = part.split(/\s*,?\s+and\s+/i).map(cleanServicePart).filter(Boolean)
    if (segments.length < 2) {
      output.push(part)
      continue
    }
    const confident = hadExplicitSeparator || segments.every(looksLikeKnownService)
    if (confident && segments[0].toLowerCase() !== "body") output.push(...segments)
    else output.push(part)
  }
  return output
}

export function parseServicesInput(input: string): KnowledgeBaseService[] {
  const validation = validateServicesInput(input)
  if (!validation.valid) return []
  const sentenceNormalized = validation.cleaned
    .replace(/\.\s+(?=(?:(?:we|our (?:business|spa|clinic))\s+)?(?:offer|provide)|our services include\b)/gi, "; ")
    .replace(/\n+/g, ";")
  const hadExplicitSeparator = /[,;\n]/.test(normalizeServicesInput(input))
  const parts = splitConjunctionSafely(sentenceNormalized.split(/\s*[,;]\s*/).filter(Boolean), hadExplicitSeparator)
  const services: KnowledgeBaseService[] = []
  const seen = new Set<string>()
  for (const rawPart of parts) {
    const part = cleanServicePart(rawPart)
    if (!part) continue
    const detailMatch = part.match(/^(.{2,120}?)\s+[-\u2013\u2014:]\s+(.+)$/)
    const name = cleanServicePart(detailMatch?.[1] ?? part).slice(0, 120)
    if (name.length < 2 || !/[\p{L}]/u.test(name)) continue
    const key = name.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    services.push({
      name,
      category: inferCategory(name),
      description: (detailMatch?.[2]?.trim() || "Details confirmed during consultation.").slice(0, 500),
      duration: "",
    })
  }
  if (services.length === 0) services.push({
    name: validation.cleaned.slice(0, 120),
    category: inferCategory(validation.cleaned),
    description: normalizeServicesInput(input).slice(0, 500),
    duration: "",
  })
  return services
}

export function logServicesDevelopment(label: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") console.info(label, details)
}
