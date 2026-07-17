import type { ChatSession } from "@/lib/supabase/types"

export const CONVERSATION_TYPES = [
  "visitor",
  "onboarding",
  "internal",
  "test",
  "support",
] as const

export const CONVERSATION_CHANNELS = [
  "website_widget",
  "onboarding_assistant",
  "dashboard_internal",
  "email",
] as const

export const CONVERSATION_ENVIRONMENTS = ["production", "preview", "test"] as const

export type ConversationType = (typeof CONVERSATION_TYPES)[number]
export type ConversationChannel = (typeof CONVERSATION_CHANNELS)[number]
export type ConversationEnvironment = (typeof CONVERSATION_ENVIRONMENTS)[number]

export type ConversationClassification = {
  conversationType: ConversationType
  channel: ConversationChannel
  environment: ConversationEnvironment
}

export function isCustomerConversation(
  session: Pick<ChatSession, "conversationType" | "channel" | "deletedAt">,
): boolean {
  return (
    !session.deletedAt &&
    session.conversationType === "visitor" &&
    session.channel === "website_widget"
  )
}

export function isBillableConversation(
  session: Pick<
    ChatSession,
    | "conversationType"
    | "channel"
    | "environment"
    | "isBillable"
    | "deletedAt"
    | "transcript"
  >,
): boolean {
  return (
    isCustomerConversation(session) &&
    session.environment === "production" &&
    session.isBillable &&
    session.transcript.some(
      (message) => message.role === "visitor" && message.content.trim().length > 0,
    )
  )
}

export function classificationIsBillable(
  classification: ConversationClassification,
): boolean {
  return (
    classification.conversationType === "visitor" &&
    classification.channel === "website_widget" &&
    classification.environment === "production"
  )
}