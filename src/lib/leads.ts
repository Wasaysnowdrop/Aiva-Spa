import { unstable_noStore as noStore } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { mapChatSession, mapLead, mapTeamMember } from "@/lib/supabase/types"
import type { ChatSession, Lead, TeamMember } from "@/lib/supabase/types"

export type GetLeadsOptions = {
  includeMerged?: boolean
}

export async function getLeads(options: GetLeadsOptions = {}): Promise<Lead[]> {
  noStore()
  try {
    const supabase = await createClient()
    let query = supabase
      .from("leads")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (!options.includeMerged) {
      query = query.is("merged_into_id", null)
    }

    const { data, error } = await query

    if (error) {
      console.error("[leads] supabase error in getLeads:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      return []
    }
    if (!data) {
      console.warn("[leads] supabase returned no data (null) in getLeads")
      return []
    }
    console.log("[leads] supabase leads response:", {
      count: Array.isArray(data) ? data.length : 0,
      sample: Array.isArray(data)
        ? data.slice(0, 2).map((r: Record<string, unknown>) => ({ id: r?.id, name: r?.name }))
        : null,
    })
    return (data ?? [])
      .map((row) => {
        try {
          return mapLead(row as Record<string, unknown>)
        } catch (e) {
          console.error("[leads] mapLead failed for row:", (row as { id?: string })?.id, e)
          return null
        }
      })
      .filter((l): l is Lead => l !== null && Boolean(l?.id))
  } catch (e) {
    console.error("[leads] getLeads threw:", e)
    return []
  }
}

export async function getLead(id: string): Promise<Lead | null> {
  noStore()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    console.error("[leads] getLead query failed:", error.message)
    return null
  }
  if (!data) return null
  try {
    return mapLead(data as Record<string, unknown>)
  } catch (e) {
    console.error("[leads] mapLead failed for id:", id, e)
    return null
  }
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  noStore()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .order("name")

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapTeamMember(row as Record<string, unknown>))
}

export async function getLiveChatSessions(limit = 50): Promise<ChatSession[]> {
  noStore()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("conversation_type", "visitor")
    .eq("channel", "website_widget")
    .is("deleted_at", null)
    .order("last_message_at", { ascending: false })
    .limit(limit)

  if (error) {
    // Table may not be replicated in the publication yet — fail soft.
    return []
  }
  return (data ?? []).map((row) => mapChatSession(row as Record<string, unknown>))
}
