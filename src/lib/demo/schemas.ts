import { z } from "zod"

import { DEMO_SCENARIO_IDS } from "./scenarios"

const cleanText = (max: number) => z.string().trim().min(1).max(max)
const optionalText = (max: number) => z.string().trim().max(max).optional().default("")

export const demoSessionSchema = z.object({
  scenarioId: z.enum(DEMO_SCENARIO_IDS).default("medical-spa"),
  referrer: z.string().trim().max(500).optional().default(""),
  campaign: z.record(z.string().max(80), z.string().max(200)).optional().default({}),
})

export const demoChatSchema = z.object({
  message: cleanText(600),
  requestId: z.string().uuid(),
  website: z.string().max(0).optional().default(""),
})

export const demoTestLeadSchema = z.object({
  mode: z.literal("test"),
  name: cleanText(100),
  email: z.string().trim().email().max(200),
  phone: optionalText(40),
  service: cleanText(120),
  preferredDate: cleanText(80),
  preferredTime: cleanText(80),
  notes: optionalText(500),
  consentGiven: z.literal(true),
})

export const demoSalesLeadSchema = z.object({
  fullName: cleanText(100),
  businessName: cleanText(160),
  workEmail: z.string().trim().email().max(200),
  phone: optionalText(40),
  website: optionalText(300).refine(
    (value) => !value || /^https?:\/\//i.test(value) || /^[a-z0-9.-]+\.[a-z]{2,}/i.test(value),
    "Enter a valid website",
  ),
  locations: z.coerce.number().int().min(1).max(1000),
  monthlyEnquiries: cleanText(80),
  currentProcess: cleanText(800),
  countryTimezone: cleanText(120),
  preferredContactTime: cleanText(120),
  consentGiven: z.literal(true),
})

export const demoEventNames = [
  "DEMO_PAGE_VIEWED",
  "DEMO_STARTED",
  "DEMO_SCENARIO_SELECTED",
  "DEMO_CHAT_OPENED",
  "DEMO_MESSAGE_SENT",
  "DEMO_CONSULTATION_STARTED",
  "DEMO_TEST_LEAD_CREATED",
  "DEMO_BUSINESS_VIEW_OPENED",
  "DEMO_COMPLETED",
  "DEMO_SALES_FORM_OPENED",
  "DEMO_SALES_LEAD_SUBMITTED",
  "DEMO_BOOK_WALKTHROUGH_CLICKED",
  "DEMO_SIGNUP_CLICKED",
  "DEMO_LIMIT_REACHED",
  "DEMO_ABUSE_BLOCKED",
] as const

export type DemoEventName = (typeof demoEventNames)[number]

export const demoEventSchema = z.object({
  eventName: z.enum(demoEventNames),
  metadata: z.record(
    z.string().max(80),
    z.union([z.string().max(300), z.number(), z.boolean(), z.null()]),
  ).optional().default({}),
})

export const demoSummaryEmailSchema = z.object({
  email: z.string().trim().email().max(200),
  consentGiven: z.literal(true),
  completedEvents: z.array(z.string().trim().max(120)).max(12),
})

export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message || "Invalid request"
}

