import { z } from "zod"

export const SETUP_ASSISTANT_SECTIONS = [
  "business",
  "hours",
  "services",
  "booking_policy",
  "faqs",
  "disclaimers",
  "brand_voice",
  "notifications",
  "review",
] as const

export type SetupAssistantSection = (typeof SETUP_ASSISTANT_SECTIONS)[number]

const PENDING_OBJ = z
  .object({ value: z.string().max(500), status: z.enum(["captured", "pending", "refused"]) })
  .or(z.string())
  .or(z.literal("pending"))

export const businessSchema = z.object({
  name: PENDING_OBJ.optional(),
  website: z.string().max(500).optional().default(""),
  addresses: z
    .array(
      z.object({
        line1: z.string().max(200),
        line2: z.string().max(200).optional().default(""),
        city: z.string().max(120).optional().default(""),
        region: z.string().max(120).optional().default(""),
        postal: z.string().max(40).optional().default(""),
        country: z.string().max(80).optional().default(""),
      }),
    )
    .max(10)
    .optional()
    .default([]),
  afterHoursPolicy: z.string().max(500).optional().default("pending"),
})

export const hoursSchema = z.object({
  timezone: z.string().max(80).default("America/Los_Angeles"),
  schedule: z
    .array(
      z.object({
        day: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
        open: z.boolean(),
        from: z.string().regex(/^\d{2}:\d{2}$/).optional().default("09:00"),
        to: z.string().regex(/^\d{2}:\d{2}$/).optional().default("17:00"),
      }),
    )
    .max(7)
    .optional()
    .default([]),
  afterHoursMessage: z.string().max(500).optional().default(""),
  open247: z.boolean().optional().default(false),
})

export const serviceSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.enum(["Injectables", "Skin", "Body", "Laser", "Other"]),
  description: z.string().min(1).max(500),
  duration: z.string().max(80).optional().default(""),
  priceRange: z
    .object({
      min: z.number().nonnegative(),
      max: z.number().nonnegative(),
      currency: z.string().max(8).default("USD"),
      unit: z.string().max(40).default("per session"),
      indicativeOnly: z.boolean().default(true),
    })
    .optional(),
})

export const servicesSchema = z
  .array(serviceSchema)
  .max(100)
  .optional()
  .default([])

export const bookingPolicySchema = z.object({
  consultationMode: z.enum(["manual_follow_up", "calendar_link", "self_book_online"])
    .optional()
    .default("manual_follow_up"),
  calendarLink: z.string().url().or(z.literal("")).optional().default(""),
  deposit: z.object({
    required: z.boolean().default(false),
    amount: z.number().nonnegative().optional(),
    currency: z.string().max(8).default("USD"),
    refundable: z.boolean().default(true),
    notes: z.string().max(400).optional().default(""),
  }),
  cancellation: z.object({
    noticeHours: z.number().int().nonnegative().optional(),
    feePolicy: z.string().max(400).optional().default(""),
    notes: z.string().max(400).optional().default(""),
  }),
})

export const faqSchema = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(2000),
  category: z.enum(["General", "Pricing", "Booking", "Safety", "Hours"]).default("General"),
})

export const faqsSchema = z.array(faqSchema).max(50).optional().default([])

export const disclaimersSchema = z.object({
  standardAccepted: z.boolean().default(true),
  pricing: z.string().max(400).default(
    "Pricing varies by treatment and individual needs. A licensed provider confirms exact pricing during your consultation.",
  ),
  medical: z.string().max(400).default(
    "Information provided is general and not medical advice. A licensed provider confirms treatment suitability and outcomes during your consultation.",
  ),
  consent: z.string().max(1000).default(
    "By chatting with us you agree to be contacted about your inquiry. See our privacy policy for how we handle your data.",
  ),
})

export const brandVoiceSchema = z.object({
  tone: z.enum(["formal", "warm", "casual", "playful", "luxury"]).default("warm"),
  customTone: z.string().max(200).optional().default(""),
  greeting: z.string().min(1).max(400).default(
    "Hi! Are you looking to book a consultation or ask about a treatment?",
  ),
  avoidPhrases: z.array(z.string().max(120)).max(20).optional().default([]),
  preferPhrases: z.array(z.string().max(120)).max(20).optional().default([]),
})

export const notificationsSchema = z.object({
  emailRecipients: z.array(z.string().email()).max(20).optional().default([]),
  smsRecipients: z.array(z.string().regex(/^\+?[0-9 ()-]{7,20}$/)).max(20).optional().default([]),
  escalationEmail: z.string().email().or(z.literal("")).optional().default(""),
  escalationPhone: z
    .string()
    .regex(/^\+?[0-9 ()-]{7,20}$/)
    .or(z.literal(""))
    .optional()
    .default(""),
  channels: z
    .object({
      email: z.boolean().default(true),
      sms: z.boolean().default(false),
    })
    .optional()
    .default({ email: true, sms: false }),
  quietHours: z
    .object({
      enabled: z.boolean().default(false),
      from: z.string().regex(/^\d{2}:\d{2}$/).optional().default("22:00"),
      to: z.string().regex(/^\d{2}:\d{2}$/).optional().default("08:00"),
    })
    .optional()
    .default({ enabled: false, from: "22:00", to: "08:00" }),
})

export const knowledgeBaseSchema = z.object({
  version: z.literal(1).default(1),
  generatedAt: z.string().datetime().optional(),
  business: businessSchema.optional(),
  hours: hoursSchema.optional(),
  services: servicesSchema,
  booking_policy: bookingPolicySchema.optional(),
  faqs: faqsSchema,
  disclaimers: disclaimersSchema.optional(),
  brand_voice: brandVoiceSchema.optional(),
  notifications: notificationsSchema.optional(),
  status: z
    .object({
      complete: z.boolean().default(false),
      pendingFields: z.array(z.string()).default([]),
      completedAt: z.string().datetime().optional(),
    })
    .optional()
    .default({ complete: false, pendingFields: [] }),
})

export type KnowledgeBase = z.infer<typeof knowledgeBaseSchema>
export type KnowledgeBaseService = z.infer<typeof serviceSchema>
export type KnowledgeBaseFaq = z.infer<typeof faqSchema>

export const emptyKnowledgeBase = (): KnowledgeBase => ({
  version: 1,
  business: { name: "", website: "", addresses: [], afterHoursPolicy: "pending" },
  hours: {
    timezone: "",
    schedule: [],
    afterHoursMessage: "",
    open247: false,
  },
  services: [],
  booking_policy: {
    consultationMode: "manual_follow_up",
    calendarLink: "",
    deposit: { required: false, currency: "USD", refundable: true, notes: "" },
    cancellation: { feePolicy: "", notes: "" },
  },
  faqs: [],
  disclaimers: {
    standardAccepted: true,
    pricing:
      "Pricing varies by treatment and individual needs. A licensed provider confirms exact pricing during your consultation.",
    medical:
      "Information provided is general and not medical advice. A licensed provider confirms treatment suitability and outcomes during your consultation.",
    consent:
      "By chatting with us you agree to be contacted about your inquiry. See our privacy policy for how we handle your data.",
  },
  brand_voice: {
    tone: "warm",
    customTone: "",
    greeting: "Hi! Are you looking to book a consultation or ask about a treatment?",
    avoidPhrases: [],
    preferPhrases: [],
  },
  notifications: {
    emailRecipients: [],
    smsRecipients: [],
    escalationEmail: "",
    escalationPhone: "",
    channels: { email: true, sms: false },
    quietHours: { enabled: false, from: "22:00", to: "08:00" },
  },
  status: { complete: false, pendingFields: [] },
})

export function isCaptured(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (value === "pending") return false
  if (typeof value === "object" && value !== null) {
    const obj = value as { value?: unknown; status?: string }
    if ("status" in obj) return obj.status === "captured" && Boolean(obj.value)
    if ("value" in obj) return Boolean(obj.value)
  }
  if (typeof value === "string") return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return Boolean(value)
}

function isNonPendingText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0 && value.trim().toLowerCase() !== "pending"
}

/**
 * Step 1 is complete only after every item asked for in the business-basics
 * interview has been captured. Keeping this check outside the LLM makes the
 * section transition deterministic even if a provider returns `summarize`
 * more than once.
 */
export function isBusinessBasicsComplete(kb: KnowledgeBase): boolean {
  const business = kb.business
  if (!business) return false

  const hasAddress = (business.addresses ?? []).some((address) =>
    isNonPendingText(address.line1),
  )

  return Boolean(
    isCaptured(business.name) &&
      isNonPendingText(business.website) &&
      hasAddress &&
      isNonPendingText(business.afterHoursPolicy),
  )
}

export function countPendingFields(kb: KnowledgeBase): string[] {
  const pending: string[] = []
  if (!isCaptured(kb.business?.name)) pending.push("business.name")
  if (!kb.services || kb.services.length === 0) pending.push("services")
  if (!kb.faqs || kb.faqs.length === 0) pending.push("faqs")
  if (!isCaptured(kb.notifications?.emailRecipients) && !isCaptured(kb.notifications?.smsRecipients))
    pending.push("notifications")
  if (!kb.hours?.schedule || kb.hours.schedule.length === 0) pending.push("hours.schedule")
  return pending
}
