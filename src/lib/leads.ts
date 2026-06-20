import { unstable_noStore as noStore } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { mapChatSession, mapLead, mapTeamMember } from "@/lib/supabase/types"
import type { ChatSession, Lead, TeamMember } from "@/lib/supabase/types"

export type GetLeadsOptions = {
  includeMerged?: boolean
}

export async function getLeads(options: GetLeadsOptions = {}): Promise<Lead[]> {
  noStore()
  const supabase = await createClient()
  let query = supabase.from("leads").select("*").order("created_at", { ascending: false })

  if (!options.includeMerged) {
    query = query.is("merged_into_id", null)
  }

  const { data, error } = await query

  if (error) {
    console.error("[leads] getLeads query failed:", error.message)
    return []
  }
  return (data ?? []).map((row) => {
    try {
      return mapLead(row as Record<string, unknown>)
    } catch (e) {
      console.error("[leads] mapLead failed for row:", (row as { id?: string })?.id, e)
      return null
    }
  }).filter((l): l is Lead => l !== null)
}

export async function getLead(id: string): Promise<Lead | null> {
  noStore()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
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
    .order("last_message_at", { ascending: false })
    .limit(limit)

  if (error) {
    // Table may not be replicated in the publication yet — fail soft.
    return []
  }
  return (data ?? []).map((row) => mapChatSession(row as Record<string, unknown>))
}
