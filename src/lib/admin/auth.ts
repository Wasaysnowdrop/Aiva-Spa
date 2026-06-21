import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isEmailAllowedAsAdmin } from "@/lib/admin/allowlist"

export type AdminUser = {
  id: string
  email: string | null
  createdAt: string
  lastSignInAt: string | null
  appMetadata: Record<string, unknown>
  userMetadata: Record<string, unknown>
  isAdmin: boolean
}

export const isAdminUser = (
  user: { email?: string | null; app_metadata?: Record<string, unknown> | null } | null | undefined,
): boolean => {
  if (!user) return false
  const flagged = Boolean((user.app_metadata as { is_admin?: boolean } | null)?.is_admin)
  if (!flagged) return false
  return isEmailAllowedAsAdmin(user.email)
}

export const requireAdmin = async (): Promise<AdminUser> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login?redirectTo=/admin")
  if (!isAdminUser(user)) redirect("/dashboard?error=admin_required")
  return {
    id: user.id,
    email: user.email ?? null,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    appMetadata: (user.app_metadata ?? {}) as Record<string, unknown>,
    userMetadata: (user.user_metadata ?? {}) as Record<string, unknown>,
    isAdmin: true,
  }
}

export async function requireAdminApi(): Promise<
  | { ok: true; admin: AdminUser }
  | { ok: false; status: 401 | 403; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: "Not authenticated" }
  if (!isAdminUser(user))
    return { ok: false, status: 403, error: "Admin access required" }
  return {
    ok: true,
    admin: {
      id: user.id,
      email: user.email ?? null,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
      appMetadata: (user.app_metadata ?? {}) as Record<string, unknown>,
      userMetadata: (user.user_metadata ?? {}) as Record<string, unknown>,
      isAdmin: true,
    },
  }
}

export const getAdminUserOrNull = cache(async (): Promise<AdminUser | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdminUser(user)) return null
  return {
    id: user.id,
    email: user.email ?? null,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    appMetadata: (user.app_metadata ?? {}) as Record<string, unknown>,
    userMetadata: (user.user_metadata ?? {}) as Record<string, unknown>,
    isAdmin: true,
  }
})
