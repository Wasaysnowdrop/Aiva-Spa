import { z } from "zod"

export const chatMessageSchema = z.object({
  role: z.enum(["visitor", "user", "assistant", "ai"]),
  content: z.string().min(1).max(2000),
})

export const chatRequestSchema = z.object({
  spaId: z.string().min(1).max(200).optional(),
  conversationType: z.enum(["visitor", "onboarding", "internal", "test", "support"]).optional(),
  channel: z.enum(["website_widget", "onboarding_assistant", "dashboard_internal", "email"]).optional(),
  environment: z.enum(["production", "preview", "test"]).optional(),
  sessionId: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  history: z.array(chatMessageSchema).max(40).optional(),
  consentGiven: z.boolean().optional(),
  lead: z
    .object({
      name: z.string().max(120).optional(),
      email: z.string().email().max(254).optional().or(z.literal("")),
      phone: z.string().max(40).optional(),
      service: z.string().max(80).optional(),
      preferredTime: z.string().max(200).optional(),
      notes: z.string().max(2000).optional(),
    })
    .partial()
    .optional(),
  sourceUrl: z.string().max(2000).optional(),
})

export type ChatRequest = z.infer<typeof chatRequestSchema>

export const leadRequestSchema = z.object({
  spaId: z.string().min(1).max(200).optional(),
  sessionId: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(120),
  email: z.string().email().max(254),
  phone: z.string().min(5).max(40),
  service: z.string().min(1).max(80),
  preferredTime: z.string().min(1).max(200),
  notes: z.string().min(1).max(2000),
  sourceUrl: z.string().max(2000).optional(),
  transcript: z.array(chatMessageSchema).max(80).optional(),
  consentGiven: z.boolean().optional(),
  afterHours: z.boolean().optional(),
})

export type LeadRequest = z.infer<typeof leadRequestSchema>

export function safeValidate<T>(schema: z.ZodType<T>, data: unknown):
  | { ok: true; data: T }
  | { ok: false; error: string } {
  const result = schema.safeParse(data)
  if (result.success) return { ok: true, data: result.data as T }
  const first = result.error.issues[0]
  return {
    ok: false,
    error: first ? `${first.path.join(".")}: ${first.message}` : "Invalid request",
  }
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 7 && digits.length <= 15
}
