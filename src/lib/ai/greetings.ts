// Lightweight, deterministic greeting detection so the AI never launches into
// lead-capture on a visitor's first message. The model still handles the
// rest of the conversation.
const PURE_GREETING = new RegExp(
  [
    "^\\s*",
    "(",
    "hi(ya| there| all| team)?",
    "|hey( there| all| team)?",
    "|hello( there)?",
    "|hola",
    "|howdy",
    "|yo[!.,?\\s):]*",
    "|good (morning|afternoon|evening|night)",
    "|how('?s| is) it going",
    "|how are (you|u|ya|ya'll|ya'll doing)",
    "|what'?s up|sup\\b|whats up",
    "|nice to (meet|chat|talk)",
    ")+",
    "[!.,?\\s):]*$",
  ].join(""),
  "i",
)

const THANKS_ONLY = /^\s*(thanks|thank you|thx|ty|tyvm|appreciate(d)? it|cheers)\b[!.\s]*$/i

const SMALL_TALK: Array<{ pattern: RegExp; reply: string }> = [
  {
    pattern: /\bwho (are|r) (u|you)\b|\bwhat (are|r) (u|you)\b|\byour name\b/i,
    reply:
      "I'm AivaSpa — the front-desk person here. I help with treatment questions and booking consults. What brings you in today?",
  },
  {
    pattern: /\bare (u|you) (a |an )?(bot|ai|robot|human|real)\b|\bam i (talking|speaking|chatting) (to )?(a |an )?(bot|ai|human|robot|real)/i,
    reply:
      "I'm the team's receptionist — I work with the spa directly. What can I help you with today?",
  },
  {
    pattern: /\b(can|do) (u|you) (help|hear me|see this)\b/i,
    reply:
      "Of course — I'm here. What's on your mind?",
  },
  {
    pattern: /\b(are|r) (u|you) (there|around|free|busy)\b|\banyone (there|home|here)\b/i,
    reply:
      "I'm here. What can I help you with?",
  },
  {
    pattern: /\btest\b|\bjust (checking|testing)\b/i,
    reply:
      "Hey — I'm working. What can I help you with?",
  },
]

const FIRST_TURN_FOLLOWUPS = [
  "What brings you in today?",
  "Are you looking into a specific treatment, or just exploring?",
  "Got anything specific on your mind — treatments, pricing, hours?",
  "What's prompting the visit today?",
]

const RETURNING_FOLLOWUPS = [
  "Anything else I can help with?",
  "What else is on your mind?",
]

const FOLLOWUP_OPENERS_REGULAR = [
  "Hi there",
  "Hey",
  "Hello",
  "Hey there",
]

const FOLLOWUP_OPENERS_AFTER_HOURS = [
  "Hi there",
  "Hey",
]

function pickFirst<T>(arr: readonly T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length] as T
}

function pickFollowup(seed: number, afterHours: boolean): string {
  const list = afterHours ? RETURNING_FOLLOWUPS : FIRST_TURN_FOLLOWUPS
  return pickFirst(list, seed)
}

function pickOpener(seed: number, afterHours: boolean): string {
  const list = afterHours ? FOLLOWUP_OPENERS_AFTER_HOURS : FOLLOWUP_OPENERS_REGULAR
  return pickFirst(list, seed)
}

export type GreetingReply = {
  matched: true
  reply: string
  reason: "pure_greeting" | "small_talk" | "thanks"
}

export type GreetingResult = GreetingReply | { matched: false }

export function detectHumanGreeting(
  message: string,
  options: { isFirstReply: boolean; afterHours: boolean },
): GreetingResult {
  const text = message.trim()
  if (!text) return { matched: false }
  if (text.length > 80) return { matched: false }
  if (PURE_GREETING.test(text)) {
    return {
      matched: true,
      reply: buildGreetingReply(text, options),
      reason: "pure_greeting",
    }
  }
  if (THANKS_ONLY.test(text)) {
    return {
      matched: true,
      reply: "Anytime! Let me know if anything else comes up.",
      reason: "thanks",
    }
  }
  for (const slot of SMALL_TALK) {
    if (slot.pattern.test(text)) {
      return {
        matched: true,
        reply: buildGreetingReply(text, options, slot.reply),
        reason: "small_talk",
      }
    }
  }
  return { matched: false }
}

function buildGreetingReply(
  text: string,
  options: { isFirstReply: boolean; afterHours: boolean },
  prefixOverride?: string,
): string {
  const seed = text.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  const opener = prefixOverride
    ? prefixOverride
    : `${pickOpener(seed, options.afterHours)}${endsWithPunctuation(text) ? "" : options.isFirstReply ? " —" : "."}`
  const followup = pickFollowup(seed, options.afterHours)
  if (options.isFirstReply) {
    return `${opener} ${followup}`
  }
  return `${opener} ${followup}`
}

function endsWithPunctuation(text: string): boolean {
  return /[!.?]$/.test(text.trim())
}
