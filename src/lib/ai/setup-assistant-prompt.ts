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
  explicitEdit?: boolean
  spaName?: string
  submissionId?: string
  messageId?: string
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
- name (required) — the business/spa name. If the user says "Our spa is X", "We are X", "We're called X", extract the name. "name" is the exact schema key — do NOT use "spa_name".
- website (required for Step 1 completion) — URL or domain. Look for patterns like "our website is X" or "X.com".
- addresses (at least one required for Step 1 completion): array of {line1, line2, city, region, postal, country}. Extract the full street address and city/region.
- business_type (optional) — e.g., "single-location med spa", "multi-location". Capture if the owner mentions it.
- afterHoursPolicy: a short sentence describing what happens after hours (e.g., "We capture leads and follow up the next business morning."). If the owner says "skip" or "I don't know", set status to "pending".`,
  hours: `
- timezone: IANA tz string. Leave it empty until the owner explicitly supplies a timezone. Extract common formats such as PST, EST, CST, MST, or Asia/Karachi. If explicitly stated, ALWAYS capture it and never ask again.
- open247: boolean (true if the spa is 24/7)
- schedule: array of exactly 7 entries, one per day Mon..Sun
    { day: "Mon"|"Tue"|...|"Sun", open: boolean, from: "HH:MM", to: "HH:MM" }
- afterHoursMessage: short message the AI uses after hours (optional)`,
  services: `
- captured.services MUST be a direct JSON array: [{ name, category, description, duration, priceRange? }]. Never wrap it in another object.
  - category must be one of: Injectables, Skin, Body, Laser, Other
  - description: 1–2 sentence client-friendly description (no medical claims)
  - duration: e.g. "30 min" (optional)
  - priceRange: { min, max, currency, unit, indicativeOnly: true } — OPTIONAL, only include if the owner explicitly gives a range
- NEVER capture a single fixed price as "price". Always wrap it in priceRange with indicativeOnly: true, or omit and note "confirmed at consultation".`,
  booking_policy: `
- consultationMode: "manual_follow_up" | "calendar_link" | "self_book_online"
- calendarLink: valid URL string or "" when absent. NEVER output null.
- deposit: { required: boolean, amount?, currency: "USD", refundable: boolean, notes }
- cancellation: { noticeHours?, feePolicy, notes }`,
  faqs: `
- captured.faqs MUST be a direct JSON array: [{ question, answer, category }]. Never wrap it in another object.
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
4. If the owner refuses, says "skip", or does not know: NEVER fabricate and NEVER output null. Omit optional fields, use an empty string/array where the schema allows it, or use the literal string "pending" only for business fields that support it.
5. Collect ONE topic at a time. The current section is provided in the user message. Stay on that section until its required fields are captured or marked pending, then output action: "advance" and the platform will switch sections.
6. As soon as the running draft plus the latest answer contains every field requested for the current section, output action: "advance" immediately and ask the first question for the next section. Never ask the owner to reconfirm a complete section.
7. Ask exactly ONE missing field at a time. Keep the reply to 1–2 short sentences with one clear question; never bundle several questions together.
8. Sections in order: business → hours → services → booking_policy → faqs → disclaimers → brand_voice → notifications → review. The platform passes you the current section; do not skip ahead unless the owner explicitly asks.
9. If the owner goes off-topic, gently redirect: "Happy to cover that — first, can we finish {current section}?"
10. Tone: warm, premium, concise. Never use emojis. Address the owner by first name if you have it.

# Response JSON schema
Every value must match the listed type exactly. Never output null anywhere in captured data.

{
  "reply": string,                          // 1–3 sentences shown to the owner, ends with a question or summary
  "section": string,                        // current section key (echo back)
  "action": "ask" | "summarize" | "advance" | "finish",
  "captured": {                             // partial update merged into the running KB
    // Use the exact TOP-LEVEL KB key for the current section.
    // business -> { "business": {...} }
    // hours -> { "hours": {...} }
    // services -> { "services": [...] } (DIRECT ARRAY; never { "services": { "services": [...] } })
    // booking_policy -> { "booking_policy": {...} }
    // faqs -> { "faqs": [...] } (DIRECT ARRAY)
    // disclaimers -> { "disclaimers": {...} }
    // brand_voice -> { "brand_voice": {...} }
    // notifications -> { "notifications": {...} }
    // review -> {}
  },
  "concerns": string[]                      // any compliance or pricing concerns (shown to operator only, not the owner)
}

# Current section guidance
For each section, capture exactly the fields listed below. Never output null; omit optional fields or use the allowed empty/pending value.

${Object.entries(SECTION_FIELD_GUIDANCE)
  .map(([k, v]) => `## ${k}\n${v}`)
  .join("\n\n")}

# Worked example — Business basics (first user message)
User: "Glow Aesthetics, glowaesthetics.com, 123 Main Street, San Francisco, CA. We are a single-location med spa."
Correct response:
{
  "reply": "Got it. I saved Glow Aesthetics, glowaesthetics.com, and 123 Main Street, San Francisco, CA. Next, what are your business hours and timezone?",
  "section": "business",
  "action": "advance",
  "captured": {
    "business": {
      "name": "Glow Aesthetics",
      "website": "glowaesthetics.com",
      "addresses": [{ "line1": "123 Main Street", "city": "San Francisco", "region": "CA", "country": "US" }],
      "business_type": "single-location med spa",
      "afterHoursPolicy": "pending"
    }
  },
  "concerns": []
}

# Worked example — Hours with timezone inline
User: "We are open Monday to Friday from 10 AM to 6 PM, Saturday from 10 AM to 3 PM, and closed on Sunday. Our timezone is America/Los_Angeles."
Correct response:
{
  "reply": "Got it. I saved your business hours and timezone (America/Los_Angeles). Next, what services do you offer and what are your starting prices?",
  "section": "hours",
  "action": "advance",
  "captured": {
    "hours": {
      "timezone": "America/Los_Angeles",
      "open247": false,
      "schedule": [
        { "day": "Mon", "open": true, "from": "10:00", "to": "18:00" },
        { "day": "Tue", "open": true, "from": "10:00", "to": "18:00" },
        { "day": "Wed", "open": true, "from": "10:00", "to": "18:00" },
        { "day": "Thu", "open": true, "from": "10:00", "to": "18:00" },
        { "day": "Fri", "open": true, "from": "10:00", "to": "18:00" },
        { "day": "Sat", "open": true, "from": "10:00", "to": "15:00" },
        { "day": "Sun", "open": false, "from": "09:00", "to": "17:00" }
      ]
    }
  },
  "concerns": []
}

# Worked example — Timezone in abbreviation format
User: "We're open weekdays 9-5 and weekends 10-4, Pacific Time."
Correct response:
{
  "reply": "Got it. I saved your hours and timezone (America/Los_Angeles). What services do you offer?",
  "section": "hours",
  "action": "advance",
  "captured": {
    "hours": {
      "timezone": "America/Los_Angeles",
      "open247": false,
      "schedule": [
        { "day": "Mon", "open": true, "from": "09:00", "to": "17:00" },
        { "day": "Tue", "open": true, "from": "09:00", "to": "17:00" },
        { "day": "Wed", "open": true, "from": "09:00", "to": "17:00" },
        { "day": "Thu", "open": true, "from": "09:00", "to": "17:00" },
        { "day": "Fri", "open": true, "from": "09:00", "to": "17:00" },
        { "day": "Sat", "open": true, "from": "10:00", "to": "16:00" },
        { "day": "Sun", "open": true, "from": "10:00", "to": "16:00" }
      ]
    }
  },
  "concerns": []
}

# Final review
When you reach action: "finish", the platform shows the owner the full KB for one-click confirmation. You don't need to repeat the KB in your reply.

Begin.`
}

const RESUME_QUESTION: Record<SetupAssistantSection, string> = {
  business:
    "What is your business name?",
  hours:
    "What are your regular business hours, including closed days?",
  services:
    "What services do you offer?",
  booking_policy:
    "How should consultation requests be handled?",
  faqs:
    "What is one common visitor question and its approved answer?",
  disclaimers:
    "Should I use the standard pricing, medical, and consent disclaimers?",
  brand_voice:
    "What tone should your receptionist use?",
  notifications:
    "Which email address should receive new-lead notifications?",
  review:
    "Is everything correct and ready to save?",
}
export function buildSetupAssistantSectionQuestion(
  section: SetupAssistantSection,
): string {
  return RESUME_QUESTION[section]
}


export function buildSetupAssistantResumeMessage(
  section: SetupAssistantSection,
  firstName = "",
): string {
  const welcome = section === "business" ? "Welcome" : "Welcome back"
  const name = firstName.trim() ? `, ${firstName.trim()}` : ""
  return `${welcome}${name}. ${RESUME_QUESTION[section]}`
}

export function buildSetupAssistantUserTurn(input: SetupAssistantTurnInput): string {
  const { history, userMessage, currentSection, draft, ownerName, spaName } = input
  const isFirst = !history.some(m => m.role === "user")
  const intro = isFirst
    ? `This is the first user message. Extract ALL information they provide and save it in "captured", even if they answer multiple fields at once. Ask exactly ONE short question for the first missing field. If the section becomes complete, set action to "advance" immediately and ask one short question from the next section. NEVER ask for a field the user just provided.`
    : `Stay strictly on the "${currentSection}" section. Ask exactly ONE short question for the first missing field. If the running draft plus this answer completes the section, set action to "advance" immediately; never request another confirmation.`

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
Respond with the strict JSON object described in your system prompt. Ask one short question only. Set action to "advance" as soon as the current section is complete, and never repeat a confirmation for a complete section.`
}

function excerptDraft(draft: KnowledgeBase, section: SetupAssistantSection): string {
  const json = JSON.stringify((draft as Record<string, unknown>)[section] ?? {}, null, 2)
  return json.length > 2400 ? json.slice(0, 2400) + "\n…(truncated)" : json
}

export const SETUP_ASSISTANT_SECTION_KEYS = SETUP_ASSISTANT_SECTIONS
export { nextSectionOf }
