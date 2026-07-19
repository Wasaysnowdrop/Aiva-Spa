import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { roleCan } from "@/lib/team/permissions"
import { mapTeamMember, type TeamMember, type TeamRole } from "@/lib/supabase/types"

export type LeadAssignmentOptions = { members: TeamMember[]; canAssign: boolean }

export async function getLeadAssignmentOptions(leadId: string): Promise<LeadAssignmentOptions> {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return { members: [], canAssign: false }
  const admin = createAdminClient()
  const { data: lead } = await admin.from("leads").select("user_id").eq("id", leadId).is("deleted_at", null).maybeSingle()
  if (!lead) return { members: [], canAssign: false }
  const businessId = String((lead as { user_id: string }).user_id)
  let role: TeamRole | null = user.id === businessId ? "Owner" : null
  if (!role) {
    const { data: membership } = await admin.from("team_members").select("role").eq("business_id", businessId).eq("member_user_id", user.id).eq("status", "active").maybeSingle()
    role = membership ? (membership as { role: TeamRole }).role : null
  }
  if (!role || (!roleCan(role, "leads:read") && !roleCan(role, "leads:read_assigned"))) return { members: [], canAssign: false }
  const { data, error } = await admin.from("team_members").select("*").eq("business_id", businessId).eq("status", "active").not("member_user_id", "is", null).order("name")
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  return { members: rows.map((row) => mapTeamMember(row)), canAssign: roleCan(role, "leads:write") }
}
