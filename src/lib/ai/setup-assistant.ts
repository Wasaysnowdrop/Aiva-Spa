import { llmChat, type ChatMessage } from "./llm"
import {
  buildSetupAssistantSystemPrompt,
  buildSetupAssistantUserTurn,
  type SetupAssistantTurnInput,
} from "./setup-assistant-prompt"
import {
  emptyKnowledgeBase,
  SETUP_ASSISTANT_SECTIONS,
  type KnowledgeBase,
  type SetupAssistantSection,
  countPendingFields,
} from "./setup-assistant-schema"

export type SetupAssistantAction = "ask" | "summarize" | "advance" | "finish"

export type SetupAssistantRawResponse = {
  reply: string
  section: string
  action: SetupAssistantAction
  captured?: Record<string, unknown>
  concerns?: string[]
}

export type SetupAssistantTurnResult = {
  reply: string
  section: SetupAssistantSection
  nextSection: SetupAssistantSection | null
  action: SetupAssistantAction
  concerns: string[]
  draft: KnowledgeBase
  pendingFields: string[]
  durationMs: number
  provider: "cloudflare" | "mock"
  model: string
}

const FALLBACK_REPLY =
  "Sorry, I had a hiccup processing that. Could you rephrase or share the detail again?"

function isSetupAssistantSection(value: string): value is SetupAssistantSection {
  return (SETUP_ASSISTANT_SECTIONS as readonly string[]).includes(value)
}

function nextSectionOf(section: SetupAssistantSection): SetupAssistantSection | null {
  const idx = (SETUP_ASSISTANT_SECTIONS as readonly string[]).indexOf(section)
  if (idx < 0 || idx === SETUP_ASSISTANT_SECTIONS.length - 1) return null
  return SETUP_ASSISTANT_SECTIONS[idx + 1] as SetupAssistantSection
}

function deepMerge<T>(base: T, patch: Record<string, unknown> | undefined): T {
  if (!patch) return base
  if (Array.isArray(patch)) return patch as unknown as T
  if (typeof patch !== "object" || patch === null) return base
  const out: Record<string, unknown> = {
    ...(typeof base === "object" && base !== null ? (base as Record<string, unknown>) : {}),
  }
  for (const [k, v] of Object.entries(patch)) {
    const existing = out[k]
    if (
      v !== null &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      existing &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      out[k] = deepMerge(existing as Record<string, unknown>, v as Record<string, unknown>)
    } else {
      out[k] = v
    }
  }
  return out as T
}

function fallbackMockResponse(input: SetupAssistantTurnInput): SetupAssistantRawResponse {
  const text = input.userMessage.toLowerCase()
  const section = input.currentSection

  if (section === "business") {
    return {
      reply:
        "Got it — saved the spa name and basics. Quick confirm: which timezone should we use?",
      section,
      action: "ask",
      captured: {
        business: { name: { value: input.userMessage.slice(0, 120), status: "captured" } },
      },
      concerns: [],
    }
  }
  if (section === "hours") {
    return {
      reply: "Logged those hours. I'll set the timezone to America/Los_Angeles unless you tell me otherwise. Continue?",
      section,
      action: "ask",
      captured: { hours: { timezone: "America/Los_Angeles" } },
      concerns: [],
    }
  }
  if (section === "services") {
    if (/(botox|filler|laser|facial|peel|microneedl|hydra|cool|treat)/.test(text)) {
      return {
        reply:
          "Added that service. Reminder: I'll only ever quote a range or 'confirmed at consultation' to visitors — never a firm price. What's the next service?",
        section,
        action: "ask",
        captured: {
          services: [
            {
              name: input.userMessage.slice(0, 80),
              category: "Other",
              description: "Service description pending — confirm with provider.",
              duration: "",
            },
          ],
        },
        concerns: text.includes("$")
          ? ["Firm price detected in owner's reply; downgrade to range or 'consultation required'."]
          : [],
      }
    }
    return {
      reply:
        "Tell me the service name, a short client-friendly description, and an optional duration. I won't store firm prices.",
      section,
      action: "ask",
    }
  }
  if (section === "booking_policy") {
    return {
      reply:
        "Saved: manual follow-up. Want to add a deposit requirement or a calendar link? Otherwise we can move on.",
      section,
      action: "ask",
      captured: { booking_policy: { consultationMode: "manual_follow_up" } },
    }
  }
  if (section === "faqs") {
    return {
      reply:
        "Added that FAQ. Got 1 down — share more, or say 'suggest' and I'll give you the most common med-spa FAQs to confirm or edit.",
      section,
      action: "ask",
      captured: {
        faqs: [
          {
            question: input.userMessage.slice(0, 200),
            answer: "Pending — please confirm or edit the answer.",
            category: "General",
          },
        ],
      },
    }
  }
  if (section === "disclaimers") {
    return {
      reply: "Standard disclaimers saved. You can edit them later from the Knowledge Base.",
      section,
      action: "advance",
      captured: { disclaimers: { standardAccepted: true } },
    }
  }
  if (section === "brand_voice") {
    return {
      reply:
        "Voice captured as warm + premium. Saved your greeting. Any phrases the AI must avoid (e.g., 'cheap', 'guaranteed')?",
      section,
      action: "ask",
      captured: { brand_voice: { tone: "warm" } },
    }
  }
  if (section === "notifications") {
    return {
      reply:
        "Email and SMS recipients noted. You can add more from Settings → Team later. Ready for the final review?",
      section,
      action: "summarize",
      captured: {
        notifications: {
          channels: { email: true, sms: false },
          emailRecipients: [],
          smsRecipients: [],
        },
      },
    }
  }
  return {
    reply: "Everything looks good. Confirm to publish your knowledge base.",
    section: "review",
    action: "finish",
  }
}

function safeParseAssistantJson(content: string): SetupAssistantRawResponse | null {
  try {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
    const raw = fenced ? fenced[1] : content
    const parsed = JSON.parse(raw.trim()) as Partial<SetupAssistantRawResponse>
    if (typeof parsed.reply !== "string" || typeof parsed.action !== "string") return null
    const section =
      typeof parsed.section === "string" && isSetupAssistantSection(parsed.section)
        ? parsed.section
        : null
    if (!section) return null
    const allowedActions: SetupAssistantAction[] = ["ask", "summarize", "advance", "finish"]
    const action = allowedActions.includes(parsed.action as SetupAssistantAction)
      ? (parsed.action as SetupAssistantAction)
      : "ask"
    return {
      reply: parsed.reply,
      section,
      action,
      captured:
        parsed.captured && typeof parsed.captured === "object"
          ? (parsed.captured as Record<string, unknown>)
          : undefined,
      concerns: Array.isArray(parsed.concerns)
        ? parsed.concerns.filter((c): c is string => typeof c === "string").slice(0, 10)
        : [],
    }
  } catch {
    return null
  }
}

function detectPricingConcerns(text: string): string[] {
  const concerns: string[] = []
  const dollar = text.match(/\$\s?\d+(\.\d+)?/)
  if (dollar) {
    concerns.push(
      `Firm price detected ("${dollar[0]}"). Downgrade to a range or "confirmed at consultation" before publishing.`,
    )
  }
  const medical = /\b(cure|guarantee|cure|diagnos|prescribe|side[-\s]?effect free|risk[-\s]?free)\b/i
  if (medical.test(text)) {
    concerns.push(
      "Medical/outcome claim detected. Strip guarantees, diagnoses, and risk-free language before publishing.",
    )
  }
  return concerns
}

function mergeCaptured(
  draft: KnowledgeBase,
  raw: SetupAssistantRawResponse,
): KnowledgeBase {
  if (!raw.captured) return draft
  const next: KnowledgeBase = { ...draft }
  for (const [key, value] of Object.entries(raw.captured)) {
    if (value === undefined) continue
    const existing = (next as Record<string, unknown>)[key]
    if (Array.isArray(value)) {
      ;(next as Record<string, unknown>)[key] = mergeArrays(
        Array.isArray(existing) ? (existing as unknown[]) : [],
        value as unknown[],
      )
    } else if (
      value !== null &&
      typeof value === "object" &&
      existing &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      ;(next as Record<string, unknown>)[key] = deepMerge(
        existing as Record<string, unknown>,
        value as Record<string, unknown>,
      )
    } else {
      ;(next as Record<string, unknown>)[key] = value
    }
  }
  return next
}

function mergeArrays(existing: unknown[], patch: unknown[]): unknown[] {
  if (patch.length === 0) return existing
  const last = patch[patch.length - 1]
  if (
    last &&
    typeof last === "object" &&
    !Array.isArray(last) &&
    "replaceAll" in (last as Record<string, unknown>) &&
    (last as Record<string, unknown>).replaceAll === true
  ) {
    return patch.slice(1)
  }
  return [...existing, ...patch]
}

export async function runSetupAssistantTurn(
  input: SetupAssistantTurnInput,
): Promise<SetupAssistantTurnResult> {
  const start = Date.now()
  const system = buildSetupAssistantSystemPrompt()
  const user = buildSetupAssistantUserTurn(input)
  const history: ChatMessage[] = [
    { role: "system", content: system },
    ...input.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: user },
  ]

  let raw: SetupAssistantRawResponse | null = null
  let model = "aiva-mock-1"
  let provider: "cloudflare" | "mock" = "mock"

  try {
    const result = await llmChat({
      messages: history,
      responseFormat: { type: "json_object" },
      options: { temperature: 0.3, maxTokens: 700 },
    })
    model = result.model
    provider = result.provider
    raw = safeParseAssistantJson(result.content)
    if (!raw && provider === "mock") {
      raw = fallbackMockResponse(input)
    }
  } catch {
    raw = fallbackMockResponse(input)
  }

  if (!raw) {
    raw = {
      reply: FALLBACK_REPLY,
      section: input.currentSection,
      action: "ask",
    }
  }

  const concerns = [
    ...(raw.concerns ?? []),
    ...detectPricingConcerns(input.userMessage),
  ]

  const merged = mergeCaptured(input.draft, raw)
  merged.status = {
    complete: raw.action === "finish",
    pendingFields: countPendingFields(merged),
    completedAt: raw.action === "finish" ? new Date().toISOString() : undefined,
  }

  const next =
    raw.action === "advance" || raw.action === "finish"
      ? nextSectionOf(input.currentSection)
      : null

  return {
    reply: raw.reply,
    section: raw.section as SetupAssistantSection,
    nextSection: next,
    action: raw.action,
    concerns,
    draft: merged,
    pendingFields: merged.status.pendingFields,
    durationMs: Date.now() - start,
    provider,
    model,
  }
}

export function makeInitialDraft(overrides?: Partial<KnowledgeBase>): KnowledgeBase {
  const base = emptyKnowledgeBase()
  return { ...base, ...overrides }
}
