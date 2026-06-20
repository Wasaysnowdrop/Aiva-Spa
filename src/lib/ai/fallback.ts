import { retrieve, type KnowledgeBundle } from "./retrieval"

const OFF_TOPIC_PATTERNS: RegExp[] = [
  // Explicit medical-advice / prescription requests (R3 violations)
  /\b(recommend|suggest|prescribe|tell me (what|which))\b[^.\n]{0,60}\b(medicine|medication|drug|pill|tablet|antibiotic|painkiller|antacid|syrup|cream|ointment|injection|vaccine)\b/i,
  /\b(can|could|may|should|do)\b[^.\n]{0,30}\bi (take|use|drink|eat|try)\b/i,
  // Symptom-driven medical advice
  /\b(belly|stomach|head|back|chest|leg|arm|tooth|ear|throat|muscle)\s*(pain|ache|cramps?)\b/i,
  /\b(i have|i've got|i'm having|i am having)\b[^.\n]{0,80}\b(pain|ache|fever|cough|cold|nausea|diarrh?oea|vomit|rash|itch|swell)\b/i,
  /\bdiagnos(e|is)\b/i,
  /\b(what|which)\b[^.\n]{0,40}\b(condition|disease|illness|infection)\b[^.\n]{0,30}\bdo i have\b/i,
  // Home remedies / non-spa medical topics
  /\bhome remed(y|ies)\b/i,
  // Pure non-spa trivia
  /\b(capital of|president of|prime minister|weather in|cricket score|football score)\b/i,
]

// Booking intent — needs the form, not a KB answer.
const BOOKING_RE = /\b(book|booking|appointment|consult(ation)?|schedule|reserve|availability)\b/i

// Pricing intent — always defer to provider.
const PRICING_RE = /\b(price|pricing|cost|how much|expensive|cheap|afford|rate|fee)\b/i

// Hours intent.
const HOURS_RE = /\b(hours?|open|close|opening|closing|when (are|do)|what time)\b/i

// Off-topic refusal — always grounded in the spa's actual services so the
// reply still feels useful rather than a flat "I can't help with that".
function buildOffTopicReply(kb: KnowledgeBundle): string {
  const brand = kb.widget.brandName
  const active = kb.services.filter((s) => s.active)
  const names = active.slice(0, 4).map((s) => s.name)
  const list =
    names.length === 0
      ? "our treatments"
      : names.length === 1
        ? names[0]
        : names.length === 2
          ? `${names[0]} and ${names[1]}`
          : `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`
  return `That's outside what we do at ${brand} — I'm not able to recommend medicines or give medical advice. We focus on ${list}. Want to chat about any of those, or set up a consult?`
}

// KB-grounded fallback used when the LLM is unavailable (timeout, error,
// missing key, mocked). Synchronous + cached, so it returns instantly.
export function kbAwareFallback(
  message: string,
  kb: KnowledgeBundle,
): string {
  const text = (message || "").trim()
  if (!text) return "Hey — what can I help you with today?"

  // 1. Off-topic / medical-advice → polite refusal grounded in real services.
  if (OFF_TOPIC_PATTERNS.some((re) => re.test(text))) {
    return buildOffTopicReply(kb)
  }

  // 2. Try to retrieve a relevant KB entry for this exact message.
  const items = retrieve(text, kb, 3)
  if (items.length > 0) {
    const top = items[0]
    if (top.kind === "faq") {
      return top.faq.answer
    }
    const svc = top.service
    const desc = svc.description ? ` ${svc.description}` : ""
    return `Yes — ${svc.name} is one of our treatments.${desc} Pricing and what's right for you get confirmed during a consultation. Want me to set one up?`
  }

  // 3. Booking intent.
  if (BOOKING_RE.test(text)) {
    return "Happy to help you book. Could you share your name, phone, and the treatment you're interested in? Our team will confirm within 1 business hour."
  }

  // 4. Pricing intent.
  if (PRICING_RE.test(text)) {
    return "Pricing varies by treatment and individual needs — a licensed provider confirms exact pricing during your consultation. Want to book a free consult?"
  }

  // 5. Hours intent.
  if (HOURS_RE.test(text)) {
    return "Our typical hours are Tue–Fri 9 AM–7 PM, Sat 9 AM–5 PM, and Sun 11 AM–4 PM (closed Mon). I'm here 24/7, and the team will follow up on any leads."
  }

  // 6. Generic — anchor to the first active service so the reply feels grounded.
  const topService = kb.services.find((s) => s.active)?.name
  if (topService) {
    return `Happy to help — we focus on treatments like ${topService}. What's on your mind?`
  }

  return "Happy to help — what would you like to know more about?"
}

// Returns true when the message looks like it's clearly outside the spa's
// scope (medical advice, off-topic trivia, etc.). Used by callers that want
// to short-circuit before even hitting the LLM for an obvious refusal.
export function isOffTopicMessage(message: string): boolean {
  const text = (message || "").trim()
  if (!text) return false
  return OFF_TOPIC_PATTERNS.some((re) => re.test(text))
}