import { createAdminClient } from "@/lib/supabase/admin"
import type {
  KnowledgeService,
  KnowledgeFaq,
  KnowledgeGuardrail,
  WidgetConfig,
} from "@/lib/supabase/types"
import {
  mapKnowledgeService,
  mapKnowledgeFaq,
  mapKnowledgeGuardrail,
  mapWidgetConfig,
} from "@/lib/supabase/types"
import {
  type KnowledgeBase,
  emptyKnowledgeBase,
} from "./setup-assistant-schema"

export type ExtendedKnowledgeBase = KnowledgeBase & {
  source: "fresh" | "fallback" | "empty"
}

export type KnowledgeBundle = {
  services: KnowledgeService[]
  faqs: KnowledgeFaq[]
  guardrails: KnowledgeGuardrail[]
  widget: WidgetConfig
  extendedKb: ExtendedKnowledgeBase
  fetchedAt: number
}

let cache: KnowledgeBundle | null = null
const CACHE_TTL_MS = 60_000

const FALLBACK_WIDGET: WidgetConfig = {
  id: "default",
  brandName: "Glow Med Spa",
  logoInitial: "G",
  bubbleLogoUrl: null,
  primaryColor: "#E2E54B",
  position: "bottom-right",
  welcomeMessage:
    "Hi! Are you looking to book a consultation or ask about a treatment?",
  proactiveEnabled: true,
  proactiveDelaySeconds: 8,
  proactiveMessage:
    "Still browsing? I can answer questions or set up a consultation in seconds.",
  showBranding: true,
  collectEmail: true,
  collectPhone: true,
  consentText:
    "By chatting, you agree to our privacy policy. We'll only contact you about your inquiry.",
  workingHours: {
    enabled: false,
    tz: "America/Los_Angeles",
    schedule: [],
  },
  extendedKb: {},
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
}

function parseExtendedKb(raw: unknown): ExtendedKnowledgeBase {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...emptyKnowledgeBase(), source: "empty" }
  }
  const merged = { ...emptyKnowledgeBase(), ...(raw as Partial<KnowledgeBase>) }
  return { ...merged, source: "fresh" }
}

export async function loadKnowledge(): Promise<KnowledgeBundle> {
  const now = Date.now()
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache
  }
  const admin = createAdminClient()
  console.log("[retrieval] loading knowledge base from Supabase", {
    services: "knowledge_services",
    faqs: "knowledge_faqs",
    guardrails: "knowledge_guardrails",
    widget: "widget_config",
  })
  // Race the four KB queries against a hard timeout. If Supabase is slow,
  // unreachable, or the connection pool is exhausted, we MUST NOT freeze
  // the chat — serve an empty (but valid) KB instead so the AI can still
  // respond with safe canned replies. The visitor never sees a blank
  // bubble because of a slow DB.
  const KB_LOAD_TIMEOUT_MS = 4_000
  const loadPromise = Promise.all([
    admin.from("knowledge_services").select("*").order("name"),
    admin.from("knowledge_faqs").select("*").order("created_at"),
    admin.from("knowledge_guardrails").select("*").order("created_at"),
    admin.from("widget_config").select("*").limit(1).maybeSingle(),
  ])
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`loadKnowledge timeout after ${KB_LOAD_TIMEOUT_MS}ms`)),
      KB_LOAD_TIMEOUT_MS,
    ),
  )
  let results: Awaited<typeof loadPromise>
  try {
    results = await Promise.race([loadPromise, timeoutPromise])
  } catch (err) {
    console.error("[retrieval] knowledge base load failed or timed out", err)
    // Serve an empty (but valid) KB so the conversation can still produce
    // a safe reply via the KB-aware fallback. We do NOT throw — the chat
    // must never go blank because of a slow DB.
    const fallback: KnowledgeBundle = {
      services: [],
      faqs: [],
      guardrails: [],
      widget: FALLBACK_WIDGET,
      extendedKb: { ...emptyKnowledgeBase(), source: "empty" },
      fetchedAt: now,
    }
    return fallback
  }
  const [servicesRes, faqsRes, guardrailsRes, widgetRes] = results

  // Surface any partial failure (RLS denial, missing table, etc.) so the
  // operator can see it in logs instead of getting a silent empty KB
  // that makes the AI fall back to canned replies.
  if (servicesRes.error) {
    console.error("[retrieval] knowledge_services fetch failed", servicesRes.error)
  }
  if (faqsRes.error) {
    console.error("[retrieval] knowledge_faqs fetch failed", faqsRes.error)
  }
  if (guardrailsRes.error) {
    console.error("[retrieval] knowledge_guardrails fetch failed", guardrailsRes.error)
  }
  if (widgetRes.error) {
    console.error("[retrieval] widget_config fetch failed", widgetRes.error)
  }

  // Defensive defaults: never assume the rows exist. A null/empty result
  // becomes an empty array so downstream code can iterate safely.
  const services = (Array.isArray(servicesRes.data) ? servicesRes.data : []).map(
    (r) => mapKnowledgeService(r as Record<string, unknown>),
  )
  const faqs = (Array.isArray(faqsRes.data) ? faqsRes.data : []).map((r) =>
    mapKnowledgeFaq(r as Record<string, unknown>),
  )
  const guardrails = (Array.isArray(guardrailsRes.data) ? guardrailsRes.data : []).map(
    (r) => mapKnowledgeGuardrail(r as Record<string, unknown>),
  )
  const widget = widgetRes.data
    ? mapWidgetConfig(widgetRes.data as Record<string, unknown>)
    : FALLBACK_WIDGET

  const extendedKb = parseExtendedKb(widget.extendedKb)

  console.log("[retrieval] knowledge base loaded", {
    services: services.length,
    faqs: faqs.length,
    guardrails: guardrails.length,
    brand: widget.brandName,
  })

  cache = { services, faqs, guardrails, widget, extendedKb, fetchedAt: now }
  return cache
}

export function invalidateKnowledgeCache() {
  cache = null
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "do",
  "does",
  "for",
  "from",
  "have",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "so",
  "that",
  "the",
  "this",
  "to",
  "was",
  "we",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "you",
  "your",
  "do",
  "you",
  "can",
  "could",
  "would",
  "should",
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
}

export type RetrievedItem =
  | { kind: "service"; service: KnowledgeService; score: number }
  | { kind: "faq"; faq: KnowledgeFaq; score: number }

export function retrieve(query: string, kb: KnowledgeBundle, limit = 5): RetrievedItem[] {
  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) {
    return kb.faqs.slice(0, limit).map((f) => ({ kind: "faq", faq: f, score: 0 }))
  }

  const scores: RetrievedItem[] = []

  for (const service of kb.services) {
    if (!service.active) continue
    const haystack = `${service.name} ${service.category} ${service.description} ${service.pricingRule}`
    const tokens = tokenize(haystack)
    let score = 0
    for (const q of queryTokens) {
      if (tokens.includes(q)) score += 1
    }
    if (score > 0) scores.push({ kind: "service", service, score })
  }

  for (const faq of kb.faqs) {
    const haystack = `${faq.question} ${faq.answer} ${faq.category}`
    const tokens = tokenize(haystack)
    let score = 0
    for (const q of queryTokens) {
      if (tokens.includes(q)) score += 1
      else if (faq.question.toLowerCase().includes(q)) score += 0.5
    }
    if (score > 0) scores.push({ kind: "faq", faq, score })
  }

  scores.sort((a, b) => b.score - a.score)
  return scores.slice(0, limit)
}
