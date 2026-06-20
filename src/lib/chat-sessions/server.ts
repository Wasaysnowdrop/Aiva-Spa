import { createAdminClient } from "@/lib/supabase/admin"
import { mapChatSession } from "@/lib/supabase/types"
import type { ChatSession, TranscriptMessage } from "@/lib/supabase/types"

export type UpsertChatSessionTurnInput = {
  sessionId: string
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
}

export async function upsertChatSessionTurn(
  input: UpsertChatSessionTurnInput,
): Promise<ChatSession | null> {
  const admin = createAdminClient()

  const { data: existing, error: fetchErr } = await admin
    .from("chat_sessions")
    .select("*")
    .eq("session_id", input.sessionId)
    .maybeSingle()

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
  const baseRow: Record<string, unknown> = {
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
  }

  if (existing) {
    const { data, error } = await admin
      .from("chat_sessions")
      .update(baseRow as never)
      .eq("session_id", input.sessionId)
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

export async function listChatSessions(limit = 100): Promise<ChatSession[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("chat_sessions")
    .select("*")
    .order("last_message_at", { ascending: false })
    .limit(limit)
  if (error) {
    console.error("listChatSessions failed", error)
    return []
  }
  return (data ?? []).map((row) => mapChatSession(row as Record<string, unknown>))
}

export async function chatSessionExists(sessionId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("chat_sessions")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle()
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
): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from("chat_sessions")
    .update({
      lead_captured: true,
      lead_id: leadId,
      visitor_name: visitorName ?? null,
      status: "captured",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("session_id", sessionId)
}
