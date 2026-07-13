import { llmChat, type ChatMessage } from "./llm"
import {
  buildSetupAssistantSystemPrompt,
  buildSetupAssistantUserTurn,
  type SetupAssistantTurnInput,
} from "./setup-assistant-prompt"
import {
  emptyKnowledgeBase,
  knowledgeBaseSchema,
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
  provider: "nara" | "mock"
  model: string
}

export class SetupAssistantAiError extends Error {
  readonly code = "SETUP_ASSISTANT_AI_UNAVAILABLE"

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "SetupAssistantAiError"
  }
}

function allowMockSetupAssistant(): boolean {
  return process.env.NODE_ENV === "test" || process.env.SETUP_ASSISTANT_ALLOW_MOCK === "true"
}

function setupAssistantUnavailableMessage(error: unknown): string {
  const reason = error instanceof Error ? error.message : ""
  if (/NARA_API_KEY is not (configured|set)/i.test(reason)) {
    return "NARA_API_KEY is missing from this Vercel deployment. Add it to the active environment and redeploy; your progress is safe."
  }
  if (/Nara API request failed \(401\)/i.test(reason)) {
    return "Nara rejected the API key loaded by this Vercel deployment. Replace NARA_API_KEY with the active sk-nry key value and redeploy; your progress is safe."
  }
  if (/Nara API request failed \(403\)/i.test(reason)) {
    return "Nara authenticated the key, but this account cannot use NARA_MODEL. Confirm the plan includes mistral-medium-3-5 and the account is active; your progress is safe."
  }
  if (/Nara API request failed \(404\)/i.test(reason)) {
    return "Nara could not find the configured endpoint or model. Use https://router.bynara.id/v1 and mistral-medium-3-5, then redeploy; your progress is safe."
  }
  if (/Nara API request failed \(429\)/i.test(reason)) {
    return "Nara is temporarily rate-limited. Wait a moment and retry; your progress is safe."
  }
  if (/abort|timeout/i.test(reason)) {
    return "Nara took too long to respond. Please retry; your progress is safe."
  }
  return "The AI setup assistant is temporarily unavailable. Your progress is safe; please try again."
}

function normalizeTimezone(tz: string): string {
  const map: Record<string, string> = {
    "pst": "America/Los_Angeles",
    "pdt": "America/Los_Angeles",
    "pacific time": "America/Los_Angeles",
    "pacific": "America/Los_Angeles",
    "est": "America/New_York",
    "edt": "America/New_York",
    "eastern time": "America/New_York",
    "eastern": "America/New_York",
    "cst": "America/Chicago",
    "cdt": "America/Chicago",
    "central time": "America/Chicago",
    "central": "America/Chicago",
    "mst": "America/Denver",
    "mdt": "America/Denver",
    "mountain time": "America/Denver",
    "mountain": "America/Denver",
    "hst": "Pacific/Honolulu",
    "akst": "America/Anchorage",
    "akdt": "America/Anchorage",
    "utc": "Etc/UTC",
    "gmt": "Etc/GMT",
  }
  const key = tz.toLowerCase().trim()
  const mapped = map[key]
  if (mapped) return mapped
  // Capitalize IANA-style timezone names (America/New_York, Asia/Karachi, etc.)
  const ianaMatch = key.match(/^([a-z]+)\/([a-z_]+)$/)
  if (ianaMatch) {
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
    const parts = ianaMatch[2].split("_")
    const region = parts.map(p => cap(p)).join("_")
    return `${cap(ianaMatch[1])}/${region}`
  }
  if (/^utc[+-]\d+$/i.test(tz)) {
    const offset = parseInt(tz.replace(/^UTC[+-]/, ""), 10)
    if (offset <= 0) return `Etc/GMT${offset === 0 ? "" : "+" + Math.abs(offset)}`
    return `Etc/GMT-${offset}`
  }
  return tz
}

type DayEntry = { day: "Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"|"Sun"; open: boolean; from: string; to: string }
const DAY_NAMES: DayEntry["day"][] = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
const DAY_ABBREVS = ["mon","tue","wed","thu","fri","sat","sun"]

function parseTime(text: string): string {
  const m = text.match(/(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)/i)
  if (!m) return "09:00"
  let h = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  const ampm = (m[3] || "").toLowerCase()
  if (ampm === "pm" && h < 12) h += 12
  if (ampm === "am" && h === 12) h = 0
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
}

function dayIndex(word: string): number {
  const w = word.toLowerCase().slice(0, 3)
  for (let i = 0; i < DAY_ABBREVS.length; i++) {
    if (DAY_ABBREVS[i] === w) return i
  }
  return -1
}

function buildMockSchedule(text: string): DayEntry[] {
  const lower = text.toLowerCase()
  const schedule: DayEntry[] = DAY_NAMES.map((d) => ({ day: d, open: true, from: "09:00", to: "17:00" }))

  // Find "closed on X" patterns
  const closedMatch = lower.match(/closed\s*(?:on\s*)?(\w+)/)
  if (closedMatch) {
    const idx = dayIndex(closedMatch[1])
    if (idx >= 0) schedule[idx] = { ...schedule[idx], open: false }
  }

  // Handle "weekdays" shorthand
  if (/\bweekdays?\b/i.test(lower)) {
    const weekdays = [0, 1, 2, 3, 4]
    const range = lower.match(/weekdays?\b[\s\S]*?from\s+(\d[\d:\sampm]*?)\s*(?:[-–to]+\s*)(\d[\d:\sampm]*?)/i)
    if (range) {
      const fromTime = parseTime(range[1])
      const toTime = parseTime(range[2])
      weekdays.forEach(i => { schedule[i] = { ...schedule[i], from: fromTime, to: toTime } })
    }
  }

  // Handle "weekends" shorthand
  if (/\bweekends?\b/i.test(lower)) {
    const range = lower.match(/weekends?\b[\s\S]*?from\s+(\d[\d:\sampm]*?)\s*(?:[-–to]+\s*)(\d[\d:\sampm]*?)/i)
    if (range) {
      const fromTime = parseTime(range[1])
      const toTime = parseTime(range[2])
      ;[5, 6].forEach(i => { schedule[i] = { ...schedule[i], from: fromTime, to: toTime } })
    }
  }

  // Find range patterns like "Monday to Friday from 10 AM to 6 PM"
  const rangeR = /(\w+)\s*(?:\s*[-–to]+\s*|,\s*)(\w+)\s*(?:from|at)?\s*(\d[\d:\sampm]*?)\s*(?:[-–to]+\s*)(\d[\d:\sampm]*?)(?:\s*,|\s*and|$)/gi
  let m: RegExpExecArray | null
  while ((m = rangeR.exec(lower)) !== null) {
    const fromIdx = dayIndex(m[1])
    const toIdx = dayIndex(m[2])
    if (fromIdx < 0 || toIdx < 0) continue
    const openTime = parseTime(m[3])
    const closeTime = parseTime(m[4])
    for (let i = fromIdx; i <= toIdx; i++) {
      schedule[i] = { ...schedule[i], from: openTime, to: closeTime }
    }
  }

  // Find single day patterns like "Saturday from 10 AM to 3 PM"
  const singleR = /(\w+)\s+(?:from|at)\s+(\d[\d:\sampm]*?)\s*(?:[-–to]+\s*)(\d[\d:\sampm]*?)(?:\s*,|\s*and|$)/gi
  let s: RegExpExecArray | null
  while ((s = singleR.exec(lower)) !== null) {
    const idx = dayIndex(s[1])
    if (idx < 0) continue
    schedule[idx] = { ...schedule[idx], from: parseTime(s[2]), to: parseTime(s[3]) }
  }

  return schedule
}

function extractExplicitHours(text: string): { timezone: string; schedule: DayEntry[] } | null {
  const timezoneMatch = text.match(
    /(America\/[A-Za-z_]+|Asia\/[A-Za-z_]+|Europe\/[A-Za-z_]+|Africa\/[A-Za-z_]+|Australia\/[A-Za-z_]+|Pacific\/[A-Za-z_]+|PST|PDT|Pacific\s*Time|EST|EDT|Eastern\s*Time|CST|CDT|Central\s*Time|MST|MDT|Mountain\s*Time|HST|AKST|UTC[+-]\d+|\+\d{2}:\d{2})/i,
  )
  const hasSchedule =
    /\b(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekdays?|weekends?)\b/i.test(
      text,
    )

  if (!timezoneMatch || !hasSchedule) return null

  return {
    timezone: normalizeTimezone(timezoneMatch[1]),
    schedule: buildMockSchedule(text),
  }
}

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
  const explicitHours = extractExplicitHours(input.userMessage)

  if (section === "business" && explicitHours) {
    return {
      reply: `Got it. I saved your business hours and timezone (${explicitHours.timezone}). Next, what services do you offer and what are your starting prices?`,
      section: "hours",
      action: "advance",
      captured: {
        hours: { ...explicitHours, open247: false },
      },
      concerns: [],
    }
  }

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
    const tzMatch = text.match(/(America\/[A-Za-z_]+|PST|PDT|Pacific\s*Time|EST|EDT|Eastern\s*Time|CST|CDT|Central\s*Time|MST|MDT|Mountain\s*Time|HST|AKST|UTC[+-]\d+|Asia\/[A-Za-z_]+|\+\d{2}:\d{2})/i)
    const timezone = tzMatch
      ? normalizeTimezone(tzMatch[1])
      : "America/Los_Angeles"
    const hasSchedule = /\b(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekdays?|weekends?)\b/i.test(text)
    const schedule = hasSchedule ? buildMockSchedule(text) : []
    const hasAllFields = schedule.length > 0 && tzMatch
    return {
      reply: hasAllFields
        ? `Got it. I saved your business hours and timezone (${timezone}). Next, what services do you offer and what are your starting prices?`
        : `Logged those hours. I'll set the timezone to ${timezone} unless you tell me otherwise. Continue?`,
      section,
      action: hasAllFields ? "advance" : "ask",
      captured: { hours: { timezone, schedule, open247: false } },
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
  const withoutThinking = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim()
  const fenced = withoutThinking.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const firstBrace = withoutThinking.indexOf("{")
  const lastBrace = withoutThinking.lastIndexOf("}")
  const candidates = [
    fenced?.[1],
    withoutThinking,
    firstBrace >= 0 && lastBrace > firstBrace
      ? withoutThinking.slice(firstBrace, lastBrace + 1)
      : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate?.trim()))

  for (const candidate of [...new Set(candidates)]) {
    try {
      const parsed = JSON.parse(candidate.trim()) as Partial<SetupAssistantRawResponse>
      if (typeof parsed.reply !== "string" || typeof parsed.action !== "string") continue
      const section =
        typeof parsed.section === "string" && isSetupAssistantSection(parsed.section)
          ? parsed.section
          : null
      if (!section) continue
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
          ? parsed.concerns.filter((concern): concern is string => typeof concern === "string").slice(0, 10)
          : [],
      }
    } catch {
      // Try the next JSON candidate. A second AI request runs if none parse.
    }
  }

  return null
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
  let provider: "nara" | "mock" = "mock"
  let lastAiError: unknown

  for (let attempt = 0; attempt < 2 && !raw; attempt += 1) {
    try {
      const attemptMessages =
        attempt === 0
          ? history
          : [
              {
                role: "system" as const,
                content:
                  `${system}\n\nCRITICAL RETRY: The previous response failed because: ${
                    lastAiError instanceof Error ? lastAiError.message : "invalid response"
                  }. Return exactly one complete JSON object using the exact captured shape. ` +
                  "Do not add prose, markdown fences, or reasoning outside the JSON.",
              },
              ...history.slice(1),
            ]
      const result = await llmChat({
        messages: attemptMessages,
        responseFormat: { type: "json_object" },
        failureMode: "throw",
        options: { temperature: 0.2, maxTokens: 1800, timeoutMs: 28_000 },
      })
      model = result.model
      provider = result.provider
      const parsedRaw = safeParseAssistantJson(result.content)
      if (!parsedRaw) {
        lastAiError = new Error("Nara returned an incomplete or invalid JSON response")
        continue
      }

      const candidateDraft = mergeCaptured(input.draft, parsedRaw)
      const candidateValidation = knowledgeBaseSchema.safeParse(candidateDraft)
      if (!candidateValidation.success) {
        const issue = candidateValidation.error.issues[0]
        lastAiError = new Error(
          `captured.${issue?.path.join(".") || "unknown"}: ${issue?.message || "invalid schema"}`,
        )
        continue
      }
      raw = parsedRaw
    } catch (error) {
      lastAiError = error
    }
  }

  if (!raw) {
    if (allowMockSetupAssistant()) {
      raw = fallbackMockResponse(input)
      model = "aiva-mock-1"
      provider = "mock"
    } else {
      const reason = lastAiError instanceof Error ? lastAiError.message : "unknown AI error"
      console.error("setup-assistant: Nara AI unavailable", { reason })
      throw new SetupAssistantAiError(
        setupAssistantUnavailableMessage(lastAiError),
        { cause: lastAiError },
      )
    }
  }
  // Do not let an LLM or fallback response ask for hours/timezone that the owner
  // explicitly supplied. This guard also recovers older drafts that are still on
  // the business step after a provider timeout.
  const explicitHours = extractExplicitHours(input.userMessage)
  if (provider === "mock" && explicitHours && (input.currentSection === "business" || input.currentSection === "hours")) {
    raw = {
      ...raw,
      reply: `Got it. I saved your business hours and timezone (${explicitHours.timezone}). Next, what services do you offer and what are your starting prices?`,
      section: "hours",
      action: "advance",
      captured: deepMerge(raw.captured ?? {}, {
        hours: { ...explicitHours, open247: false },
      }),
    }
  }

  const concerns = [
    ...(raw.concerns ?? []),
    ...detectPricingConcerns(input.userMessage),
  ]

  const mergedCandidate = mergeCaptured(input.draft, raw)
  mergedCandidate.status = {
    complete: raw.action === "finish",
    pendingFields: countPendingFields(mergedCandidate),
    completedAt: raw.action === "finish" ? new Date().toISOString() : undefined,
  }

  const validatedDraft = knowledgeBaseSchema.safeParse(mergedCandidate)
  if (!validatedDraft.success && provider === "nara") {
    console.error("setup-assistant: Nara returned invalid knowledge data", {
      issues: validatedDraft.error.issues.slice(0, 5).map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    })
    throw new SetupAssistantAiError(
      "The AI response could not be safely saved. Your previous progress is unchanged; please try again.",
    )
  }
  const merged = validatedDraft.success ? validatedDraft.data : mergedCandidate
  const effectiveSection =
    provider === "nara"
      ? input.currentSection
      : isSetupAssistantSection(raw.section)
        ? raw.section
        : input.currentSection
  const next =
    raw.action === "advance" || raw.action === "finish"
      ? nextSectionOf(effectiveSection)
      : null
  return {
    reply: raw.reply,
    section: effectiveSection,
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
