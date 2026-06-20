import { createClient } from "@/lib/supabase/client"
import type { TeamMember, TeamRole, TeamMemberStatus } from "@/lib/supabase/types"
import { mapTeamMember } from "@/lib/supabase/types"

export type TeamMemberInsert = {
  name: string
  email: string
  phone?: string | null
  role: TeamRole
}

export type TeamMemberUpdate = Partial<TeamMemberInsert> & { id: string } & {
  status?: TeamMemberStatus
}

function toSnake(
  member: Partial<TeamMemberInsert>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if ("name" in member) payload.name = member.name
  if ("email" in member) payload.email = member.email
  if ("phone" in member) payload.phone = member.phone ?? null
  if ("role" in member) payload.role = member.role
  if ("status" in member) payload.status = member.status
  return payload
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .order("name")

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapTeamMember(row as Record<string, unknown>))
}

export async function getTeamMember(id: string): Promise<TeamMember | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapTeamMember(data as Record<string, unknown>) : null
}

export async function createTeamMember(
  member: TeamMemberInsert,
): Promise<TeamMember> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("team_members")
    .insert(toSnake(member) as never)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapTeamMember(data as Record<string, unknown>)
}

export async function updateTeamMember(
  update: TeamMemberUpdate,
): Promise<TeamMember> {
  const supabase = createClient()
  const { id, ...rest } = update
  const { data, error } = await supabase
    .from("team_members")
    .update(toSnake(rest) as never)
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapTeamMember(data as Record<string, unknown>)
}

export async function deleteTeamMember(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
}

export type TeamMemberRoleInfo = {
  v: TeamRole
  label: string
  description: string
}

export const teamRoleInfo: TeamMemberRoleInfo[] = [
  { v: "Owner", label: "Owner", description: "Full access, billing, and team management." },
  { v: "Manager", label: "Manager", description: "Manage leads, services, and team members." },
  { v: "Staff", label: "Staff", description: "View and update assigned leads." },
  { v: "Receptionist", label: "Receptionist", description: "View leads and respond to chats." },
]

export const rolePermissions: Record<TeamRole, string[]> = {
  Owner: ["Leads", "Conversations", "Knowledge Base", "Widget", "Team", "Billing", "Settings"],
  Manager: ["Leads", "Conversations", "Knowledge Base", "Widget", "Team", "Settings"],
  Staff: ["Leads (assigned)", "Conversations (read)", "Settings (profile)"],
  Receptionist: ["Leads (view)", "Conversations (view)"],
}
