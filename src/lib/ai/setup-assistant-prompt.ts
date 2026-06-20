import {
  SETUP_ASSISTANT_SECTIONS,
  type KnowledgeBase,
  type SetupAssistantSection,
} from "./setup-assistant-schema"

export type SetupAssistantTurnInput = {
  history: { role: "assistant" | "user"; content: string }[]
  userMessage: string
  currentSection: SetupAssistantSection
  draft: KnowledgeBase
  ownerName?: string
  spaName?: string
}

export type SetupAssistantSectionKey =
  | "business"
  | "hours"
  | "services"
  | "booking_policy"
  | "faqs"
  | "disclaimers"
  | "brand_voice"
  | "notifications"
  | "review"

export const SECTION_INTRO: Record<SetupAssistantSectionKey, string> = {
  business:
    "Let's start with the basics so the AI always represents your spa correctly.",
  hours:
    "Next, business hours. These power the after-hours message in the widget.",
  services:
    "Now the services the AI can recommend. Remember: no firm prices — only ranges or 'confirmed at consultation'.",
  booking_policy:
    "How should the AI handle consultation bookings?",
  faqs:
    "Your top visitor questions. The AI will answer these verbatim. If you don't have 10, that's fine — we'll suggest common ones and you can confirm.",
  disclaimers:
    "Compliance & safety text. Confirm the standard or customize within limits.",
  brand_voice:
    "Tone and phrasing. This shapes every reply the AI sends to visitors.",
  notifications:
    "Where should new leads go? You can add emails and SMS numbers.",
  review:
    "Final review. Here is the full knowledge base the AI will use. Confirm to publish.",
}

const SECTION_FIELD_GUIDANCE: Record<SetupAssistantSectionKey, string> = {
  business: `
- spa_name (required)
- website (optional)
- addresses: array of {line1, line2, city, region, postal, country}
- afterHoursPolicy: a short sentence describing what happens after hours (e.g., "We capture leads and follow up the next business morning."). If the owner says "skip" or "I don't know", set status to "pending".`,
  hours: `
- timezone: IANA tz string (default "America/Los_Angeles")
- open247: boolean (true if the spa is 24/7)
- schedule: array of exactly 7 entries, one per day Mon..Sun
    { day: "Mon"|"Tue"|...|"Sun", open: boolean, from: "HH:MM", to: "HH:MM" }
- afterHoursMessage: short message the AI uses after hours (optional)`,
  services: `
- services: array of { name, category, description, duration, priceRange? }
  - category must be one of: Injectables, Skin, Body, Laser, Other
  - description: 1–2 sentence client-friendly description (no medical claims)
  - duration: e.g. "30 min" (optional)
  - priceRange: { min, max, currency, unit, indicativeOnly: true } — OPTIONAL, only include if the owner explicitly gives a range
- NEVER capture a single fixed price as "price". Always wrap it in priceRange with indicativeOnly: true, or omit and note "confirmed at consultation".`,
  booking_policy: `
- consultationMode: "manual_follow_up" | "calendar_link" | "self_book_online"
- calendarLink: URL string (optional)
- deposit: { required: boolean, amount?, currency: "USD", refundable: boolean, notes }
- cancellation: { noticeHours?, feePolicy, notes }`,
  faqs: `
- faqs: array of { question, answer, category }
  - category must be one of: General, Pricing, Booking, Safety, Hours
  - answer should be the verbatim reply the AI will use
- If the owner can't list 10, suggest common med-spa FAQs and let them confirm/edit. Don't invent answers — mark missing as "pending".`,
  disclaimers: `
- standardAccepted: true if the owner accepts the default text
- pricing: short disclaimer about pricing (must NOT be removed — it's a hard rule)
- medical: short medical disclaimer (must NOT be removed)
- consent: consent text shown before saving contact details`,
  brand_voice: `
- tone: "formal" | "warm" | "casual" | "playful" | "luxury"
- customTone: free-text override (optional)
- greeting: the widget's first message
- avoidPhrases: array of strings the AI must never use
- preferPhrases: array of strings the AI should prefer`,
  notifications: `
- emailRecipients: array of emails
- smsRecipients: array of E.164-ish phone strings
- escalationEmail, escalationPhone: for VIP / urgent leads
- channels: { email: boolean, sms: boolean }
- quietHours: { enabled, from: "HH:MM", to: "HH:MM" } — do not send SMS in this window`,
  review:
    "Do not capture new fields in this section. Summarise the full KB and ask for final confirmation.",
}

export const SECTION_FIELD_GUIDANCE_EXPORT = SECTION_FIELD_GUIDANCE

export const SECTION_ORDER: SetupAssistantSectionKey[] = [
  "business",
  "hours",
  "services",
  "booking_policy",
  "faqs",
  "disclaimers",
  "brand_voice",
  "notifications",
  "review",
]

function nextSectionOf(current: SetupAssistantSection): SetupAssistantSection {
  const idx = (SETUP_ASSISTANT_SECTIONS as readonly string[]).indexOf(current)
  if (idx < 0 || idx === SETUP_ASSISTANT_SECTIONS.length - 1) return "review"
  return SETUP_ASSISTANT_SECTIONS[idx + 1] as SetupAssistantSection
}

export function buildSetupAssistantSystemPrompt(): string {
  return `You are AivaSpa Setup Assistant — a configuration agent built into the AivaSpa SaaS platform (aiva.spa).

Your only job: interview a med-spa owner and produce a structured knowledge base (KB) JSON that powers their 24/7 AI receptionist.

# Hard rules
1. Output a SINGLE JSON object matching the response_schema below. No prose outside JSON. The JSON is consumed directly by the platform.
2. Never invent firm prices. If the owner says "Botox is $13/unit", wrap it as a priceRange with indicativeOnly:true. If they give a single number without context, ask whether it's a range.
3. Never make medical claims, give diagnoses, or promise outcomes. You are configuring the AI that will refuse to do so.
4. If the owner refuses, says "skip", or doesn't know: mark that field { value: null, status: "pending" } — NEVER fabricate.
5. Collect ONE topic at a time. The current section is provided in the user message. Stay on that section until its required fields are captured or marked pending, then output action: "advance" and the platform will switch sections.
6. After collecting all required fields for a section, output action: "summarize" with a 2–4 line summary of what you captured and ask the owner to confirm or correct. On their confirmation, output action: "advance".
7. Always end your reply text with a single, clear, conversational question or summary (1–3 short sentences max). Keep it warm, premium, concise.
8. Sections in order: business → hours → services → booking_policy → faqs → disclaimers → brand_voice → notifications → review. The platform passes you the current section; do not skip ahead unless the owner explicitly asks.
9. If the owner goes off-topic, gently redirect: "Happy to cover that — first, can we finish {current section}?"
10. Tone: warm, premium, concise. Never use emojis. Address the owner by first name if you have it.

# Response JSON schema
{
  "reply": string,                          // 1–3 sentences shown to the owner, ends with a question or summary
  "section": string,                        // current section key (echo back)
  "action": "ask" | "summarize" | "advance" | "finish",
  "captured": {                             // partial update merged into the running KB
    // shape mirrors the section you're on; include only fields you captured or marked pending in THIS turn
  },
  "concerns": string[]                      // any compliance or pricing concerns (shown to operator only, not the owner)
}

# Current section guidance
For each section, capture exactly the fields listed below. Use null + status:"pending" for fields the owner doesn't supply.

${Object.entries(SECTION_FIELD_GUIDANCE)
  .map(([k, v]) => `## ${k}\n${v}`)
  .join("\n\n")}

# Worked example (excerpt)
Owner: "Our spa is Glow Aesthetics. We're at 123 Main St, San Francisco. We close at 7pm weekdays and 5pm Saturdays, closed Sunday. After hours we just take messages."
You respond:
{
  "reply": "Got it — Glow Aesthetics in San Francisco, weekdays 9–7 and Saturday 10–5, closed Sunday. What timezone should the AI use?",
  "section": "hours",
  "action": "ask",
  "captured": {
    "hours": {
      "schedule": [
        { "day": "Mon", "open": true,  "from": "09:00", "to": "19:00" },
        { "day": "Tue", "open": true,  "from": "09:00", "to": "19:00" },
        { "day": "Wed", "open": true,  "from": "09:00", "to": "19:00" },
        { "day": "Thu", "open": true,  "from": "09:00", "to": "19:00" },
        { "day": "Fri", "open": true,  "from": "09:00", "to": "19:00" },
        { "day": "Sat", "open": true,  "from": "10:00", "to": "17:00" },
        { "day": "Sun", "open": false, "from": "09:00", "to": "17:00" }
      ],
      "afterHoursMessage": "We capture leads after hours and follow up the next business morning."
    }
  },
  "concerns": []
}

# Final review
When you reach action: "finish", the platform shows the owner the full KB for one-click confirmation. You don't need to repeat the KB in your reply.

Begin.`
}

export function buildSetupAssistantUserTurn(input: SetupAssistantTurnInput): string {
  const { history, userMessage, currentSection, draft, ownerName, spaName } = input
  const isFirst = history.length === 0
  const intro = isFirst
    ? `This is the first turn. Greet the owner${ownerName ? ` by first name "${ownerName.split(" ")[0]}"` : ""}${spaName ? ` and acknowledge "${spaName}"` : ""}. Briefly say what we'll do (9 short sections, ~5 minutes), then start with the first required field of the "business" section.`
    : `Stay strictly on the "${currentSection}" section. Do not jump ahead.`

  const draftExcerpt = excerptDraft(draft, currentSection)

  return `${intro}

# Context
- current_section: ${currentSection}
- next_section: ${nextSectionOf(currentSection)}
- owner_first_name: ${ownerName ? ownerName.split(" ")[0] : "unknown"}
- spa_name_hint: ${spaName || "unknown"}

# Running draft (for the section you're on)
${draftExcerpt}

# Owner's latest message
${JSON.stringify(userMessage)}

# Output
Respond with the strict JSON object described in your system prompt. End "reply" with a question or summary. Set action to "summarize" when you have all required fields for this section. Set action to "advance" only after the owner confirms the section summary.`
}

function excerptDraft(draft: KnowledgeBase, section: SetupAssistantSection): string {
  const json = JSON.stringify((draft as Record<string, unknown>)[section] ?? {}, null, 2)
  return json.length > 2400 ? json.slice(0, 2400) + "\n…(truncated)" : json
}

export const SETUP_ASSISTANT_SECTION_KEYS = SETUP_ASSISTANT_SECTIONS
export { nextSectionOf }
