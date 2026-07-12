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

// Medical emergency signals — these trigger an immediate, urgent response
// BEFORE any other flow (lead capture, pricing, etc.).
const EMERGENCY_PATTERNS: RegExp[] = [
  /\b(trouble|difficulty|can'?t|cant|cannot)\b[^.\n]{0,40}\b(breath|breathing|breathe)\b/i,
  /\bshort(ness)? of breath\b/i,
  /\bsevere (swelling|allergic|bleeding|reaction)\b/i,
  /\b(allergic|anaphyla\w*)\s*(reaction|shock)\b/i,
  /\b(chest pain|chest tightness|cardiac|heart attack)\b/i,
  /\b(loss of consciousness|lost consciousness|passed out|fainting|faint(ed)?|unconscious)\b/i,
  /\bswelling (of|in|around)\b[^.\n]{0,40}\b(throat|tongue|lips?|eyes?|face|airway)\b/i,
  /\b(can'?t|cant|cannot)\b[^.\n]{0,20}\b(swallow|breath)\b/i,
  /\binfection\b[^.\n]{0,40}\b(spreading|spreading|fever|red streaks|worsening)\b/i,
  /\bseptic\b/i,
  /\bsuicid(al|e)\b/i,
]

// Out-of-scope / unknown service signals — used when the visitor asks about a
// specific named treatment we don't carry. We never say "we don't offer X"
// (we may not have every treatment in the KB); we offer to submit a request.
const UNKNOWN_SERVICE_HINTS = [
  /\b(teeth|tooth)\b[^.\n]{0,40}\b(whitening|straightening|aligners|braces|veneers|implants)\b/i,
  /\b(rhinoplasty|hair transplant|tummy tuck|liposuction|breast augmentation|breast reduction)\b/i,
  /\b(weight loss|ozempic|semaglutide|phentermine|cool sculpting|coolsculpting|keto|diet pill)\b/i,
]

const NAMED_SERVICE_QUESTION_RE =
  /\b(do you (offer|have|do)|is .{2,80} (available|offered)|tell me about|benefits? of|downtime (for|of)|price (for|of))\b/i

const GENERIC_SERVICE_LIST_RE =
  /\b(what (services|treatments|offerings?)|what do you offer|list (your )?(services|treatments)|all (the )?(services|treatments|offerings?))\b/i

export function isUnknownServiceQuestion(message: string): boolean {
  const text = (message || "").trim()
  if (GENERIC_SERVICE_LIST_RE.test(text)) return false
  return NAMED_SERVICE_QUESTION_RE.test(text)
}

const BOOKING_RE = /\b(book|booking|appointment|consult(ation)?|schedule|reserve|reserved|availability)\b/i
const PRICING_RE = /\b(price|pricing|cost|how much|expensive|cheap|afford|rate|fee)\b/i
const HOURS_RE = /\b(hours?|open|close|opening|closing|when (are|do)|what time)\b/i

// Exact-unit / dosing medical requests — refuse, never invent. Matches a
// wide variety of phrasings (units/cc/ml/dosage before or after the
// treatment name).
const EXACT_UNIT_REQUESTS: RegExp[] = [
  // "how many units of botox", "what dosage of dysport", "how much filler in cc"
  /\b(how many|how much|what|which)\b[^.\n]{0,40}\b(units?|cc|ml|millilit\w*|syringes?|vials?|dosage|dose|amount)\b[^.\n]{0,40}\b(botox|fillers?|juvederm|restylane|xeomin|dysport|sculptra|kybella|botulinum)\b/i,
  // "units of botox", "dosage of dysport", "cc of filler"
  /\b(units?|cc|ml|millilit\w*|syringes?|vials?|dosage|dose|amount)\b[^.\n]{0,40}\b(of|for|in)\b[^.\n]{0,40}\b(botox|fillers?|juvederm|restylane|xeomin|dysport|sculptra|kybella|botulinum)\b/i,
  // "botox units", "filler dosage", "dysport amount"
  /\b(botox|fillers?|juvederm|restylane|xeomin|dysport|sculptra|kybella|botulinum)\b[^.\n]{0,40}\b(units?|dosage|dose|cc|ml|amount|specific number)\b/i,
  // "exact units", "exact dosage"
  /\bexact (units?|amount|dose|dosage|number)\b/i,
]// Pregnancy / breastfeeding / health-state safety questions — no medical advice.
const PREGNANCY_RE =
  /\b(pregnan\w*|breast\s*feed\w*|nursing|lactating|trying to conceive|ttc)\b/i

const EMERGENCY_REPLY =
  "This may be a medical emergency. Please seek urgent medical attention or contact emergency services immediately. Do not wait — your safety comes first, and a med spa cannot evaluate or treat emergencies."

// KB-grounded fallback used when the LLM is unavailable (timeout, error,
// missing key, mocked). Synchronous + cached, so it returns instantly.
export function kbAwareFallback(
  message: string,
  kb: KnowledgeBundle,
): string {
  const text = (message || "").trim()
  if (!text) return "Hey — what can I help you with today?"

  // 0. Emergency — always first, never blocked by anything else.
  if (isEmergencyMessage(text)) {
    return EMERGENCY_REPLY
  }

  // 1. Off-topic / medical-advice → polite refusal grounded in real services.
  if (OFF_TOPIC_PATTERNS.some((re) => re.test(text))) {
    return buildOffTopicReply(kb)
  }

  // 2. Exact-unit / dosing medical request → refuse.
  if (EXACT_UNIT_REQUESTS.some((re) => re.test(text))) {
    return buildExactUnitRefusal()
  }

  // 3. Pregnancy / breastfeeding → no medical advice, defer to provider.
  if (PREGNANCY_RE.test(text)) {
    return buildPregnancyReply(kb)
  }

  // 4. Visitor names a service we don't appear to have in the KB → never
  //    deny or invent; offer to submit a consultation request.
  //    Checked BEFORE retrieval so a query like "Do you offer CoolSculpting?"
  //    isn't accidentally answered by a stored FAQ for a different service
  //    that just happens to share words like "offer".
  if (UNKNOWN_SERVICE_HINTS.some((re) => re.test(text))) {
    return buildUnknownServiceReply(kb)
  }

  // 5. Try to retrieve a relevant KB entry for this exact message.
  const items = retrieve(text, kb, 3)
  if (items.length > 0) {
    const top = items[0]
    if (top.kind === "faq") {
      return sanitizeReply(top.faq.answer)
    }
    const svc = top.service
    const desc = svc.description ? ` ${svc.description}` : ""
    return sanitizeReply(
      `Yes — ${svc.name} is one of our treatments.${desc} Pricing is confirmed at consultation by a licensed provider. Let me know if you'd like pricing information or have any other questions about it!`,
    )
  }

  // A named treatment/service question with no KB match must never fall
  // through to a generic service. That would make an unrelated approved
  // treatment look like the answer to the visitor's question.
  if (isUnknownServiceQuestion(text)) {
    return buildUnknownServiceReply(kb)
  }

  // 6. Booking intent — never confirm; always request-submit language.
  if (BOOKING_RE.test(text)) {
    return buildBookingReply()
  }

  // 7. Pricing intent.
  if (PRICING_RE.test(text)) {
    return "Pricing varies by treatment and individual needs — a licensed provider confirms exact pricing during your consultation. Let me know if you'd like to request a consultation or have other questions."
  }

  // 8. Hours intent — pull from the spa's actual working hours, never hardcode.
  if (HOURS_RE.test(text)) {
    const wh = kb.widget.workingHours
    if (wh?.enabled && Array.isArray(wh.schedule) && wh.schedule.length > 0) {
      const open = wh.schedule.filter((d) => d.open)
      const dayLines = open.map((d) => `${d.day} ${d.from}–${d.to}`)
      if (dayLines.length > 0) {
        const tz = wh.tz ? ` (${wh.tz})` : ""
        return `We're open ${dayLines.join(", ")}${tz}. Feel free to stop by or let me know if you'd like to request a consultation.`
      }
    }
    return "Hours vary — drop your details and our team will confirm a time that works for you."
  }

  // 9. Visitor is asking about available services / treatments / offerings.
  const WHAT_SERVICES_RE =
    /\b(what (services|treatments|offering|do you (offer|have|do))|list (your )?(services|treatments)|all (the )?(services|treatments|offerings)|whats? (available|offered))\b/i
  if (WHAT_SERVICES_RE.test(text)) {
    const activeServices = kb.services.filter((s) => s.active)
    if (activeServices.length > 0) {
      const names = activeServices.map((s) => s.name)
      const list =
        names.length === 1
          ? names[0]!
          : names.length === 2
            ? `${names[0]} and ${names[1]}`
            : `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`
      return `We offer ${list}. I'd be happy to tell you more about any of these or share pricing information.`
    }
    return "I'd be happy to help you explore our services. What are you looking for?"
  }

  // 10. Generic — anchor to the first active service so the reply feels grounded.
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
  if (isEmergencyMessage(text)) return false // emergencies are their own bucket
  return OFF_TOPIC_PATTERNS.some((re) => re.test(text))
}

// True when the message signals a likely medical emergency. Always checked
// before any other intent — emergencies must NEVER be turned into lead capture.
export function isEmergencyMessage(message: string): boolean {
  const text = (message || "").trim()
  if (!text) return false
  return EMERGENCY_PATTERNS.some((re) => re.test(text))
}

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
  return `That's outside what we do at ${brand} — I'm not able to recommend medicines or give medical advice. We focus on ${list}. Let me know if you're interested in exploring any of those.`
}

// Refuse exact-unit / dosing requests politely. Never invent a number; defer
// to the provider at consultation.
function buildExactUnitRefusal(): string {
  return `I can't recommend specific units or amounts — that's something a licensed provider decides based on your anatomy and goals at the consultation. Let me know if you'd like to request a consultation so the team can discuss what's best for you.`
}

// Pregnancy / breastfeeding / TTC — general safety, no medical advice.
function buildPregnancyReply(kb: KnowledgeBundle): string {
  const brand = kb.widget.brandName
  return `That's something a licensed provider needs to weigh — I can't give medical advice, and many treatments have specific considerations around pregnancy or nursing. Want me to submit a consultation request so the ${brand} team can confirm what's appropriate for you?`
}

// Out-of-scope / unknown service reply — never invent, never deny outright.
function buildUnknownServiceReply(kb: KnowledgeBundle): string {
  const brand = kb.widget.brandName
  return `I don't have confirmed information about that service in my knowledge base. I can help you submit a consultation request and our ${brand} team can confirm availability and details.`
}

// Booking / consultation-request intent — never claim a booking. Always
// language around "request submitted, team confirms".
function buildBookingReply(): string {
  return "Happy to help. To submit a consultation request, I'll need your name, phone, email, the service you're interested in, your preferred date/time, and any notes or goals you'd like the provider to know. Our team will review and reach out to confirm availability."
}

// Strip any language that claims a booking / appointment has been confirmed.
// Defensive: even if a stale FAQ or service description slipped through with
// booking-confirmation phrasing, we soften it so we never overstate.
function sanitizeReply(text: string): string {
  if (!text) return text
  let out = text
  const replacements: Array<[RegExp, string]> = [
    [/\bbooking confirmed\b/gi, "consultation request submitted"],
    [/\bappointment confirmed\b/gi, "consultation request received"],
    [/\byou(?:'?re| are) booked\b/gi, "your request has been received"],
    [/\byour appointment is scheduled\b/gi, "your request has been received"],
    [/\bwe reserved your slot\b/gi, "we've received your request"],
    [/\bappointment successfully scheduled\b/gi, "consultation request received"],
    [/\bappointment is booked\b/gi, "consultation request is received"],
    [/\bappointment booked\b/gi, "consultation request received"],
  ]
  for (const [re, sub] of replacements) {
    out = out.replace(re, sub)
  }
  return out
}
