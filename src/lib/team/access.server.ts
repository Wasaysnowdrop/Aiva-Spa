import "server-only"

import type { User } from "@supabase/supabase-js"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { EntitlementError, requireFeatureForUser } from "@/lib/subscription/entitlements.server"
import type { TeamRole } from "@/lib/supabase/types"
import { roleCan } from "@/lib/team/permissions"

export class TeamAccessError extends Error {
  constructor(public readonly code: "AUTH_REQUIRED" | "FORBIDDEN" | "PLAN_REQUIRED", message: string) {
    super(message)
    this.name = "TeamAccessError"
  }
}

export type TeamAccessContext = { user: User; businessId: string; role: "Owner" | "Manager" }

export async function requireTeamManagementAccess(): Promise<TeamAccessContext> {
  const sessionClient = await createClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) throw new TeamAccessError("AUTH_REQUIRED", "Please sign in to continue.")
  const admin = createAdminClient()
  try {
    await requireFeatureForUser(user.id, "role_based_access", admin)
    return { user, businessId: user.id, role: "Owner" }
  } catch (error) {
    if (!(error instanceof EntitlementError)) throw error
  }
  const { data: membership, error } = await admin.from("team_members").select("business_id, role, status").eq("member_user_id", user.id).eq("status", "active").in("role", ["Owner", "Manager"]).maybeSingle()
  if (error || !membership) throw new TeamAccessError("FORBIDDEN", "You do not have permission to manage this team.")
  const row = membership as { business_id: string; role: TeamRole }
  if (!roleCan(row.role, "team:manage")) throw new TeamAccessError("FORBIDDEN", "You do not have permission to manage this team.")
  try { await requireFeatureForUser(row.business_id, "role_based_access", admin) } catch { throw new TeamAccessError("PLAN_REQUIRED", "Team management requires an active Pro plan.") }
  return { user, businessId: row.business_id, role: row.role as "Owner" | "Manager" }
}

