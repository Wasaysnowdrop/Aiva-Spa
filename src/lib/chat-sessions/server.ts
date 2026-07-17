import { createAdminClient } from "@/lib/supabase/admin"
import { classificationIsBillable } from "@/lib/conversations/eligibility"
import type {
  ConversationChannel,
  ConversationEnvironment,
  ConversationType,
} from "@/lib/conversations/eligibility"
import { mapChatSession } from "@/lib/supabase/types"
import type { ChatSession, TranscriptMessage } from "@/lib/supabase/types"

export type UpsertChatSessionTurnInput = {
  sessionId: string
  userId?: string | null
  spaId?: string
  visitorMessage: TranscriptMessage
  aiMessage: TranscriptMessage
  sourceUrl?: string
  afterHours?: boolean
  consentGiven?: boolean
  visitorName?: string | null
  leadCaptured?: boolean
  leadId?: string | null
  status?: "active" | "captured" | "abandoned"
  conversationType: ConversationType
  channel: ConversationChannel
  environment: ConversationEnvironment
}

export async function upsertChatSessionTurn(
  input: UpsertChatSessionTurnInput,
): Promise<ChatSession | null> {
  const admin = createAdminClient()

  let existingQuery = admin
    .from("chat_sessions")
    .select("*")
    .eq("session_id", input.sessionId)

  existingQuery = input.userId
    ? existingQuery.eq("user_id", input.userId)
    : existingQuery.is("user_id", null)

  const { data: existing, error: fetchErr } = await existingQuery.maybeSingle()

  if (fetchErr) {
    console.error("upsertChatSessionTurn fetch failed", fetchErr)
    return null
  }

  const priorTranscript: TranscriptMessage[] = Array.isArray(
    (existing as { transcript?: unknown } | null)?.transcript,
  )
    ? ((existing as unknown as { transcript: TranscriptMessage[] }).transcript)
    : []

  const merged: TranscriptMessage[] = [
    ...priorTranscript,
    input.visitorMessage,
    input.aiMessage,
  ].slice(-100)

  const now = new Date().toISOString()
  const classification = {
    conversationType: input.conversationType,
    channel: input.channel,
    environment: input.environment,
  }
  const baseRow: Record<string, unknown> = {
    user_id: input.userId ?? null,
    session_id: input.sessionId,
    spa_id: input.spaId ?? "default",
    transcript: merged,
    message_count: merged.length,
    last_message: input.aiMessage.content,
    last_role: input.aiMessage.role,
    last_message_at: now,
    source_url: (input.sourceUrl ?? "/").slice(0, 2000),
    after_hours: Boolean(input.afterHours),
    visitor_name: input.visitorName ?? null,
    lead_captured: Boolean(input.leadCaptured),
    lead_id: input.leadId ?? null,
    consent_given: Boolean(input.consentGiven),
    status: input.status ?? (input.leadCaptured ? "captured" : "active"),
    conversation_type: classification.conversationType,
    channel: classification.channel,
    environment: classification.environment,
    is_billable: classificationIsBillable(classification),
    updated_at: now,
  }

  if (existing) {
    const existingId = String((existing as { id: string }).id)
    const { data, error } = await admin
      .from("chat_sessions")
      .update(baseRow as never)
      .eq("id", existingId)
      .select("*")
      .maybeSingle()
    if (error) {
      console.error("upsertChatSessionTurn update failed", error)
      return null
    }
    return data ? mapChatSession(data as Record<string, unknown>) : null
  }

  baseRow.created_at = now
  const { data, error } = await admin
    .from("chat_sessions")
    .insert(baseRow as never)
    .select("*")
    .maybeSingle()
  if (error) {
    console.error("upsertChatSessionTurn insert failed", error)
    return null
  }
  return data ? mapChatSession(data as Record<string, unknown>) : null
}

export async function meterChatSession(sessionId: string): Promise<number | null> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc(
    "meter_chat_session" as never,
    { p_session_id: sessionId } as never,
  )
  if (error) {
    console.error("meterChatSession failed", {
      code: error.code,
      message: error.message,
    })
    return null
  }
  return typeof data === "number" ? data : Number(data ?? 0)
}

export async function listChatSessions(limit = 100): Promise<ChatSession[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("chat_sessions")
    .select("*")
    .eq("conversation_type", "visitor")
    .eq("channel", "website_widget")
    .is("deleted_at", null)
    .order("last_message_at", { ascending: false })
    .limit(limit)
  if (error) {
    console.error("listChatSessions failed", error)
    return []
  }
  return (data ?? []).map((row) => mapChatSession(row as Record<string, unknown>))
}

export async function chatSessionExists(
  sessionId: string,
  userId?: string | null,
): Promise<boolean> {
  const admin = createAdminClient()
  let query = admin
    .from("chat_sessions")
    .select("id")
    .eq("session_id", sessionId)
  query = userId ? query.eq("user_id", userId) : query.is("user_id", null)
  const { data, error } = await query.maybeSingle()
  if (error) {
    console.error("chatSessionExists failed", error)
    return false
  }
  return Boolean(data)
}

export async function markSessionLeadCaptured(
  sessionId: string,
  leadId: string,
  visitorName?: string | null,
  userId?: string | null,
): Promise<void> {
  const admin = createAdminClient()
  let query = admin
    .from("chat_sessions")
    .update({
      lead_captured: true,
      lead_id: leadId,
      visitor_name: visitorName ?? null,
      status: "captured",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("session_id", sessionId)
  query = userId ? query.eq("user_id", userId) : query.is("user_id", null)
  await query
}